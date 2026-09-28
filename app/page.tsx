import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasName } from "@/lib/auth";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { VoteButtons } from "@/components/vote-buttons";
import { DeleteJokeButton } from "@/components/delete-joke-button";

export const dynamic = "force-dynamic";

type Joke = {
  id: string;
  content: string;
  votes: number;
  created_at: string;
  user_id: string | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
};

function authorName(author: Joke["profiles"]) {
  if (!author?.first_name) return null;
  return `${author.first_name} ${author.last_name?.[0] ?? ""}.`.replace(" .", "");
}

export default async function Home() {
  const supabase = await createClient();
  const { user, profile } = await getCurrentUser();
  if (user && !hasName(profile)) redirect("/onboarding");

  const { data: jokes, error } = await supabase
    .from("jokes")
    .select("id, content, votes, created_at, user_id, profiles!jokes_user_id_fkey(first_name, last_name)")
    .order("votes", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<Joke[]>();

  // The signed-in user's own votes, so their arrows show as selected
  const myVotes = new Map<string, 1 | -1>();
  if (user) {
    const { data } = await supabase
      .from("votes")
      .select("joke_id, value")
      .eq("user_id", user.id);
    data?.forEach((v) => myVotes.set(v.joke_id, v.value));
  }

  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-16">
      {user ? (
        <div className="mb-10 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">The Humor Project</h1>
            <p className="text-neutral-500">Jokes, ranked by votes.</p>
          </div>
          <Link
            href="/submit"
            className="shrink-0 self-center inline-flex h-10 items-center whitespace-nowrap rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-4 text-sm font-medium"
          >
            + Submit a joke
          </Link>
        </div>
      ) : (
        <section className="mb-10 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 flex flex-col items-center gap-4 text-center">
          <h1 className="text-3xl font-bold">Think you&apos;re funny? Let&apos;s find out.</h1>
          <p className="text-neutral-500 max-w-md">
            Browse the jokes below, ranked by votes. Sign in with Google to
            submit your own and upvote or downvote your favorites.
          </p>
          <GoogleSignInButton />
        </section>
      )}

      {error && (
        <p className="text-red-500">Failed to load jokes: {error.message}</p>
      )}

      <ul className="flex flex-col gap-4">
        {jokes?.map((joke) => (
          <li
            key={joke.id}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 flex items-center gap-4"
          >
            <VoteButtons
              jokeId={joke.id}
              score={joke.votes}
              myVote={myVotes.get(joke.id) ?? null}
              signedIn={Boolean(user)}
            />
            <div className="flex-1">
              <p className="text-lg">{joke.content}</p>
              <div className="mt-1 flex items-center gap-3">
                {authorName(joke.profiles) && (
                  <p className="text-sm text-neutral-500">
                    — {authorName(joke.profiles)}
                  </p>
                )}
                {user && joke.user_id === user.id && (
                  <DeleteJokeButton jokeId={joke.id} />
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
