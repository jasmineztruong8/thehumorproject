"use client";

import { useRef, type ReactNode } from "react";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

// A button for signed-out visitors that opens a "members only" popup with
// a Google sign-in button, used wherever a signed-in feature is shown.
export function MembersOnlyButton({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => dialogRef.current?.showModal()}
        className={className}
      >
        {children}
      </button>
      <dialog
        ref={dialogRef}
        // Clicking the dark backdrop (the dialog element itself) closes it
        onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 p-0 backdrop:bg-black/60"
      >
        <div className="p-8 flex flex-col items-center gap-4 text-center">
          <span className="text-4xl" aria-hidden>
            🔒
          </span>
          <h2 className="text-xl font-semibold">Members only</h2>
          <p className="text-neutral-500">
            Sign in to upload photos, generate AI captions and vote on your
            favorites.
          </p>
          <GoogleSignInButton />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="text-sm text-neutral-500 underline underline-offset-4"
          >
            Not now
          </button>
        </div>
      </dialog>
    </>
  );
}
