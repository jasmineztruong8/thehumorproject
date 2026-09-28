import { redirect } from "next/navigation";
import { getCurrentUser, hasName } from "@/lib/auth";
import { completeOnboarding } from "@/app/actions";
import { NameForm } from "@/components/name-form";

export default async function OnboardingPage() {
  const { user, profile } = await getCurrentUser();
  if (!user) redirect("/login");
  if (hasName(profile)) redirect("/");

  // Suggest the name from the Google account; the user still confirms it.
  const [googleFirst = "", ...googleRest] = String(
    user.user_metadata.full_name ?? "",
  ).split(" ");

  return (
    <main className="flex-1 max-w-md w-full mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-2">Welcome!</h1>
      <p className="text-neutral-500 mb-8">
        Before you get started, tell us your name.
      </p>
      <NameForm
        action={completeOnboarding}
        defaultFirstName={profile?.first_name ?? googleFirst}
        defaultLastName={profile?.last_name ?? googleRest.join(" ")}
        submitLabel="Continue"
      />
    </main>
  );
}
