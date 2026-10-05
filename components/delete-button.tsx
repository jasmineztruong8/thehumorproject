"use client";

import { useTransition } from "react";
import type { FormState } from "@/app/actions";

// Confirms, then runs a server action that's already bound to the row id,
// e.g. <DeleteButton action={deleteCaption.bind(null, id)} />.
export function DeleteButton({
  action,
  confirmText,
  label = "Delete",
}: {
  action: () => Promise<FormState>;
  confirmText: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(confirmText)) return;
    startTransition(async () => {
      const result = await action();
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
      {pending ? "Deleting…" : label}
    </button>
  );
}
