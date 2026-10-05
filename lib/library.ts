import "server-only";
import { describeImage } from "@/lib/gemini";
import { normalizeStill } from "@/lib/media";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BYTES = 5 * 1024 * 1024; // the images bucket's limit
const HEADERS = { "User-Agent": "TheHumorProject/1.0 (class project)" };

export type LibraryItem = {
  key: string; // stable id from the source, e.g. "memegen-drake"
  title: string;
  url: string;
  attribution: string;
};

// Copies an image from an open source into our Storage (library/ folder),
// describes it with AI once, and adds it to the meme library. Uses the
// service role because RLS doesn't let users write library rows themselves.
// Returns the existing image if it was added before.
export async function addToLibrary(item: LibraryItem, addedBy: string | null) {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("images")
    .select("id")
    .like("storage_path", `library/${item.key}.%`)
    .maybeSingle();
  if (existing) return { id: existing.id as string, added: false };

  const res = await fetch(item.url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const type = res.headers.get("content-type")?.split(";")[0] ?? "";
  if (!type.startsWith("image/")) throw new Error(`Not an image: ${type}`);
  const original = Buffer.from(await res.arrayBuffer());

  const isGif = type === "image/gif";
  const data = isGif ? original : await normalizeStill(original);
  if (data.length > MAX_BYTES) throw new Error("Image is larger than 5 MB");
  const mimeType = isGif ? "image/gif" : "image/jpeg";
  const path = `library/${item.key}.${isGif ? "gif" : "jpg"}`;

  const described = await describeImage({ data, mimeType });

  const { error: uploadError } = await admin.storage
    .from("images")
    .upload(path, data, { contentType: mimeType, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: image, error } = await admin
    .from("images")
    .insert({
      source: "library",
      storage_path: path,
      image_url: admin.storage.from("images").getPublicUrl(path).data.publicUrl,
      title: item.title,
      attribution: item.attribution,
      description: described.description,
      description_prompt: described.prompt,
      description_model: described.model,
      is_animated: described.animated,
      added_by: addedBy,
    })
    .select("id")
    .single();
  if (error || !image) {
    await admin.storage.from("images").remove([path]);
    throw new Error(error?.message ?? "Insert failed");
  }
  return { id: image.id as string, added: true };
}
