"use client";

import { useEffect } from "react";

// Shown instead of any page that crashes unexpectedly. The details go to the
// browser console and server logs, never onto the page.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex-1 max-w-md w-full mx-auto px-6 py-24 flex flex-col items-center gap-4 text-center">
      <span className="text-4xl" aria-hidden>😵‍💫</span>
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-neutral-500">That&apos;s not you, it&apos;s us. Please try again.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-5 py-2.5 font-medium"
      >
        Try again
      </button>
    </main>
  );
}
