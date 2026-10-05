import { deleteCaption } from "@/app/actions";
import type { Caption } from "@/lib/captions";
import { DeleteButton } from "@/components/delete-button";
import { VoteButtons } from "@/components/vote-buttons";

// One caption with its vote arrows, author and (for its owner) a delete link.
export function CaptionItem({
  caption,
  author,
  myVote,
  signedIn,
  canDelete,
}: {
  caption: Caption;
  author: string | null;
  myVote: 1 | -1 | null;
  signedIn: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <VoteButtons
        captionId={caption.id}
        score={caption.score}
        myVote={myVote}
        signedIn={signedIn}
      />
      <div className="flex-1 min-w-0">
        <p className="text-lg break-words">{caption.content}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-500">
          {author && <span>— {author}</span>}
          {caption.user_prompt && (
            <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs">
              about: {caption.user_prompt}
            </span>
          )}
          {canDelete && (
            <DeleteButton
              action={deleteCaption.bind(null, caption.id)}
              confirmText="Delete this caption? Its votes will be removed too. The photo stays."
              label="Delete caption"
            />
          )}
        </div>
      </div>
    </div>
  );
}
