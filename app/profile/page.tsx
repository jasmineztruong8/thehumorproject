import { redirect } from "next/navigation";
import { getCurrentUser, hasName } from "@/lib/auth";
import { updateProfile } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { DeleteAccount } from "@/components/delete-account";
import { NameForm } from "@/components/name-form";
import { PhotoUpload } from "@/components/photo-upload";
import { SignInGate } from "@/components/sign-in-gate";

export default async function ProfilePage() {
  const { user, profile } = await getCurrentUser();
  if (user && !hasName(profile)) redirect("/onboarding");

  return (
    <main className="flex-1 max-w-md w-full mx-auto px-6 py-16 flex flex-col gap-10">
      <h1 className="text-3xl font-bold">Your profile</h1>

      {!user ? (
        <SignInGate message="Sign in with Google to set up your profile." />
      ) : (
        <>
          <section className="flex items-center gap-6">
            <Avatar
              url={profile?.profile_photo_url ?? null}
              firstName={profile?.first_name ?? null}
              lastName={profile?.last_name ?? null}
              size={96}
            />
            <PhotoUpload
              userId={user.id}
              hasPhoto={Boolean(profile?.profile_photo_url)}
            />
          </section>

          <section className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Email</span>
              <input
                value={user.email ?? ""}
                readOnly
                disabled
                className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 px-3 py-2 text-neutral-500"
              />
              <span className="text-xs text-neutral-500">
                From your Google account.
              </span>
            </label>
            <NameForm
              action={updateProfile}
              defaultFirstName={profile?.first_name ?? ""}
              defaultLastName={profile?.last_name ?? ""}
              submitLabel="Save changes"
            />
          </section>

          <DeleteAccount />
        </>
      )}
    </main>
  );
}
