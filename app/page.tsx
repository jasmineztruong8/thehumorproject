import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Joke = {
  id: string;
  content: string;
  votes: number;
  created_at: string;
  profiles: { first_name: string | null; last_name: string | null } | null;
};

function authorName(author: Joke["profiles"]) {
  if (!author?.first_name) return null;
  return `${author.first_name} ${author.last_name?.[0] ?? ""}.`.replace(" .", "");
}

export default async function Home() {
  const supabase = await createClient();
  const { data: jokes, error } = await supabase
    .from("jokes")
    .select("id, content, votes, created_at, profiles(first_name, last_name)")
    .order("votes", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<Joke[]>();

  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-2">The Humor Project</h1>
      <p className="text-neutral-500 mb-10">Jokes, ranked by votes.</p>

      {error && (
        <p className="text-red-500">Failed to load jokes: {error.message}</p>
      )}

      <ul className="flex flex-col gap-4">
        {jokes?.map((joke) => (
          <li
            key={joke.id}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 flex justify-between items-start gap-4"
          >
            <div>
              <p className="text-lg">{joke.content}</p>
              {authorName(joke.profiles) && (
                <p className="text-sm text-neutral-500 mt-1">
                  — {authorName(joke.profiles)}
                </p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-neutral-100 dark:bg-neutral-800 px-3 py-1 text-sm font-medium">
              ▲ {joke.votes}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
