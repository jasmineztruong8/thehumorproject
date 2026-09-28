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
  const { supabase, user } = await requireUser();

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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
