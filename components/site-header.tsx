import Link from "next/link";
import { getCurrentUser, hasName, isSuperadmin } from "@/lib/auth";
import { MEME_LIBRARY_ENABLED } from "@/lib/features";
import { signOut } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { MembersOnlyButton } from "@/components/members-only-button";
import { NavLink } from "@/components/nav-link";
import { PixelIcon, SunOrMoon } from "@/components/pixel-icon";
import { ProfileNudge } from "@/components/profile-nudge";

export async function SiteHeader() {
  const { user, profile } = await getCurrentUser();

  return (
    <header className="bg-card border-b-2 border-line">
      <nav className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/" aria-label="The Humor Project" className="flex items-center gap-2 font-pixel text-lg font-bold whitespace-nowrap">
          <SunOrMoon size={28} />
          <span className={user ? "hidden sm:inline" : undefined}>The Humor Project</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-4 text-sm">
          {user ? (
            <>
              <NavLink href="/submit" className="btn-primary px-3 py-1 text-sm">
                <PixelIcon name="plus" size={12} /> Upload
              </NavLink>
              {MEME_LIBRARY_ENABLED && <NavLink href="/memes">Memes</NavLink>}
              {isSuperadmin(profile) && (
                <NavLink href="/admin">Admin</NavLink>
              )}
              <Link href="/profile" title="Your profile" className="flex items-center gap-2">
                <Avatar
                  url={profile?.profile_photo_url ?? null}
                  firstName={profile?.first_name ?? null}
                  lastName={profile?.last_name ?? null}
                  size={28}
                />
                <span className="hidden sm:inline">{profile?.first_name ?? "Profile"}</span>
              </Link>
              <form action={signOut} className="flex">
                <button
                  type="submit"
                  aria-label="Sign out"
                  title="Sign out"
                  className="-mx-2 flex h-10 w-10 cursor-pointer items-center justify-center text-dim hover:text-danger"
                >
                  <PixelIcon name="exit" size={16} />
                </button>
              </form>
            </>
          ) : (
            <>
              <MembersOnlyButton
                label="Upload (members only)"
                className="flex items-center gap-1 text-dim cursor-pointer"
              >
                <PixelIcon name="lock" size={12} /> Upload
              </MembersOnlyButton>
              {MEME_LIBRARY_ENABLED && <NavLink href="/memes">Memes</NavLink>}
              <NavLink href="/login">Sign in</NavLink>
            </>
          )}
        </div>
      </nav>
      <div className="stripe" aria-hidden />
      {user && hasName(profile) && !profile?.profile_photo_url && (
        <ProfileNudge userId={user.id} />
      )}
    </header>
  );
}
