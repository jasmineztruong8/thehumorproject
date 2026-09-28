"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// First hop of the flow: app -> Google (via Supabase Auth).
export function GoogleSignInButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      // Must exactly match an entry in Supabase's Redirect URLs list
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={signIn}
        disabled={pending}
        className="rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-5 py-2.5 font-medium disabled:opacity-50"
      >
        {pending ? "Redirecting…" : "Sign in with Google"}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
