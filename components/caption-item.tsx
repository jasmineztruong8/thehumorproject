import { deleteCaption } from "@/app/actions";
import type { Caption } from "@/lib/captions";
import { ActionsMenu } from "@/components/actions-menu";
import { VoteButtons } from "@/components/vote-buttons";

// One caption with its vote arrows, author and (for its owner) a gear menu
// with "Delete caption".
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
        <p className="text-xl sm:text-2xl font-semibold leading-snug break-words">{caption.content}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-dim">
          {author && <span>— {author}</span>}
          {caption.user_prompt && (
            <span className="bg-well px-2 py-0.5 text-xs">
              about: {caption.user_prompt}
            </span>
          )}
        </div>
      </div>
      {canDelete && (
        // Bottom-right corner, like the gear on feed cards
        <div className="self-end">
          <ActionsMenu
          items={[
            {
              label: "Delete caption",
              confirmText: "Delete this caption? Its votes will be removed too. The photo stays.",
              action: deleteCaption.bind(null, caption.id),
            },
            ]}
          />
        </div>
      )}
    </div>
  );
}
