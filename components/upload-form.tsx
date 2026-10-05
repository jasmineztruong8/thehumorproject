"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { discardUpload, publishUpload, startUpload, suggestUploadCaption } from "@/app/actions";
import { AiLoading, CaptionDraft, safely } from "@/components/caption-draft";
import { createClient } from "@/lib/supabase/client";
import { resizeImage } from "@/lib/image";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // the bucket's limit
const MAX_INPUT_BYTES = 25 * 1024 * 1024; // refuse huge files before decoding
const MAX_DIMENSION = 1280;

type Stage = "uploading" | "describing" | "ready" | "failed";

// Upload flow: choose a photo or GIF → it goes straight from the browser to
// Storage (images/<user id>/<id>.jpg or .gif) → the AI describes it → the AI
// suggests captions you can steer and retry → nothing is posted until you
// press Post. Photos are resized to JPEG; GIFs are uploaded as-is so they
// stay animated (a canvas would keep only the first frame).
//
// As soon as a file is chosen the whole draft (photo, description, topic,
// caption) is shown, with loading placeholders while the AI works.
export function UploadForm({ userId }: { userId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isGif, setIsGif] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [steer, setSteer] = useState("");
  const steerRef = useRef(steer); // read the latest topic after the description arrives
  const [captionLoading, setCaptionLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeSteer(value: string) {
    setSteer(value);
    steerRef.current = value;
  }

  function reset() {
    setPreview(null);
    setStage(null);
    setToken(null);
    setDescription(null);
    setCaption(null);
    setError(null);
  }

  function failed(message: string) {
    setStage("failed");
    setError(message);
  }

  async function handleFile(file: File) {
    reset();
    if (!file.type.startsWith("image/")) return setError("Please choose an image file.");
    if (file.size > MAX_INPUT_BYTES) return setError("That file is too large. Please choose a photo under 25 MB.");

    const gif = file.type === "image/gif";
    setIsGif(gif);
    setPreview(URL.createObjectURL(file));
    setStage("uploading");
    if (inputRef.current) inputRef.current.value = "";

    let image: Blob = file;
    if (gif) {
      if (file.size > MAX_UPLOAD_BYTES) return failed("GIFs must be under 5 MB.");
    } else {
      try {
        image = await resizeImage(file, MAX_DIMENSION);
      } catch {
        return failed("Couldn't read that image. Try a JPEG, PNG or GIF.");
      }
      if (image.size > MAX_UPLOAD_BYTES) return failed("That image is still too large after resizing.");
    }

    const path = `${userId}/${crypto.randomUUID()}.${gif ? "gif" : "jpg"}`;
    const { error: uploadError } = await createClient()
      .storage.from("images")
      .upload(path, image, { contentType: gif ? "image/gif" : "image/jpeg" });
    if (uploadError) return failed("Upload failed. Please try again.");

    setStage("describing");
    const described = await safely(() => startUpload(path));
    if (!("token" in described) || !described.token) {
      return failed(described.error ?? "Something went wrong. Please try again.");
    }
    setToken(described.token);
    setDescription(described.description ?? null);
    setStage("ready");

    // First suggestion right away, using any topic picked while waiting
    await suggest(described.token);
  }

  async function suggest(currentToken = token) {
    if (!currentToken) return;
    setError(null);
    setCaptionLoading(true);
    const result = await safely(() => suggestUploadCaption(currentToken, steerRef.current));
    setCaptionLoading(false);
    if ("token" in result && result.token && result.caption) {
      setToken(result.token);
      setCaption(result.caption);
    } else {
      setError(result.error ?? "Something went wrong. Please try again.");
    }
  }

  async function onPost() {
    if (!token) return;
    setError(null);
    setPosting(true);
    const result = await safely(() => publishUpload(token));
    if ("imageId" in result && result.imageId) {
      router.push(`/images/${result.imageId}`);
      return; // keep "Posting…" until the page changes
    }
    setPosting(false);
    setError(result.error ?? "Something went wrong. Please try again.");
  }

  async function onDiscard() {
    if (token) await safely(() => discardUpload(token));
    reset();
  }

  const fileInput = (
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
  );

  if (!preview) {
    return (
      <div className="flex flex-col gap-4">
        {fileInput}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 p-10 flex flex-col items-center gap-3 text-center"
        >
          <span className="text-4xl" aria-hidden>📸</span>
          <span className="font-medium">Choose a photo</span>
          <span className="text-sm text-neutral-500">
            Your dorm, the subway, your roommate&apos;s cooking. Photos or GIFs (up to 5 MB).
            Nothing is posted until you approve a caption.
          </span>
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  const thing = isGif ? "GIF" : "photo";
  const describingLabel =
    stage === "uploading" ? `Uploading your ${thing}…` : `✨ The AI is studying your ${thing}…`;
  const captionLabel =
    stage === "ready" ? "✨ The AI is writing a caption…" : "Waiting for the AI to finish looking…";

  return (
    <div className="flex flex-col gap-6">
      {fileInput}
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
        <img src={preview} alt={`Your ${thing}`} className="w-full max-h-[28rem] object-contain bg-neutral-100 dark:bg-neutral-900" />
        <div className="p-4 text-sm">
          {description ? (
            <details>
              <summary className="cursor-pointer text-neutral-500">What the AI sees</summary>
              <p className="mt-2 text-neutral-500">{description}</p>
            </details>
          ) : stage === "failed" ? (
            <p className="text-neutral-500">The AI couldn&apos;t look at this one.</p>
          ) : (
            <AiLoading label={describingLabel} lines={3} />
          )}
        </div>
      </section>

      {stage === "failed" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-red-500">{error}</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="self-start rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-5 py-2.5 font-medium"
          >
            Try again with a photo
          </button>
        </div>
      ) : (
        <CaptionDraft
          caption={caption}
          steer={steer}
          onSteerChange={changeSteer}
          loading={stage !== "ready" || captionLoading ? captionLabel : null}
          posting={posting}
          canSuggest={stage === "ready"}
          error={error}
          postLabel={`Post ${thing} with this caption`}
          onSuggest={() => suggest()}
          onPost={onPost}
        />
      )}

      <button
        type="button"
        onClick={onDiscard}
        disabled={posting}
        className="self-start text-sm text-neutral-500 underline underline-offset-4 disabled:opacity-50"
      >
        {stage === "failed" ? "Start over" : "Discard and start over"}
      </button>
    </div>
  );
}
