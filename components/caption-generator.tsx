"use client";

import { useState } from "react";
import { postCaption, suggestCaption } from "@/app/actions";
import { CaptionDraft, safely } from "@/components/caption-draft";

// On an image's page: the AI suggests captions (as many tries as you like);
// only the one you choose to post is saved.
export function CaptionGenerator({ imageId }: { imageId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [steer, setSteer] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSuggest() {
    setError(null);
    setMessage(null);
    setLoading("✨ The AI is writing a caption…");
    const result = await safely(() => suggestCaption(imageId, steer, token));
    setLoading(null);
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
    const result = await safely(() => postCaption(token));
    setPosting(false);
    if (result?.error) return setError(result.error);
    setToken(null);
    setCaption(null);
    setMessage("Posted! Want another?");
  }

  return (
    <div className="flex flex-col gap-2">
      <CaptionDraft
        caption={caption}
        steer={steer}
        onSteerChange={setSteer}
        loading={loading}
        posting={posting}
        canSuggest
        error={error}
        postLabel="Post this caption"
        onSuggest={onSuggest}
        onPost={onPost}
      />
      {message && <p className="text-sm text-green-600">{message}</p>}
    </div>
  );
}
