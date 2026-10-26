import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { error } = await searchParams;

  return (
    <main className="flex-1 max-w-md w-full mx-auto px-6 py-24 flex flex-col items-center gap-6 text-center">
      <h1 className="text-3xl font-bold">Sign in</h1>
      <p className="text-dim">
        Sign in to upload photos, generate captions and vote.
      </p>
      {error === "not_allowed" ? (
        <p className="text-danger">
          New sign-ups are limited to approved email addresses right now, and
          this Google account isn&apos;t on the list.
        </p>
      ) : error ? (
        <p className="text-danger">Sign-in didn&apos;t work. Please try again.</p>
      ) : null}
      <GoogleSignInButton />
    </main>
  );
}
