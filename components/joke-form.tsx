"use client";

import { useActionState } from "react";
import { submitJoke } from "@/app/actions";

export function JokeForm() {
  const [state, formAction, pending] = useActionState(submitJoke, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Your joke</span>
        <textarea
          name="content"
          required
          maxLength={280}
          rows={4}
          placeholder="Why did the scarecrow win an award?…"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2"
        />
      </label>
      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-5 py-2.5 font-medium disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit joke"}
      </button>
    </form>
  );
}
