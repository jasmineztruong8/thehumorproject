import { redirect } from "next/navigation";
import { getCurrentUser, hasName } from "@/lib/auth";
import { SignInGate } from "@/components/sign-in-gate";
import { JokeForm } from "@/components/joke-form";

// Gated route: signed-out visitors see a lock screen, signed-in users
// see the submit form (after they've added their name).
export default async function SubmitPage() {
  const { user, profile } = await getCurrentUser();
  if (user && !hasName(profile)) redirect("/onboarding");

  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-2">Submit a joke</h1>
      <p className="text-neutral-500 mb-10">
        Think you&apos;re funny? Prove it.
      </p>
      {user ? (
        <JokeForm />
      ) : (
        <SignInGate message="Sign in with Google to submit your own jokes." />
      )}
    </main>
  );
}
