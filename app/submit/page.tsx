import { redirect } from "next/navigation";
import { getCurrentUser, hasName } from "@/lib/auth";
import { SignInGate } from "@/components/sign-in-gate";
import { UploadForm } from "@/components/upload-form";

// Describing the photo and writing the first caption calls Gemini twice.
export const maxDuration = 60;

// Gated route: signed-out visitors see a lock screen, signed-in users
// see the upload form (after they've added their name).
export default async function SubmitPage() {
  const { user, profile } = await getCurrentUser();
  if (user && !hasName(profile)) redirect("/onboarding");

  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Upload a photo</h1>
      <p className="text-neutral-500 mb-10">
        AI looks at your photo, writes a caption, and everyone votes on it.
      </p>
      {user ? (
        <UploadForm userId={user.id} />
      ) : (
        <SignInGate message="Sign in with Google to upload photos and get AI captions." />
      )}
    </main>
  );
}
