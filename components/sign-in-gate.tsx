import { GoogleSignInButton } from "@/components/google-sign-in-button";

// What a signed-out visitor sees on a gated route.
export function SignInGate({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-10 flex flex-col items-center gap-4 text-center">
      <span className="text-4xl" aria-hidden>
        🔒
      </span>
      <h2 className="text-xl font-semibold">Members only</h2>
      <p className="text-neutral-500">{message}</p>
      <GoogleSignInButton />
    </div>
  );
}
