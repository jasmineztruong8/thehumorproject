import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { PixelIcon } from "@/components/pixel-icon";

// What a signed-out visitor sees on a gated route.
export function SignInGate({ message }: { message: string }) {
  return (
    <div className="panel p-10 flex flex-col items-center gap-4 text-center">
      <span className="text-4xl" aria-hidden>
        <PixelIcon name="lock" size={36} />
      </span>
      <h2 className="text-xl font-semibold">Members only</h2>
      <p className="text-dim">{message}</p>
      <GoogleSignInButton />
    </div>
  );
}
