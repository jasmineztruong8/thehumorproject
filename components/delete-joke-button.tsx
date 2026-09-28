"use client";

import { useTransition } from "react";
import { deleteJoke } from "@/app/actions";

export function DeleteJokeButton({ jokeId }: { jokeId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Delete this joke? Its votes will be removed too.")) return;
    startTransition(async () => {
      const result = await deleteJoke(jokeId);
      if (result?.error) alert(result.error);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-sm text-neutral-500 hover:text-red-500 underline underline-offset-4 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
