import { describe, expect, it, vi } from "vitest";

// The one test that calls the real Gemini API. It uses 1 request of the
// free daily quota, so it only runs with:   npm run test:live
vi.mock("server-only", () => ({}));
const { writeCaption } = await import("@/lib/gemini");

describe.runIf(process.env.GEMINI_API_KEY)("Gemini (live)", () => {
  it("writes a real caption", async () => {
    const caption = await writeCaption("A tired student asleep on a pile of textbooks.", "midterms");
    console.log(`${caption.model}: ${caption.content}`);
    expect(caption.content.length).toBeGreaterThan(0);
    expect(caption.content.length).toBeLessThanOrEqual(300);
  });
});
