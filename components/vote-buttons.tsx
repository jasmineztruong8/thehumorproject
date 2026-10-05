"use client";

import { useOptimistic, useTransition } from "react";
import { vote } from "@/app/actions";
import { MembersOnlyButton } from "@/components/members-only-button";

type Props = {
  captionId: string;
  score: number;
  myVote: 1 | -1 | null;
  signedIn: boolean;
};

const arrowClass =
  "w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors";

export function VoteButtons({ captionId, score, myVote, signedIn }: Props) {
  const [pending, startTransition] = useTransition();
  // Show the new vote immediately; the server result replaces it after refresh
  const [optimistic, setOptimistic] = useOptimistic({ score, myVote });

  if (!signedIn) {
    return (
      <div className="shrink-0 flex flex-col items-center gap-1">
        <MembersOnlyButton label="Upvote" className={`${arrowClass} text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800`}>
          ▲
        </MembersOnlyButton>
        <span className="text-sm font-medium tabular-nums">{score}</span>
        <MembersOnlyButton label="Downvote" className={`${arrowClass} text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800`}>
          ▼
        </MembersOnlyButton>
      </div>
    );
  }

  function cast(value: 1 | -1) {
    startTransition(async () => {
      const next = optimistic.myVote === value ? null : value;
      setOptimistic({
        myVote: next,
        score: optimistic.score - (optimistic.myVote ?? 0) + (next ?? 0),
      });
      await vote(captionId, value);
    });
  }

  const active = "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900";
  const idle = "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800";

  return (
    <div className="shrink-0 flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label="Upvote"
        aria-pressed={optimistic.myVote === 1}
        disabled={pending}
        onClick={() => cast(1)}
        className={`${arrowClass} ${optimistic.myVote === 1 ? active : idle}`}
      >
        ▲
      </button>
      <span className="text-sm font-medium tabular-nums">{optimistic.score}</span>
      <button
        type="button"
        aria-label="Downvote"
        aria-pressed={optimistic.myVote === -1}
        disabled={pending}
        onClick={() => cast(-1)}
        className={`${arrowClass} ${optimistic.myVote === -1 ? active : idle}`}
      >
        ▼
      </button>
    </div>
  );
}
