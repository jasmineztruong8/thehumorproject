"use client";

import { PixelIcon } from "@/components/pixel-icon";
import { SteerInput } from "@/components/steer-input";

const primary =
  "btn-primary px-5 py-2.5 font-medium disabled:opacity-50";
const secondary =
  "btn-secondary px-5 py-2.5 font-medium disabled:opacity-50";

// A pulsing placeholder with a label, shown while the AI is working.
export function AiLoading({ label, lines = 2 }: { label: string; lines?: number }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      <span className="text-sm text-dim flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-full border-2 border-dim border-t-transparent animate-spin" aria-hidden />
        {label}
      </span>
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className={`h-4 rounded bg-well animate-pulse ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

// Topic box, "generate / try another" button and the suggested caption with
// its Post button. Shared by the upload draft and the image page. Always
// fully visible, with loading placeholders while the AI works.
export function CaptionDraft({
  caption,
  steer,
  onSteerChange,
  loading,
  posting,
  canSuggest,
  error,
  postLabel,
  onSuggest,
  onPost,
}: {
  caption: string | null;
  steer: string;
  onSteerChange: (steer: string) => void;
  loading: string | null; // label while a caption is on its way
  posting: boolean;
  canSuggest: boolean;
  error: string | null;
  postLabel: string;
  onSuggest: () => void;
  onPost: () => void;
}) {
  const busy = Boolean(loading) || posting;

  return (
    <div className="flex flex-col gap-4">
      <SteerInput value={steer} onChange={onSteerChange} disabled={posting} />
      <button
        type="button"
        disabled={busy || !canSuggest}
        onClick={onSuggest}
        className={`self-start ${caption ? secondary : primary}`}
      >
        <PixelIcon name={caption ? "refresh" : "sparkle"} size={14} />
        {caption ? "Try another caption" : "Generate a caption"}
      </button>

      <div className="panel p-4 flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-dim">Suggested caption</span>
        {loading ? (
          <AiLoading label={loading} />
        ) : caption ? (
          <>
            <p className="text-lg">{caption}</p>
            <button type="button" disabled={posting} onClick={onPost} className={`self-start ${primary}`}>
              {posting ? "Posting…" : postLabel}
              <PixelIcon name="arrow" size={12} className="rotate-90" />
            </button>
          </>
        ) : (
          <p className="text-dim">
            Pick a topic (or don&apos;t) and click Generate. You can try as many as you like
            before posting.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

// Server actions can fail without returning (e.g. a timeout); never fail silently.
export async function safely<T>(action: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await action();
  } catch (e) {
    console.error(e);
    return { error: "That took too long or the connection dropped. Please try again." };
  }
}
