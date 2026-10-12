"use client";

import { useTransition } from "react";
import type { FormState } from "@/app/actions";
import { PixelIcon } from "@/components/pixel-icon";

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
      className="inline-flex items-center gap-1.5 text-sm text-dim hover:text-danger cursor-pointer disabled:opacity-50"
    >
      <PixelIcon name="trash" size={14} />
      {pending ? "Deleting…" : label}
    </button>
  );
}
