import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasName, isSuperadmin } from "@/lib/auth";
import { CAPTION_FIELDS, getMyVotes, type Caption } from "@/lib/captions";
import { createAuthorLabeler, type Author } from "@/lib/display-name";
import { MEME_LIBRARY_ENABLED } from "@/lib/features";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { CaptionItem } from "@/components/caption-item";
import { ActionsMenu, type MenuAction } from "@/components/actions-menu";
import { FeedTabs } from "@/components/feed-tabs";
import { deleteCaption, deleteImage } from "@/app/actions";
import { StoredImage } from "@/components/stored-image";
import { PixelIcon, type PixelIconName } from "@/components/pixel-icon";

export const dynamic = "force-dynamic";

type FeedImage = {
  id: string;
  image_url: string;
  title: string | null;
  source: "upload" | "library";
  user_id: string | null;
  created_at: string;
  profiles: Author;
  top: Caption[];
  caption_count: { count: number }[];
};

type TopCaption = Caption & {
  images: { id: string; image_url: string; title: string | null; source: "upload" | "library" };
};

const FEED_LIMIT = 30;

// Meme templates come in all shapes (many are tall or square), so in the feed
// they fill a photo-shaped frame, cropped to fit. The image page shows them whole.
const MEME_FRAME = "aspect-[3/2] object-cover";

// How the app helps, shown to signed-out visitors
const STEPS: [icon: PixelIconName, title: string, text: string][] = [
  ["camera", "Snap it", "Upload any photo or GIF"],
  ["sparkle", "AI writes it", "Steer the joke, retry till it lands"],
  ["arrow", "Crowd votes", "The funniest rise to the top"],
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const supabase = await createClient();
  const { user, profile } = await getCurrentUser();
  if (user && !hasName(profile)) redirect("/onboarding");

  const sort = (await searchParams).sort === "top" ? "top" : "new";
  const label = createAuthorLabeler(Boolean(user));
  const canDelete = (userId: string) => user?.id === userId || isSuperadmin(profile);

  // "New": newest uploads (and captioned memes when enabled), each with its best caption.
  // "Top": the highest-voted captions anywhere (uploads, and memes when enabled).
  const { data: newest, error: imagesError } =
    sort === "new"
      ? await supabase
          .from("images")
          .select(
            `id, image_url, title, source, user_id, created_at,
             profiles!images_user_id_fkey(first_name, last_name),
             top:captions(${CAPTION_FIELDS}),
             caption_count:captions(count)`,
          )
          .in("source", MEME_LIBRARY_ENABLED ? ["upload", "library"] : ["upload"])
          .order("created_at", { ascending: false })
          .order("score", { referencedTable: "top", ascending: false })
          .order("created_at", { referencedTable: "top", ascending: false })
          .limit(1, { referencedTable: "top" })
          .limit(FEED_LIMIT)
          .returns<FeedImage[]>()
      : { data: null, error: null };
  // A meme template only belongs in the feed once someone has captioned it
  const images = newest?.filter((i) => i.source === "upload" || i.top.length > 0);

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

  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-12">
      {user ? (
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">The Humor Project</h1>
            <p className="text-dim">Real photos, AI captions, your votes.</p>
          </div>
          <Link
            href="/submit"
            className="shrink-0 self-center whitespace-nowrap btn-primary px-3 py-1 text-sm"
          >
            <PixelIcon name="plus" size={12} /> Upload
          </Link>
        </div>
      ) : (
        <section className="mb-8 panel p-8 flex flex-col items-center gap-4 text-center">
          <h1 className="text-3xl font-bold">Your camera roll, but funnier.</h1>
          <p className="text-dim max-w-md">
            Upload a photo or pick a meme and AI writes the caption. Everyone
            votes, and the funniest rise to the top. Sign in with Google to
            upload, caption and vote.
          </p>
          <GoogleSignInButton />
          <ol className="mt-2 grid w-full grid-cols-3 gap-3 border-t-2 border-line pt-6 text-sm">
            {STEPS.map(([icon, title, text]) => (
              <li key={title} className="flex flex-col items-center gap-1">
                <PixelIcon name={icon} size={24} />
                <span className="font-pixel text-base font-bold">{title}</span>
                <span className="text-dim">{text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <FeedTabs active={sort} signedIn={Boolean(user)} className="mb-6" />

      {error && <p className="text-danger">The feed didn&apos;t load. Please refresh the page.</p>}

      {sort === "new" && (
        <ul className="flex flex-col gap-6">
          {images?.length === 0 && (
            <p className="text-dim">
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
            // One gear menu per card for everything this user may delete on it
            const actions: MenuAction[] = [];
            if (top && canDelete(top.user_id)) {
              actions.push({
                label: "Delete caption",
                confirmText: "Delete this caption? Its votes will be removed too. The photo stays.",
                action: deleteCaption.bind(null, top.id),
              });
            }
            if (image.user_id && canDelete(image.user_id)) {
              actions.push({
                label: "Delete photo",
                confirmText: `Delete this photo and ${count === 1 ? "its caption" : count > 1 ? `all ${count} captions` : "it"}?`,
                action: deleteImage.bind(null, image.id, true),
              });
            }
            return (
              <li key={image.id} className="panel overflow-hidden">
                <Link href={`/images/${image.id}`}>
                  <StoredImage
                    src={image.image_url}
                    alt={top?.content ?? "Uploaded photo"}
                    className={image.source === "library" ? MEME_FRAME : ""}
                  />
                </Link>
                <div className="p-5 flex flex-col gap-3">
                  {top ? (
                    <CaptionItem
                      caption={top}
                      author={label(top.user_id, top.profiles)}
                      myVote={myVotes.get(top.id) ?? null}
                      signedIn={Boolean(user)}
                      canDelete={false} // in the card's gear menu below
                    />
                  ) : (
                    <p className="text-dim">No captions yet.</p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-dim">
                    <span>
                      {image.source === "library"
                        ? `Meme template${image.title ? `: ${image.title}` : ""}`
                        : `Uploaded by ${label(image.user_id, image.profiles)}`}
                    </span>
                    <span className="flex items-center gap-4">
                      {/* The icon is the button (same style as the gear); the
                          words beside it are part of the same link */}
                      <Link href={`/images/${image.id}`} className="group inline-flex items-center gap-2">
                        <span className="btn-secondary size-9">
                          <PixelIcon name={count > 1 ? "bubble" : "plus"} size={16} />
                        </span>
                        <span className="group-hover:text-ink">
                          {count > 1 ? `See all ${count} captions` : "Add a caption"}
                        </span>
                      </Link>
                      <ActionsMenu items={actions} />
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {sort === "top" && (
        <ul className="flex flex-col gap-6">
          {topCaptions?.length === 0 && <p className="text-dim">No captions yet.</p>}
          {topCaptions?.map((caption, i) => (
            <li key={caption.id} className="panel relative overflow-hidden">
              <span className="absolute top-0 left-0 z-10 border-r-2 border-b-2 border-line bg-accent px-2 py-0.5 font-pixel font-bold text-on-accent">
                #{i + 1}
              </span>
              <Link href={`/images/${caption.images.id}`}>
                <StoredImage
                  src={caption.images.image_url}
                  alt={caption.images.title ?? caption.content}
                  className={caption.images.source === "library" ? MEME_FRAME : ""}
                />
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
