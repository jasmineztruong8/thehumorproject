import "server-only";
import { GoogleGenAI } from "@google/genai";
import { framesForModel } from "@/lib/media";
import {
  CAPTION_SYSTEM_INSTRUCTION,
  DESCRIBE_PROMPT,
  buildCaptionPrompt,
  describeGifPrompt,
  cleanCaption,
} from "@/lib/prompts";

// Server-only: the API key must never reach the browser.
// The free tier allows only ~20 requests per day *per model* and models get
// overloaded (503) at busy times, so work through several free models.
const MODELS = [
  ...new Set([
    process.env.GEMINI_MODEL || "gemini-3-flash-preview",
    "gemini-flash-latest",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-flash-lite-latest",
  ]),
];

// Thrown when no model could answer: "quota" means today's free requests are
// used up everywhere; "busy" means it's worth trying again in a moment.
export class AiUnavailableError extends Error {
  constructor(public reason: "quota" | "busy") {
    super(`AI unavailable: ${reason}`);
  }
}

type Request = Omit<Parameters<GoogleGenAI["models"]["generateContent"]>[0], "model">;

async function generate(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const ai = new GoogleGenAI({ apiKey });

  // Go through every model; models that were only overloaded get one more
  // try after a short pause. Out-of-quota or retired models are skipped.
  const overloaded: string[] = [];
  const attempt = async (model: string) => {
    try {
      const response = await ai.models.generateContent({ ...request, model });
      return { response, model: response.modelVersion ?? model };
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      if (status >= 500) overloaded.push(model);
      else if (status !== 429 && status !== 404) throw e;
      return null;
    }
  };

  for (const model of MODELS) {
    const result = await attempt(model);
    if (result) return result;
  }
  if (!overloaded.length) throw new AiUnavailableError("quota");

  await new Promise((resolve) => setTimeout(resolve, 1500));
  for (const model of overloaded.splice(0)) {
    const result = await attempt(model);
    if (result) return result;
  }
  throw new AiUnavailableError("busy");
}

// Step 1: look at the image once and describe it. The description is saved
// with the image and reused for every caption, so later captions are text-only.
// Animated GIFs are sent as a few frames so the description covers the motion.
export async function describeImage(file: { data: Buffer; mimeType: string }) {
  const { images, animated } = await framesForModel(file.data, file.mimeType);
  const prompt = animated ? describeGifPrompt(images.length) : DESCRIBE_PROMPT;
  const { response, model } = await generate({
    contents: [
      ...images.map((image) => ({
        inlineData: { data: image.data.toString("base64"), mimeType: image.mimeType },
      })),
      { text: prompt },
    ],
  });
  const description = response.text?.trim();
  if (!description) throw new Error("Empty description");
  return { description, prompt, model, animated };
}

// Step 2: write a caption from the saved description (plus an optional topic).
export async function writeCaption(description: string, steer: string | null) {
  const prompt = buildCaptionPrompt(description, steer);
  const { response, model } = await generate({
    contents: prompt,
    config: { systemInstruction: CAPTION_SYSTEM_INSTRUCTION, temperature: 1.1 },
  });
  const content = cleanCaption(response.text ?? "");
  if (!content) throw new Error("Empty caption");
  return {
    content,
    // Save exactly what was sent: the system instruction and the prompt
    prompt: `${CAPTION_SYSTEM_INSTRUCTION}\n\n---\n\n${prompt}`,
    model,
  };
}
