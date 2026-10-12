"use client";

import { useActionState, useState } from "react";
import { deleteAccount } from "@/app/actions";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteAccount, undefined);

  return (
    <section className="panel border-danger p-5 flex flex-col gap-3">
      <h2 className="font-semibold text-danger">Delete account</h2>
      <p className="text-sm text-dim">
        Permanently deletes your profile, your photos, every caption you
        generated and your votes. This can&apos;t be undone.
      </p>
      {open ? (
        <form action={formAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm">
              Type <strong>DELETE</strong> to confirm
            </span>
            <input
              name="confirm"
              autoComplete="off"
              required
              className="field"
            />
          </label>
          {state?.error && <p className="text-sm text-danger">{state.error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending}
              className="btn-danger px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete my account"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm underline underline-offset-4"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start btn-secondary border-danger text-danger px-4 py-2 text-sm font-medium"
        >
          Delete account…
        </button>
      )}
    </section>
  );
}
