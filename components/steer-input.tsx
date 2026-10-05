"use client";

import { MAX_STEER_LENGTH } from "@/lib/prompts";

const IDEAS = ["midterms", "the 1 train", "dining hall food", "NYC rent", "being from the midwest", "group chats"];

// "Make it about…" box plus one-click topic ideas, used wherever the AI
// suggests a caption.
export function SteerInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Make it about… (optional)</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          maxLength={MAX_STEER_LENGTH}
          placeholder="e.g. freezing on the walk to Butler"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 disabled:opacity-60"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            disabled={disabled}
            onClick={() => onChange(idea)}
            aria-pressed={value === idea}
            className={`rounded-full border px-3 py-1 text-xs ${
              value === idea
                ? "border-neutral-900 dark:border-white text-neutral-900 dark:text-white"
                : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            {idea}
          </button>
        ))}
      </div>
    </div>
  );
}
