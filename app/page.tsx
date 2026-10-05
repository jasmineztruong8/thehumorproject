import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasName, isSuperadmin } from "@/lib/auth";
import { CAPTION_FIELDS, getMyVotes, type Caption } from "@/lib/captions";
import { createAuthorLabeler, type Author } from "@/lib/display-name";
import { MEME_LIBRARY_ENABLED } from "@/lib/features";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { CaptionItem } from "@/components/caption-item";
import { DeleteButton } from "@/components/delete-button";
import { deleteImage } from "@/app/actions";
import { StoredImage } from "@/components/stored-image";

export const dynamic = "force-dynamic";

type FeedImage = {
  id: string;
  image_url: string;
  title: string | null;
  user_id: string | null;
  created_at: string;
  profiles: Author;
  top: Caption[];
  caption_count: { count: number }[];
};

type TopCaption = Caption & {
  images: { id: string; image_url: string; title: string | null };
};

const FEED_LIMIT = 30;

export default async function Home({ searchParams }: PageProps<"/">) {
  const supabase = await createClient();
  const { user, profile } = await getCurrentUser();
  if (user && !hasName(profile)) redirect("/onboarding");

  const sort = (await searchParams).sort === "top" ? "top" : "new";
  const label = createAuthorLabeler(Boolean(user));
  const canDelete = (userId: string) => user?.id === userId || isSuperadmin(profile);

  // "New": newest uploads, each with its best caption.
  // "Top": the highest-voted captions anywhere (uploads, and memes when enabled).
  const { data: images, error: imagesError } =
    sort === "new"
      ? await supabase
          .from("images")
          .select(
            `id, image_url, title, user_id, created_at,
             profiles!images_user_id_fkey(first_name, last_name),
             top:captions(${CAPTION_FIELDS}),
             caption_count:captions(count)`,
          )
          .eq("source", "upload")
          .order("created_at", { ascending: false })
          .order("score", { referencedTable: "top", ascending: false })
          .order("created_at", { referencedTable: "top", ascending: false })
          .limit(1, { referencedTable: "top" })
          .limit(FEED_LIMIT)
          .returns<FeedImage[]>()
      : { data: null, error: null };

  const { data: topCaptions, error: captionsError } =
    sort === "top"
      ? await supabase
          .from("captions")
          .select(`${CAPTION_FIELDS}, images!inner(id, image_url, title, source)`)
          // Library images are hidden while the meme library is switched off
          .in("images.source", MEME_LIBRARY_ENABLED ? ["upload", "library"] : ["upload"])
          .order("score", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(FEED_LIMIT)
          .returns<TopCaption[]>()
      : { data: null, error: null };

  const shownCaptions = [
    ...(images?.flatMap((i) => i.top) ?? []),
    ...(topCaptions ?? []),
  ];
  const myVotes = await getMyVotes(supabase, user?.id, shownCaptions.map((c) => c.id));
  const error = imagesError ?? captionsError;
  if (error) console.error("Loading the feed failed", error);

  const tab = (value: string, text: string) => (
    <Link
      href={value === "new" ? "/" : `/?sort=${value}`}
      className={`rounded-full px-4 py-1.5 text-sm font-medium ${
        sort === value
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
      }`}
    >
      {text}
    </Link>
  );

  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-12">
      {user ? (
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">The Humor Project</h1>
            <p className="text-neutral-500">Real photos, AI captions, your votes.</p>
          </div>
          <Link
            href="/submit"
            className="shrink-0 self-center inline-flex h-10 items-center whitespace-nowrap rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-4 text-sm font-medium"
          >
            + Upload
          </Link>
        </div>
      ) : (
        <section className="mb-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 flex flex-col items-center gap-4 text-center">
          <h1 className="text-3xl font-bold">Your camera roll, but funnier.</h1>
          <p className="text-neutral-500 max-w-md">
            Upload a photo or pick a meme and AI writes the caption. Everyone
            votes, and the funniest rise to the top. Sign in with Google to
            upload, caption and vote.
          </p>
          <GoogleSignInButton />
        </section>
      )}

      <nav className="mb-6 flex gap-2">
        {tab("new", "New")}
        {tab("top", "Top captions")}
      </nav>

      {error && <p className="text-red-500">The feed didn&apos;t load. Please refresh the page.</p>}

      {sort === "new" && (
        <ul className="flex flex-col gap-6">
          {images?.length === 0 && (
            <p className="text-neutral-500">
              No uploads yet.{" "}
              {user ? (
                <Link href="/submit" className="underline underline-offset-4">Upload the first photo</Link>
              ) : (
                "Sign in to upload the first photo."
              )}
            </p>
          )}
          {images?.map((image) => {
            const top = image.top[0];
            const count = image.caption_count[0]?.count ?? 0;
            return (
              <li key={image.id} className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                <Link href={`/images/${image.id}`}>
                  <StoredImage src={image.image_url} alt={top?.content ?? "Uploaded photo"} />
                </Link>
                <div className="p-5 flex flex-col gap-3">
                  {top ? (
                    <CaptionItem
                      caption={top}
                      author={label(top.user_id, top.profiles)}
                      myVote={myVotes.get(top.id) ?? null}
                      signedIn={Boolean(user)}
                      canDelete={canDelete(top.user_id)}
                    />
                  ) : (
                    <p className="text-neutral-500">No captions yet.</p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-neutral-500">
                    <span className="flex items-center gap-3">
                      Uploaded by {label(image.user_id, image.profiles)}
                      {image.user_id && canDelete(image.user_id) && (
                        <DeleteButton
                          action={deleteImage.bind(null, image.id, true)}
                          confirmText={`Delete this photo and ${count === 1 ? "its caption" : count > 1 ? `all ${count} captions` : "it"}?`}
                          label="Delete photo"
                        />
                      )}
                    </span>
                    <Link href={`/images/${image.id}`} className="underline underline-offset-4">
                      {count > 1 ? `See all ${count} captions` : "Add a caption"} →
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {sort === "top" && (
        <ul className="flex flex-col gap-6">
          {topCaptions?.length === 0 && <p className="text-neutral-500">No captions yet.</p>}
          {topCaptions?.map((caption) => (
            <li key={caption.id} className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              <Link href={`/images/${caption.images.id}`}>
                <StoredImage src={caption.images.image_url} alt={caption.images.title ?? caption.content} />
              </Link>
              <div className="p-5">
                <CaptionItem
                  caption={caption}
                  author={label(caption.user_id, caption.profiles)}
                  myVote={myVotes.get(caption.id) ?? null}
                  signedIn={Boolean(user)}
                  canDelete={canDelete(caption.user_id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
