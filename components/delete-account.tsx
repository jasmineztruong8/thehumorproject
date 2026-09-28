"use client";

import { useActionState, useState } from "react";
import { deleteAccount } from "@/app/actions";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteAccount, undefined);

  return (
    <section className="rounded-xl border border-red-300 dark:border-red-900 p-5 flex flex-col gap-3">
      <h2 className="font-semibold text-red-600 dark:text-red-400">Delete account</h2>
      <p className="text-sm text-neutral-500">
        Permanently deletes your profile, photo and votes. Jokes you submitted
        stay on the site without your name. This can&apos;t be undone.
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
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2"
            />
          </label>
          {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-red-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
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
          className="self-start rounded-full border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 px-4 py-2 text-sm font-medium"
        >
          Delete account…
        </button>
      )}
    </section>
  );
}
