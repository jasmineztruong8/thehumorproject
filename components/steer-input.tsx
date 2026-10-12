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
          className="field disabled:opacity-60"
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
            className={`border px-3 py-1 text-xs ${
              value === idea
                ? "tab-on"
                : "border-line tab-off"
            }`}
          >
            {idea}
          </button>
        ))}
      </div>
    </div>
  );
}
