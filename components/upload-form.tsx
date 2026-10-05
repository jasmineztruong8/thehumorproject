"use client";

import { useRef, useState } from "react";
import { createImage } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { resizeImage } from "@/lib/image";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // the bucket's limit
const MAX_INPUT_BYTES = 25 * 1024 * 1024; // refuse huge files before decoding
const MAX_DIMENSION = 1280;

// Uploads straight from the browser to Storage (images/<user id>/<id>.jpg or
// .gif), then asks the server to describe it with AI and write the first
// caption. Photos are resized to JPEG; GIFs are uploaded as-is so they stay
// animated (resizing through a canvas would keep only the first frame).
export function UploadForm({ userId }: { userId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Please choose an image file.");
    if (file.size > MAX_INPUT_BYTES) return setError("That file is too large. Please choose a photo under 25 MB.");

    setPreview(URL.createObjectURL(file));
    setStep("Uploading…");
    try {
      const isGif = file.type === "image/gif";
      let image: Blob = file;
      if (isGif) {
        if (file.size > MAX_UPLOAD_BYTES) return setError("GIFs must be under 5 MB.");
      } else {
        try {
          image = await resizeImage(file, MAX_DIMENSION);
        } catch {
          return setError("Couldn't read that image. Try a JPEG, PNG or GIF.");
        }
        if (image.size > MAX_UPLOAD_BYTES) return setError("That image is still too large after resizing.");
      }

      const path = `${userId}/${crypto.randomUUID()}.${isGif ? "gif" : "jpg"}`;
      const { error: uploadError } = await createClient()
        .storage.from("images")
        .upload(path, image, { contentType: isGif ? "image/gif" : "image/jpeg" });
      if (uploadError) return setError("Upload failed. Please try again.");

      setStep(isGif ? "The AI is watching your GIF and writing a caption…" : "The AI is studying your photo and writing a caption…");
      // On success the action redirects to the image's page
      const result = await createImage(path);
      if (result?.error) setError(result.error);
    } finally {
      setStep(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4">
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
        disabled={Boolean(step)}
        className="rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 p-10 flex flex-col items-center gap-3 text-center disabled:opacity-60"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img src={preview} alt="Your photo" className="max-h-72 rounded-lg" />
        ) : (
          <span className="text-4xl" aria-hidden>📸</span>
        )}
        <span className="font-medium">{step ?? (preview ? "Choose a different photo" : "Choose a photo")}</span>
        <span className="text-sm text-neutral-500">
          Your dorm, the subway, your roommate&apos;s cooking. Photos or GIFs (up to 5 MB).
        </span>
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
