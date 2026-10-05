import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

// These tests never call Gemini: a fake stands in for the SDK, so they cost
// no API quota. The one real call lives in tests/live/gemini.live.test.ts.

type Call = { model: string; contents: unknown; config?: { systemInstruction?: string } };
const calls: Call[] = [];
let respond: (call: Call) => { text: string } | Error;

vi.mock("server-only", () => ({}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: async (call: Call) => {
        calls.push(call);
        const result = respond(call);
        if (result instanceof Error) throw result;
        return { ...result, modelVersion: call.model };
      },
    };
  },
}));

const { AiUnavailableError, describeImage, writeCaption } = await import("@/lib/gemini");

function apiError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

const FAKE_CAPTION = `fake caption ${Math.random().toString(36).slice(2)}`;

beforeEach(() => {
  calls.length = 0;
  respond = () => ({ text: FAKE_CAPTION });
  vi.stubEnv("GEMINI_API_KEY", "test-key");
});

describe("writeCaption", () => {
  it("returns the caption and saves the full prompt that was sent", async () => {
    const caption = await writeCaption("A cat on a radiator.", "midterms");

    expect(caption.content).toBe(FAKE_CAPTION);
    expect(calls).toHaveLength(1);
    expect(calls[0].contents).toContain("A cat on a radiator.");
    expect(calls[0].contents).toContain("<topic>midterms</topic>");
    expect(caption.prompt).toContain(calls[0].config!.systemInstruction!);
    expect(caption.prompt).toContain(calls[0].contents as string);
    expect(caption.model).toBe(calls[0].model);
  });

  it("cleans up quotes and labels in the model's answer", async () => {
    respond = () => ({ text: 'Caption: "me after one midterm"' });
    expect((await writeCaption("A cat.", null)).content).toBe("me after one midterm");
  });

  it("rejects an empty answer", async () => {
    respond = () => ({ text: "  " });
    await expect(writeCaption("A cat.", null)).rejects.toThrow("Empty caption");
  });
});

describe("model fallback", () => {
  it("skips models that are out of free quota", async () => {
    respond = (call) => (calls.length < 3 ? apiError(429) : { text: `from ${call.model}` });
    const caption = await writeCaption("A cat.", null);
    expect(calls).toHaveLength(3);
    expect(new Set(calls.map((c) => c.model)).size).toBe(3);
    expect(caption.content).toBe(`from ${calls[2].model}`);
  });

  it("retries overloaded models once after a pause", async () => {
    let tries = 0;
    respond = () => (++tries <= 5 ? apiError(503) : { text: "worked on retry" });
    expect((await writeCaption("A cat.", null)).content).toBe("worked on retry");
    expect(calls[5].model).toBe(calls[0].model);
  });

  it("reports when every model is out of quota", async () => {
    respond = () => apiError(429);
    await expect(writeCaption("A cat.", null)).rejects.toMatchObject({ reason: "quota" });
    await expect(writeCaption("A cat.", null)).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it("reports busy when models stay overloaded", async () => {
    respond = () => apiError(503);
    await expect(writeCaption("A cat.", null)).rejects.toMatchObject({ reason: "busy" });
  });

  it("doesn't hide real errors like a bad API key", async () => {
    respond = () => apiError(400);
    await expect(writeCaption("A cat.", null)).rejects.toThrow("HTTP 400");
    expect(calls).toHaveLength(1);
  });
});

describe("describeImage", () => {
  const solid = (r: number) =>
    sharp({ create: { width: 16, height: 16, channels: 3, background: { r, g: 0, b: 0 } } }).png().toBuffer();

  it("sends a photo as one image", async () => {
    const data = await sharp(await solid(10)).jpeg().toBuffer();
    const result = await describeImage({ data, mimeType: "image/jpeg" });

    expect(result).toMatchObject({ description: FAKE_CAPTION, animated: false });
    const parts = calls[0].contents as { inlineData?: unknown }[];
    expect(parts.filter((p) => p.inlineData)).toHaveLength(1);
  });

  it("sends an animated GIF as several frames, in order, with the GIF prompt", async () => {
    const frames = await Promise.all([0, 60, 120, 180, 240, 250].map(solid));
    const gif = await sharp(frames, { join: { animated: true } }).gif().toBuffer();
    const result = await describeImage({ data: gif, mimeType: "image/gif" });

    expect(result.animated).toBe(true);
    expect(result.prompt).toMatch(/frames, in order, from one animated GIF/);
    const parts = calls[0].contents as { inlineData?: { mimeType: string } }[];
    const images = parts.filter((p) => p.inlineData);
    expect(images).toHaveLength(4);
    expect(images.every((p) => p.inlineData!.mimeType === "image/jpeg")).toBe(true);
  });
});
