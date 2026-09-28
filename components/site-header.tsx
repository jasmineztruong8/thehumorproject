import Link from "next/link";
import { getCurrentUser, hasName } from "@/lib/auth";
import { signOut } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { ProfileNudge } from "@/components/profile-nudge";

export async function SiteHeader() {
  const { user, profile } = await getCurrentUser();

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <nav className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="font-bold">
          The Humor Project
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/submit" className="underline underline-offset-4">
            Submit
          </Link>
          {user ? (
            <>
              <Link href="/profile" className="flex items-center gap-2">
                <Avatar
                  url={profile?.profile_photo_url ?? null}
                  firstName={profile?.first_name ?? null}
                  lastName={profile?.last_name ?? null}
                  size={28}
                />
                <span>{profile?.first_name ?? "Profile"}</span>
              </Link>
              <form action={signOut}>
                <button type="submit" className="underline underline-offset-4">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="underline underline-offset-4">
              Sign in
            </Link>
          )}
        </div>
      </nav>
      {user && hasName(profile) && !profile?.profile_photo_url && (
        <ProfileNudge userId={user.id} />
      )}
    </header>
  );
}
