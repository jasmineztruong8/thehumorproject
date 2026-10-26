import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Attempt } from "@/lib/gemini";

// Writes one generation_requests row and one llm_responses row per model the
// AI tried. Logging is best-effort: a failure here is reported to the server
// log and never reaches the user.

export type GenerationLog = {
  app: "site" | "admin";
  userId: string;
  kind: "describe" | "caption";
  chainId: string | null;
  imageId: string | null;
  steer: string | null;
  prompt: string; // text sent to the model (images aren't stored)
  attempts: Attempt[];
  startedAt: number;
  error?: string;
  modelIds?: Record<string, string>;
};

const clip = (text: string | null | undefined, max: number) => (text == null ? null : text.slice(0, max));

export function logRows(log: GenerationLog) {
  const succeeded = log.attempts.some((a) => a.status === "ok") && !log.error;
  const request = {
    user_id: log.userId,
    app: log.app,
    kind: log.kind,
    chain_id: log.chainId,
    image_id: log.imageId,
    steer: clip(log.steer, 120),
    status: succeeded ? "succeeded" : "failed",
    error: succeeded ? null : clip(log.error ?? "No model answered", 500),
    duration_ms: Math.max(0, Date.now() - log.startedAt),
  };
  const responses = log.attempts.map((a, i) => ({
    attempt: i + 1,
    model: a.model.slice(0, 100),
    llm_model_id: log.modelIds?.[a.model] ?? null,
    prompt: log.prompt.slice(0, 20000),
    output: clip(a.output, 20000),
    status: a.status,
    http_status: a.httpStatus,
    error: clip(a.error, 500),
    latency_ms: Math.max(0, Math.round(a.latencyMs)),
  }));
  return { request, responses };
}

export async function writeGenerationLog(supabase: SupabaseClient, log: GenerationLog) {
  try {
    const { request, responses } = logRows(log);
    const { data, error } = await supabase.from("generation_requests").insert(request).select("id").single();
    if (error) throw error;
    if (responses.length) {
      const { error: responsesError } = await supabase
        .from("llm_responses")
        .insert(responses.map((r) => ({ ...r, request_id: data.id })));
      if (responsesError) throw responsesError;
    }
  } catch (e) {
    console.error("Writing the AI request log failed", e);
  }
}
