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
          className="field"
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
          className="field"
        />
      </label>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.message && (
        <p className="text-sm text-ok">{state.message}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start btn-primary px-5 py-2.5 font-medium disabled:opacity-50"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
