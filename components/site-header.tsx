import Link from "next/link";
import { getCurrentUser, hasName, isSuperadmin } from "@/lib/auth";
import { MEME_LIBRARY_ENABLED } from "@/lib/features";
import { signOut } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { MembersOnlyButton } from "@/components/members-only-button";
import { ProfileNudge } from "@/components/profile-nudge";

export async function SiteHeader() {
  const { user, profile } = await getCurrentUser();

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <nav className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="font-bold">
          The Humor Project
        </Link>
        <div className="flex items-center gap-3 sm:gap-4 text-sm">
          {MEME_LIBRARY_ENABLED && (
            <Link href="/memes" className="underline underline-offset-4">
              Memes
            </Link>
          )}
          {user ? (
            <>
              <Link href="/submit" className="underline underline-offset-4">
                Upload
              </Link>
              <Link href="/my" className="underline underline-offset-4">
                Mine
              </Link>
              {isSuperadmin(profile) && (
                <Link href="/admin" className="underline underline-offset-4">
                  Admin
                </Link>
              )}
              <Link href="/profile" className="flex items-center gap-2">
                <Avatar
                  url={profile?.profile_photo_url ?? null}
                  firstName={profile?.first_name ?? null}
                  lastName={profile?.last_name ?? null}
                  size={28}
                />
                <span className="hidden sm:inline">{profile?.first_name ?? "Profile"}</span>
              </Link>
              <form action={signOut}>
                <button type="submit" className="underline underline-offset-4">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <MembersOnlyButton
                label="Upload (members only)"
                className="flex items-center gap-1 text-neutral-400 dark:text-neutral-600 cursor-pointer"
              >
                <span aria-hidden>🔒</span> Upload
              </MembersOnlyButton>
              <Link href="/login" className="underline underline-offset-4">
                Sign in
              </Link>
            </>
          )}
        </div>
      </nav>
      {user && hasName(profile) && !profile?.profile_photo_url && (
        <ProfileNudge userId={user.id} />
      )}
    </header>
  );
}
