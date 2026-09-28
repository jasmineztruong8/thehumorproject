"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string } | undefined;

const MAX_NAME_LENGTH = 50;
const MAX_JOKE_LENGTH = 280;

// Every action looks up the user from the verified session. Row ids always
// come from here, never from form input, so users can only change their own
// data (RLS is off until a later assignment, so this check is what protects it).
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Like requireUser, but also sends users who skipped onboarding back to it.
async function requireNamedUser() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();
  if (!profile?.first_name || !profile?.last_name) redirect("/onboarding");
  return { supabase, user };
}

function readName(formData: FormData) {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();

  if (!firstName || !lastName) {
    return { error: "Please enter both your first and last name." };
  }
  if (firstName.length > MAX_NAME_LENGTH || lastName.length > MAX_NAME_LENGTH) {
    return { error: `Names must be ${MAX_NAME_LENGTH} characters or fewer.` };
  }
  return { firstName, lastName };
}

async function saveName(formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();

  const name = readName(formData);
  if ("error" in name) return name;

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: name.firstName,
      last_name: name.lastName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { error: "Couldn't save your name. Please try again." };
}

export async function completeOnboarding(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = await saveName(formData);
  if (result?.error) return result;
  redirect("/");
}

export async function updateProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = await saveName(formData);
  if (result?.error) return result;
  refresh();
  return { message: "Saved!" };
}

// The photo itself is uploaded from the browser straight to Storage
// (avatars/<user id>/profile). This only records its public URL.
export async function saveProfilePhoto(url: string): Promise<FormState> {
  const { supabase, user } = await requireUser();

  const expectedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.id}/`;
  if (!url.startsWith(expectedPrefix)) {
    return { error: "Invalid photo URL." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ profile_photo_url: url, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: "Couldn't save your photo. Please try again." };
  refresh();
}

// Deletes the stored file and clears the URL, so the initials avatar shows.
export async function removeProfilePhoto(): Promise<FormState> {
  const { supabase, user } = await requireUser();

  const { error: storageError } = await supabase.storage
    .from("avatars")
    .remove([`${user.id}/profile`]);
  if (storageError) return { error: "Couldn't remove your photo. Please try again." };

  const { error } = await supabase
    .from("profiles")
    .update({ profile_photo_url: null, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: "Couldn't remove your photo. Please try again." };
  refresh();
}

export async function submitJoke(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireNamedUser();

  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { error: "Your joke is empty." };
  if (content.length > MAX_JOKE_LENGTH) {
    return { error: `Keep it under ${MAX_JOKE_LENGTH} characters.` };
  }

  const { error } = await supabase
    .from("jokes")
    .insert({ content, user_id: user.id });

  if (error) return { error: "Couldn't submit your joke. Please try again." };
  redirect("/");
}

// Deletes one of the signed-in user's own jokes (its votes go with it).
// Matching on user_id too means nobody can delete someone else's joke.
export async function deleteJoke(jokeId: string): Promise<FormState> {
  const { supabase, user } = await requireNamedUser();

  const { data, error } = await supabase
    .from("jokes")
    .delete()
    .eq("id", jokeId)
    .eq("user_id", user.id)
    .select("id");

  if (error || !data?.length) {
    return { error: "Couldn't delete that joke." };
  }
  refresh();
}

// Upvote (1) or downvote (-1). Clicking the same arrow again removes the vote.
// The joke's score is updated by a database trigger on the votes table.
export async function vote(jokeId: string, value: 1 | -1): Promise<FormState> {
  const { supabase, user } = await requireNamedUser();
  if (value !== 1 && value !== -1) return { error: "Invalid vote." };

  const { data: existing } = await supabase
    .from("votes")
    .select("value")
    .eq("user_id", user.id)
    .eq("joke_id", jokeId)
    .maybeSingle();

  const { error } =
    existing?.value === value
      ? await supabase
          .from("votes")
          .delete()
          .eq("user_id", user.id)
          .eq("joke_id", jokeId)
      : await supabase
          .from("votes")
          .upsert(
            { user_id: user.id, joke_id: jokeId, value },
            { onConflict: "user_id,joke_id" },
          );

  if (error) return { error: "Couldn't save your vote. Please try again." };
  refresh();
}

// Permanently deletes the signed-in user's account. Their profile row goes
// with it (cascade); their jokes stay on the site without an author.
export async function deleteAccount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();

  if (formData.get("confirm") !== "DELETE") {
    return { error: 'Type DELETE to confirm.' };
  }

  // Remove the photo file first; once the user is gone they can't touch Storage.
  await supabase.storage.from("avatars").remove([`${user.id}/profile`]);

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: "Couldn't delete your account. Please try again." };

  // The session no longer exists on the server, so just clear local cookies.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
