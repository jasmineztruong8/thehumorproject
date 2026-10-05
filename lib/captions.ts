import type { createClient } from "@/lib/supabase/server";
import type { Author } from "@/lib/display-name";

export type Caption = {
  id: string;
  content: string;
  score: number;
  user_prompt: string | null;
  created_at: string;
  user_id: string;
  // null for signed-out visitors: RLS hides profiles from them
  profiles: Author;
};

// Columns to select for a caption, including its author's name.
export const CAPTION_FIELDS =
  "id, content, score, user_prompt, created_at, user_id, profiles!captions_user_id_fkey(first_name, last_name)";

// The signed-in user's votes on these captions, so their arrows show as
// selected. RLS only ever returns the user's own votes.
export async function getMyVotes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string | undefined,
  captionIds: string[],
) {
  const votes = new Map<string, 1 | -1>();
  if (!userId || !captionIds.length) return votes;
  const { data } = await supabase
    .from("caption_votes")
    .select("caption_id, value")
    .eq("user_id", userId)
    .in("caption_id", captionIds);
  data?.forEach((v) => votes.set(v.caption_id, v.value));
  return votes;
}
