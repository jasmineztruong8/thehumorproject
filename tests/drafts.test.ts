import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { readDraft, signDraft } = await import("@/lib/drafts");

const draft = {
  kind: "caption" as const,
  userId: "user-1",
  imageId: "image-1",
  caption: { content: "fake caption", prompt: "p", model: "m", steer: null },
  suggestions: 1,
  issuedAt: Date.now(),
};

beforeEach(() => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-secret");
});

describe("drafts", () => {
  it("round-trips for the same user", () => {
    expect(readDraft(signDraft(draft), "caption", "user-1")).toEqual(draft);
  });

  it("rejects another user's draft", () => {
    expect(readDraft(signDraft(draft), "caption", "user-2")).toBeNull();
  });

  it("rejects a draft whose caption was edited", () => {
    const [, signature] = signDraft(draft).split(".");
    const forged = Buffer.from(JSON.stringify({ ...draft, caption: { ...draft.caption, content: "edited" } })).toString("base64url");
    expect(readDraft(`${forged}.${signature}`, "caption", "user-1")).toBeNull();
  });

  it("rejects the wrong kind, old drafts and garbage", () => {
    expect(readDraft(signDraft(draft), "upload", "user-1")).toBeNull();
    expect(readDraft(signDraft({ ...draft, issuedAt: Date.now() - 2 * 86400000 }), "caption", "user-1")).toBeNull();
    expect(readDraft("not-a-token", "caption", "user-1")).toBeNull();
    expect(readDraft(undefined, "caption", "user-1")).toBeNull();
  });
});
