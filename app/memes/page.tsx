import Link from "next/link";
import { notFound } from "next/navigation";
import { MEME_LIBRARY_ENABLED } from "@/lib/features";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { LibrarySearch } from "@/components/library-search";
import { MembersOnlyButton } from "@/components/members-only-button";
import { StoredImage } from "@/components/stored-image";

export const dynamic = "force-dynamic";
export const metadata = { title: "Memes · The Humor Project" };

// Adding a search result calls Gemini to describe it.
export const maxDuration = 60;

type Template = {
  id: string;
  image_url: string;
  title: string | null;
  is_animated: boolean;
  captions: { count: number }[];
};

const FILTERS = { all: "All", gif: "GIFs", still: "Stills" } as const;

// Meme templates (stills and GIFs) anyone can browse; signed-in
// users caption them and can search memegen.link to add more templates.
export default async function MemesPage({ searchParams }: PageProps<"/memes">) {
  if (!MEME_LIBRARY_ENABLED) notFound();
  const supabase = await createClient();
  const { user } = await getCurrentUser();
  const requested = (await searchParams).type;
  const filter = requested === "gif" || requested === "still" ? requested : "all";

  let query = supabase
    .from("images")
    .select("id, image_url, title, is_animated, captions(count)")
    .eq("source", "library");
  if (filter !== "all") query = query.eq("is_animated", filter === "gif");
  const { data: templates, error } = await query
    .order("created_at", { ascending: false })
    .returns<Template[]>();
  if (error) console.error("Loading memes failed", error);

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Meme library</h1>
      <p className="text-neutral-500 mb-8">
        No photo? Pick a template and tell the AI what it should be about.
      </p>

      <div className="mb-10">
        {user ? (
          <LibrarySearch />
        ) : (
          <MembersOnlyButton className="w-full rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 p-5 text-left text-neutral-500">
            🔒 Search 200+ meme templates to caption
          </MembersOnlyButton>
        )}
      </div>

      <nav className="mb-6 flex gap-2">
        {Object.entries(FILTERS).map(([value, text]) => (
          <Link
            key={value}
            href={value === "all" ? "/memes" : `/memes?type=${value}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              filter === value
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            {text}
          </Link>
        ))}
      </nav>
      {error && <p className="text-red-500">The memes didn&apos;t load. Please refresh the page.</p>}
      {templates?.length === 0 && <p className="text-neutral-500">No templates yet.</p>}
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {templates?.map((t) => (
          <li key={t.id}>
            <Link
              href={`/images/${t.id}`}
              className="relative block rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden hover:border-neutral-400"
            >
              <StoredImage
                src={t.image_url}
                alt={t.title ?? "Meme template"}
                sizes="(max-width: 640px) 50vw, 300px"
                className="aspect-square object-cover"
              />
              {t.is_animated && (
                <span className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-bold text-white">
                  GIF
                </span>
              )}
              <div className="p-3 text-sm">
                <p className="font-medium truncate">{t.title}</p>
                <p className="text-neutral-500">
                  {t.captions[0]?.count ?? 0} captions
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
