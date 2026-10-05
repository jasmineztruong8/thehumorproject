import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasName } from "@/lib/auth";
import { CAPTION_FIELDS, getMyVotes, type Caption } from "@/lib/captions";
import { CaptionItem } from "@/components/caption-item";
import { SignInGate } from "@/components/sign-in-gate";
import { StoredImage } from "@/components/stored-image";

export const dynamic = "force-dynamic";
export const metadata = { title: "My stuff · The Humor Project" };

type MyCaption = Caption & { images: { id: string; image_url: string } };

// Gated: the signed-in user's uploads and every caption they've generated.
export default async function MyPage() {
  const { user, profile } = await getCurrentUser();
  if (user && !hasName(profile)) redirect("/onboarding");

  if (!user) {
    return (
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold mb-10">My stuff</h1>
        <SignInGate message="Sign in with Google to see your photos and captions." />
      </main>
    );
  }

  const supabase = await createClient();
  const [{ data: images }, { data: captions }] = await Promise.all([
    supabase
      .from("images")
      .select("id, image_url, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("captions")
      .select(`${CAPTION_FIELDS}, images!inner(id, image_url)`)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .returns<MyCaption[]>(),
  ]);
  const myVotes = await getMyVotes(supabase, user.id, captions?.map((c) => c.id) ?? []);
  const totalScore = captions?.reduce((sum, c) => sum + c.score, 0) ?? 0;

  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col gap-10">
      <div>
        <h1 className="text-3xl font-bold mb-2">My stuff</h1>
        <p className="text-neutral-500">
          {images?.length ?? 0} photos · {captions?.length ?? 0} captions · {totalScore} total votes
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">My photos</h2>
        {images?.length ? (
          <ul className="grid grid-cols-3 gap-3">
            {images.map((image) => (
              <li key={image.id}>
                <Link href={`/images/${image.id}`} className="block rounded-lg overflow-hidden">
                  <StoredImage
                    src={image.image_url}
                    alt="My upload"
                    sizes="200px"
                    className="aspect-square object-cover"
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-neutral-500">
            Nothing yet. <Link href="/submit" className="underline underline-offset-4">Upload a photo</Link>.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">My captions</h2>
        {!captions?.length && (
          <p className="text-neutral-500">
            Nothing yet. Open any photo in the feed and generate a caption.
          </p>
        )}
        <ul className="flex flex-col gap-4">
          {captions?.map((caption) => (
            <li key={caption.id} className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 flex gap-4 items-center">
              <Link href={`/images/${caption.images.id}`} className="shrink-0 w-16 rounded-md overflow-hidden">
                <StoredImage src={caption.images.image_url} alt="" sizes="64px" className="aspect-square object-cover" />
              </Link>
              <div className="flex-1 min-w-0">
                <CaptionItem
                  caption={caption}
                  author={null}
                  myVote={myVotes.get(caption.id) ?? null}
                  signedIn
                  canDelete
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
