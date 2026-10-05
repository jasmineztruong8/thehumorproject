import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteImage } from "@/app/actions";
import { getCurrentUser, hasName, isSuperadmin } from "@/lib/auth";
import { CAPTION_FIELDS, getMyVotes, type Caption } from "@/lib/captions";
import { createAuthorLabeler, type Author } from "@/lib/display-name";
import { MEME_LIBRARY_ENABLED } from "@/lib/features";
import { CaptionGenerator } from "@/components/caption-generator";
import { CaptionItem } from "@/components/caption-item";
import { DeleteButton } from "@/components/delete-button";
import { MembersOnlyButton } from "@/components/members-only-button";
import { StoredImage } from "@/components/stored-image";

export const dynamic = "force-dynamic";

// Generating a caption calls Gemini, which can take a few seconds.
export const maxDuration = 60;

type ImageDetail = {
  id: string;
  image_url: string;
  title: string | null;
  attribution: string | null;
  source: "upload" | "library";
  description: string;
  user_id: string | null;
  profiles: Author;
  captions: Caption[];
};

export default async function ImagePage({ params }: PageProps<"/images/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, profile } = await getCurrentUser();
  if (user && !hasName(profile)) redirect("/onboarding");

  const { data: image } = await supabase
    .from("images")
    .select(
      `id, image_url, title, attribution, source, description, user_id,
       profiles!images_user_id_fkey(first_name, last_name),
       captions(${CAPTION_FIELDS})`,
    )
    .eq("id", id)
    .order("score", { referencedTable: "captions", ascending: false })
    .order("created_at", { referencedTable: "captions", ascending: false })
    .maybeSingle<ImageDetail>();
  if (!image) notFound();
  if (image.source === "library" && !MEME_LIBRARY_ENABLED) notFound();

  const label = createAuthorLabeler(Boolean(user));
  const uploader = label(image.user_id, image.profiles);
  const myVotes = await getMyVotes(supabase, user?.id, image.captions.map((c) => c.id));
  const admin = isSuperadmin(profile);

  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col gap-8">
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <StoredImage src={image.image_url} alt={image.title ?? image.description} />
        <div className="p-5 flex flex-col gap-2 text-sm text-neutral-500">
          <div className="flex flex-wrap justify-between gap-2">
            <span>
              {image.source === "library"
                ? `Meme template${image.title ? `: ${image.title}` : ""}`
                : `Uploaded by ${uploader}`}
            </span>
            {(image.user_id === user?.id || admin) && (
              <DeleteButton
                action={deleteImage.bind(null, image.id)}
                confirmText={`Delete this ${image.source === "library" ? "template" : "photo"} and every caption on it?`}
                label="Delete photo"
              />
            )}
          </div>
          {image.attribution && <span className="text-xs">{image.attribution}</span>}
          <details>
            <summary className="cursor-pointer">What the AI sees</summary>
            <p className="mt-2">{image.description}</p>
          </details>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Caption it</h2>
        {user ? (
          <CaptionGenerator imageId={image.id} />
        ) : (
          <MembersOnlyButton className="self-start rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-5 py-2.5 font-medium">
            🔒 Generate a caption
          </MembersOnlyButton>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">
          Captions <span className="text-neutral-500 font-normal">({image.captions.length})</span>
        </h2>
        {image.captions.length === 0 && (
          <p className="text-neutral-500">No captions yet. Be the first!</p>
        )}
        <ul className="flex flex-col gap-4">
          {image.captions.map((caption) => (
            <li key={caption.id} className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
              <CaptionItem
                caption={caption}
                author={label(caption.user_id, caption.profiles)}
                myVote={myVotes.get(caption.id) ?? null}
                signedIn={Boolean(user)}
                canDelete={caption.user_id === user?.id || admin}
              />
            </li>
          ))}
        </ul>
      </section>

      <Link href="/" className="text-sm text-neutral-500 underline underline-offset-4">
        ← Back to the feed
      </Link>
    </main>
  );
}
