import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Joke = {
  id: string;
  content: string;
  votes: number;
  created_at: string;
};

export default async function Home() {
  const { data: jokes, error } = await supabase
    .from("jokes")
    .select("*")
    .order("votes", { ascending: false });

  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-2">The Humor Project</h1>
      <p className="text-neutral-500 mb-10">Jokes, ranked by votes.</p>

      {error && (
        <p className="text-red-500">Failed to load jokes: {error.message}</p>
      )}

      <ul className="flex flex-col gap-4">
        {jokes?.map((joke: Joke) => (
          <li
            key={joke.id}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 flex justify-between items-start gap-4"
          >
            <p className="text-lg">{joke.content}</p>
            <span className="shrink-0 rounded-full bg-neutral-100 dark:bg-neutral-800 px-3 py-1 text-sm font-medium">
              ▲ {joke.votes}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
