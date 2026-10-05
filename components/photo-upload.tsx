"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { removeProfilePhoto, saveProfilePhoto } from "@/app/actions";
import { dismissProfileNudge } from "@/components/profile-nudge";
import { resizeImage } from "@/lib/image";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // the bucket's limit
const MAX_INPUT_BYTES = 25 * 1024 * 1024; // refuse huge files before decoding
const MAX_DIMENSION = 512; // plenty for an avatar shown at 96px

// Uploads straight from the browser to Supabase Storage, then saves only the
// URL in the profiles table. The file always goes to the same path, so a new
// upload replaces the old photo instead of piling up.
export function PhotoUpload({
  userId,
  hasPhoto,
}: {
  userId: string;
  hasPhoto: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("That file is too large. Please choose a photo under 25 MB.");
      return;
    }

    setPending(true);
    try {
      let image: Blob;
      try {
        image = await resizeImage(file, MAX_DIMENSION);
      } catch {
        setError("Couldn't read that image. Try a JPEG or PNG.");
        return;
      }
      if (image.size > MAX_UPLOAD_BYTES) {
        setError("That image is still too large after resizing.");
        return;
      }

      const supabase = createClient();
      const path = `${userId}/profile`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, image, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) {
        setError("Upload failed. Please try again.");
        return;
      }

      // Same path every time, so add a version so browsers don't show the old photo
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const result = await saveProfilePhoto(`${data.publicUrl}?v=${Date.now()}`);
      if (result?.error) setError(result.error);
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!confirm("Remove your profile photo?")) return;
    setError(null);
    setPending(true);
    const result = await removeProfilePhoto();
    if (result?.error) setError(result.error);
    else dismissProfileNudge(userId);
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="self-start rounded-full border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Working…" : "Upload new photo"}
      </button>
      {hasPhoto && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={pending}
          className="self-start text-sm text-red-500 underline underline-offset-4 disabled:opacity-50"
        >
          Remove photo
        </button>
      )}
      <p className="text-xs text-neutral-500">
        Any photo works; we&apos;ll resize it for you.
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
