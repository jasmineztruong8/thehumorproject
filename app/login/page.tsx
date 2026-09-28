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
      <p className="text-neutral-500">
        Sign in to submit jokes and set up your profile.
      </p>
      {error && (
        <p className="text-red-500">Sign-in didn&apos;t work. Please try again.</p>
      )}
      <GoogleSignInButton />
    </main>
  );
}
