import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  profile_photo_url: string | null;
  is_superadmin: boolean;
};

// The signed-in user (verified with Supabase via getUser(), not just read
// from the cookie) plus their profile row. Wrapped in cache() so the header
// and the page share one lookup per request.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, profile_photo_url, is_superadmin")
    .eq("id", user.id)
    .single<Profile>();

  return { user, profile };
});

export function hasName(profile: Profile | null) {
  return Boolean(profile?.first_name && profile?.last_name);
}

export function isSuperadmin(profile: Profile | null) {
  return Boolean(profile?.is_superadmin);
}
