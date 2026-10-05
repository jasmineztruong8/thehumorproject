"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AiUnavailableError, describeImage, writeCaption } from "@/lib/gemini";
import { cleanSteer } from "@/lib/prompts";
import { readDraft, signDraft, type CaptionDraft, type DraftCaption, type UploadDraft } from "@/lib/drafts";
import { addToLibrary } from "@/lib/library";
import { getMemeTemplate, searchMemeTemplates, type MemeTemplate } from "@/lib/memegen";
import { MEME_LIBRARY_ENABLED } from "@/lib/features";

export type FormState = { error?: string; message?: string } | undefined;

const MAX_NAME_LENGTH = 50;

// Every action looks up the user from the verified session. Row ids always
// come from here, never from form input, so users can only change their own
// data. RLS enforces the same rules again in the database.
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

const MAX_UPLOADS_PER_HOUR = 10;
const MAX_CAPTIONS_PER_HOUR = 20;
const MAX_LIBRARY_ADDS_PER_HOUR = 10;
const MAX_SUGGESTIONS_PER_DRAFT = 8;
const UPLOAD_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|gif)$/;

function hourAgo() {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Captions are generated from the image's saved description, so this is a
// cheap text-only call. Several users can caption the same image.
async function checkCaptionLimit(supabase: Supabase, userId: string): Promise<FormState> {
  const { count } = await supabase
    .from("captions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", hourAgo());
  if ((count ?? 0) >= MAX_CAPTIONS_PER_HOUR) {
    return { error: "You've hit the caption limit for this hour. Come back soon!" };
  }
}

function aiErrorMessage(e: unknown) {
  console.error("Gemini call failed", e);
  if (e instanceof AiUnavailableError) {
    return e.reason === "quota"
      ? "The AI has used up its free requests for today. Please try again tomorrow."
      : "The AI is busy right now. Please try again in a moment.";
  }
  return "Something went wrong with the AI. Please try again.";
}

function captionRow(imageId: string, userId: string, caption: DraftCaption) {
  return {
    image_id: imageId,
    user_id: userId,
    content: caption.content,
    user_prompt: caption.steer,
    prompt: caption.prompt,
    model: caption.model,
  };
}

// Asks the AI for a caption suggestion. Nothing is saved.
async function suggest(
  description: string,
  rawSteer: unknown,
  suggestionsSoFar: number,
): Promise<{ caption: DraftCaption } | { error: string }> {
  if (suggestionsSoFar >= MAX_SUGGESTIONS_PER_DRAFT) {
    return { error: "That's a lot of tries! Post one you like or start over." };
  }
  const steer = cleanSteer(rawSteer);
  try {
    const caption = await writeCaption(description, steer);
    return { caption: { ...caption, steer } };
  } catch (e) {
    return { error: aiErrorMessage(e) };
  }
}

export type DraftResult = { token?: string; caption?: string; description?: string; error?: string };

// Upload step 1. The photo is already in Storage (uploaded from the browser
// to images/<user id>/<random id>.jpg or .gif). The AI describes it, and the
// result comes back as a signed draft. Nothing is posted yet.
export async function startUpload(storagePath: string): Promise<DraftResult> {
  const { supabase, user } = await requireNamedUser();

  if (!UPLOAD_PATH.test(storagePath) || !storagePath.startsWith(`${user.id}/`)) {
    return { error: "Invalid upload." };
  }
  const fail = async (error: string) => {
    await supabase.storage.from("images").remove([storagePath]);
    return { error };
  };

  // Counts files (including drafts that were never posted), since each one
  // cost an AI call.
  const { data: recent } = await supabase.storage
    .from("images")
    .list(user.id, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  const since = Date.now() - 60 * 60 * 1000;
  const uploadsThisHour = (recent ?? []).filter((f) => f.created_at && Date.parse(f.created_at) > since).length;
  if (uploadsThisHour > MAX_UPLOADS_PER_HOUR) {
    return fail("You've hit the upload limit for this hour. Come back soon!");
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from("images")
    .download(storagePath);
  if (downloadError || !file) return fail("Couldn't find your upload. Please try again.");

  let described;
  try {
    described = await describeImage({
      data: Buffer.from(await file.arrayBuffer()),
      mimeType: storagePath.endsWith(".gif") ? "image/gif" : "image/jpeg",
    });
  } catch (e) {
    return fail(aiErrorMessage(e));
  }

  const draft: UploadDraft = {
    kind: "upload",
    userId: user.id,
    storagePath,
    description: described.description,
    descriptionPrompt: described.prompt,
    descriptionModel: described.model,
    animated: described.animated,
    caption: null,
    suggestions: 0,
    issuedAt: Date.now(),
  };
  return { token: signDraft(draft), description: draft.description };
}

// Upload step 2 (repeatable): suggest a caption, optionally about a topic.
export async function suggestUploadCaption(token: string, steer: string): Promise<DraftResult> {
  const { user } = await requireNamedUser();
  const draft = readDraft(token, "upload", user.id);
  if (!draft) return { error: "This draft expired. Please upload the photo again." };

  const result = await suggest(draft.description, steer, draft.suggestions);
  if ("error" in result) return result;

  const next: UploadDraft = { ...draft, caption: result.caption, suggestions: draft.suggestions + 1 };
  return { token: signDraft(next), caption: result.caption.content };
}

// Upload step 3: the user approved the photo and caption, so post both.
// Returns the new image's id; the browser then opens its page.
export async function publishUpload(token: string): Promise<{ imageId?: string; error?: string }> {
  const { supabase, user } = await requireNamedUser();
  const draft = readDraft(token, "upload", user.id);
  if (!draft) return { error: "This draft expired. Please upload the photo again." };
  if (!draft.caption) return { error: "Generate a caption first." };

  const limited = await checkCaptionLimit(supabase, user.id);
  if (limited) return limited;

  const { data: image, error } = await supabase
    .from("images")
    .insert({
      user_id: user.id,
      source: "upload",
      storage_path: draft.storagePath,
      image_url: supabase.storage.from("images").getPublicUrl(draft.storagePath).data.publicUrl,
      description: draft.description,
      description_prompt: draft.descriptionPrompt,
      description_model: draft.descriptionModel,
      is_animated: draft.animated,
    })
    .select("id")
    .single();
  if (error || !image) {
    // Already posted (e.g. a double click) — just open it
    const { data: existing } = await supabase
      .from("images")
      .select("id")
      .eq("storage_path", draft.storagePath)
      .maybeSingle();
    if (existing) return { imageId: existing.id };
    return { error: "Couldn't post your photo. Please try again." };
  }

  const { error: captionError } = await supabase
    .from("captions")
    .insert(captionRow(image.id, user.id, draft.caption));
  if (captionError) {
    await supabase.from("images").delete().eq("id", image.id);
    return { error: "Couldn't post your photo. Please try again." };
  }

  return { imageId: image.id };
}

// The user threw the draft away: remove the uploaded file.
export async function discardUpload(token: string): Promise<void> {
  const { supabase, user } = await requireNamedUser();
  const draft = readDraft(token, "upload", user.id);
  if (draft) await supabase.storage.from("images").remove([draft.storagePath]);
}

// On an image's page: suggest a caption (repeatable). Nothing is saved.
// Pass the previous draft token to keep count of tries.
export async function suggestCaption(
  imageId: string,
  steer: string,
  previousToken: string | null,
): Promise<DraftResult> {
  const { supabase, user } = await requireNamedUser();
  const previous = readDraft(previousToken, "caption", user.id);
  const suggestions = previous?.imageId === imageId ? previous.suggestions : 0;

  const { data: image } = await supabase
    .from("images")
    .select("id, description")
    .eq("id", imageId)
    .maybeSingle();
  if (!image) return { error: "That image doesn't exist anymore." };

  const result = await suggest(image.description, steer, suggestions);
  if ("error" in result) return result;

  const draft: CaptionDraft = {
    kind: "caption",
    userId: user.id,
    imageId,
    caption: result.caption,
    suggestions: suggestions + 1,
    issuedAt: Date.now(),
  };
  return { token: signDraft(draft), caption: result.caption.content };
}

// On an image's page: post the suggested caption the user approved.
export async function postCaption(token: string): Promise<FormState> {
  const { supabase, user } = await requireNamedUser();
  const draft = readDraft(token, "caption", user.id);
  if (!draft) return { error: "This caption expired. Please generate a new one." };

  const limited = await checkCaptionLimit(supabase, user.id);
  if (limited) return limited;

  const { error } = await supabase.from("captions").insert(captionRow(draft.imageId, user.id, draft.caption));
  if (error) return { error: "Couldn't post your caption. Please try again." };
  refresh();
  return { message: "Posted!" };
}

// RLS lets owners (and superadmins) delete; everyone else deletes 0 rows.
export async function deleteCaption(captionId: string): Promise<FormState> {
  const { supabase } = await requireNamedUser();

  const { data, error } = await supabase
    .from("captions")
    .delete()
    .eq("id", captionId)
    .select("id");

  if (error || !data?.length) return { error: "Couldn't delete that caption." };
  refresh();
}

// Deletes the image row (its captions and votes cascade), then the file.
// RLS: uploads by their owner, anything by a superadmin. From the image's own
// page, leave it (it no longer exists); from a list like the feed, stay put.
export async function deleteImage(imageId: string, stayOnPage = false): Promise<FormState> {
  const { supabase } = await requireNamedUser();

  const { data, error } = await supabase
    .from("images")
    .delete()
    .eq("id", imageId)
    .select("storage_path, source");

  if (error || !data?.length) return { error: "Couldn't delete that image." };
  await supabase.storage.from("images").remove([data[0].storage_path]);
  if (stayOnPage) {
    refresh();
    return;
  }
  redirect(data[0].source === "library" ? "/memes" : "/my");
}

// Searches the open-source memegen.link templates (all of them, not just
// the ones already in our library). An empty search lists everything.
export async function searchMemes(
  query: string,
  gifsOnly: boolean,
): Promise<{ results?: MemeTemplate[]; error?: string }> {
  await requireNamedUser();
  if (!MEME_LIBRARY_ENABLED) return { error: "The meme library isn't available yet." };
  try {
    return { results: await searchMemeTemplates(query.trim().slice(0, 100), gifsOnly) };
  } catch (e) {
    console.error("searchMemeTemplates failed", e);
    return { error: "Search isn't working right now. Please try again." };
  }
}

// Adds a memegen template to the meme library (copied into our Storage and
// described by AI), or opens it if it's already there.
export async function addMemeTemplate(templateId: string): Promise<FormState> {
  const { supabase, user } = await requireNamedUser();
  if (!MEME_LIBRARY_ENABLED) return { error: "The meme library isn't available yet." };

  const template = await getMemeTemplate(templateId);
  if (!template) return { error: "That template isn't available." };

  const { data: existing } = await supabase
    .from("images")
    .select("id")
    .like("storage_path", `library/memegen-${template.id}.%`)
    .maybeSingle();
  if (existing) redirect(`/images/${existing.id}`);

  const { count } = await supabase
    .from("images")
    .select("id", { count: "exact", head: true })
    .eq("added_by", user.id)
    .gte("created_at", hourAgo());
  if ((count ?? 0) >= MAX_LIBRARY_ADDS_PER_HOUR) {
    return { error: "You've added a lot this hour. Come back soon!" };
  }

  let image;
  try {
    image = await addToLibrary(
      { key: `memegen-${template.id}`, title: template.name, url: template.url, attribution: template.attribution },
      user.id,
    );
  } catch (e) {
    console.error("addToLibrary failed", e);
    return { error: "Couldn't add that one. Try a different template." };
  }
  redirect(`/images/${image.id}`);
}

// Upvote (1) or downvote (-1). Clicking the same arrow again removes the vote.
// The caption's score is updated by a database trigger on caption_votes.
export async function vote(captionId: string, value: 1 | -1): Promise<FormState> {
  const { supabase, user } = await requireNamedUser();
  if (value !== 1 && value !== -1) return { error: "Invalid vote." };

  const { data: existing } = await supabase
    .from("caption_votes")
    .select("value")
    .eq("user_id", user.id)
    .eq("caption_id", captionId)
    .maybeSingle();

  const { error } =
    existing?.value === value
      ? await supabase
          .from("caption_votes")
          .delete()
          .eq("user_id", user.id)
          .eq("caption_id", captionId)
      : await supabase
          .from("caption_votes")
          .upsert(
            { user_id: user.id, caption_id: captionId, value },
            { onConflict: "user_id,caption_id" },
          );

  if (error) return { error: "Couldn't save your vote. Please try again." };
  refresh();
}

// Storage files aren't covered by the database cascade, so remove them
// first, through the Storage API (RLS: the owner or a superadmin).
async function removeUserFiles(supabase: Supabase, userId: string) {
  const { data: files } = await supabase.storage
    .from("images")
    .list(userId, { limit: 1000 });
  if (files?.length) {
    await supabase.storage
      .from("images")
      .remove(files.map((f) => `${userId}/${f.name}`));
  }
  await supabase.storage.from("avatars").remove([`${userId}/profile`]);
}

// Deleting the profile row deletes the login (trigger) and cascades to
// everything the user made. RLS only allows it for the owner or a superadmin.
async function deleteProfile(supabase: Supabase, userId: string) {
  await removeUserFiles(supabase, userId);
  const { data, error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId)
    .select("id");
  return !error && Boolean(data?.length);
}

export async function adminDeleteUser(userId: string): Promise<FormState> {
  const { supabase, user } = await requireNamedUser();
  if (userId === user.id) {
    return { error: "Delete your own account from your profile page." };
  }
  if (!(await deleteProfile(supabase, userId))) {
    return { error: "Couldn't delete that user." };
  }
  refresh();
}

// Permanently deletes the signed-in user's account and everything they made.
export async function deleteAccount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireUser();

  if (formData.get("confirm") !== "DELETE") {
    return { error: 'Type DELETE to confirm.' };
  }

  if (!(await deleteProfile(supabase, user.id))) {
    return { error: "Couldn't delete your account. Please try again." };
  }

  // The session no longer exists on the server, so just clear local cookies.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
