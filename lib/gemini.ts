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

// Vercel stops a request after 60s; leave ~10s for the rest of the request.
const TIME_BUDGET_MS = 50_000;
const CALL_TIMEOUT_MS = 30_000; // a normal answer takes 2-8s
const QUOTA_SKIP_MS = 60 * 60 * 1000;

// Models that said "out of free requests", so later requests on this server
// skip them for a while instead of asking again.
const outOfQuotaUntil = new Map<string, number>();

async function generate(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const ai = new GoogleGenAI({ apiKey });
  const deadline = Date.now() + TIME_BUDGET_MS;

  // Go through the models; overloaded or slow ones get one more try after a
  // short pause, as long as there's time left. Out-of-quota or retired
  // models are skipped.
  const overloaded: string[] = [];
  let sawQuota = false;
  const attempt = async (model: string) => {
    const remaining = deadline - Date.now();
    if (remaining < 2_000) return null;
    const started = Date.now();
    try {
      const response = await ai.models.generateContent({
        ...request,
        model,
        config: { ...request.config, httpOptions: { timeout: Math.min(CALL_TIMEOUT_MS, remaining) } },
      });
      console.info(`[gemini] ${model} answered in ${Date.now() - started}ms`);
      return { response, model: response.modelVersion ?? model };
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      const message = String((e as Error).message ?? e);
      const timedOut = !status && /abort|timeout|timed out/i.test(message);
      console.warn(`[gemini] ${model} failed after ${Date.now() - started}ms: ${status || "no status"} ${message.slice(0, 200)}`);
      if (status === 429) {
        sawQuota = true;
        outOfQuotaUntil.set(model, Date.now() + QUOTA_SKIP_MS);
      } else if (status >= 500 || timedOut) {
        overloaded.push(model);
      } else if (status !== 404) {
        throw e;
      }
      return null;
    }
  };

  const available = MODELS.filter((m) => (outOfQuotaUntil.get(m) ?? 0) < Date.now());
  for (const model of available) {
    const result = await attempt(model);
    if (result) return result;
  }
  if (overloaded.length && deadline - Date.now() > 4_000) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    for (const model of overloaded.splice(0)) {
      const result = await attempt(model);
      if (result) return result;
    }
  }
  const allOutOfQuota = !overloaded.length && (sawQuota || available.length === 0);
  throw new AiUnavailableError(allOutOfQuota ? "quota" : "busy");
}

// For tests: forget which models were out of quota.
export function resetModelState() {
  outOfQuotaUntil.clear();
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
