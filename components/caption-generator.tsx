"use client";

import { useActionState, useRef } from "react";
import { generateCaption } from "@/app/actions";
import { MAX_STEER_LENGTH } from "@/lib/prompts";

const IDEAS = ["midterms", "the 1 train", "dining hall food", "NYC rent", "being from the midwest", "group chats"];

// Asks the AI for another caption, optionally about a topic the user picks.
export function CaptionGenerator({ imageId }: { imageId: string }) {
  const [state, formAction, pending] = useActionState(generateCaption, undefined);
  const steerRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="image_id" value={imageId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Make it about… (optional)</span>
        <input
          ref={steerRef}
          name="steer"
          maxLength={MAX_STEER_LENGTH}
          placeholder="e.g. freezing on the walk to Butler"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            onClick={() => {
              if (steerRef.current) steerRef.current.value = idea;
            }}
            className="rounded-full border border-neutral-200 dark:border-neutral-800 px-3 py-1 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          >
            {idea}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-5 py-2.5 font-medium disabled:opacity-50"
      >
        {pending ? "Thinking…" : "✨ Generate a caption"}
      </button>
      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
      {state?.message && !pending && <p className="text-sm text-green-600">{state.message}</p>}
    </form>
  );
}
