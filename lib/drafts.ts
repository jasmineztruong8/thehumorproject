import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Drafts let users preview AI output before anything is posted. The draft
// lives in the browser as a signed token: the server signs what the AI
// produced, so on "Post" it can trust the description, caption and prompts
// came from the AI and weren't edited by the user.

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type DraftCaption = { content: string; prompt: string; model: string; steer: string | null };

export type UploadDraft = {
  kind: "upload";
  userId: string;
  storagePath: string;
  description: string;
  descriptionPrompt: string;
  descriptionModel: string;
  animated: boolean;
  caption: DraftCaption | null;
  suggestions: number; // captions generated for this draft so far
  issuedAt: number;
};

export type CaptionDraft = {
  kind: "caption";
  userId: string;
  imageId: string;
  caption: DraftCaption;
  suggestions: number;
  issuedAt: number;
};

type Draft = UploadDraft | CaptionDraft;

function key() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createHmac("sha256", secret).update("humor-project-drafts-v1").digest();
}

function mac(payload: string) {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}

export function signDraft(draft: Draft) {
  const payload = Buffer.from(JSON.stringify(draft)).toString("base64url");
  return `${payload}.${mac(payload)}`;
}

// Returns the draft only if it's untampered, recent, of the expected kind and
// belongs to this user.
export function readDraft<K extends Draft["kind"]>(
  token: unknown,
  kind: K,
  userId: string,
): Extract<Draft, { kind: K }> | null {
  if (typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(mac(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let draft: Draft;
  try {
    draft = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
  if (draft.kind !== kind || draft.userId !== userId) return null;
  if (Date.now() - draft.issuedAt > MAX_AGE_MS) return null;
  return draft as Extract<Draft, { kind: K }>;
}
