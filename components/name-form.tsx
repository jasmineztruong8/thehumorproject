"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaultFirstName?: string;
  defaultLastName?: string;
  submitLabel: string;
};

export function NameForm({
  action,
  defaultFirstName = "",
  defaultLastName = "",
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">First name</span>
        <input
          name="first_name"
          defaultValue={defaultFirstName}
          required
          maxLength={50}
          autoComplete="given-name"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Last name</span>
        <input
          name="last_name"
          defaultValue={defaultLastName}
          required
          maxLength={50}
          autoComplete="family-name"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2"
        />
      </label>
      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
      {state?.message && (
        <p className="text-sm text-green-600">{state.message}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-5 py-2.5 font-medium disabled:opacity-50"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
