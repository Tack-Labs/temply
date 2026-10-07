'use client';

import { useMutation } from '@tanstack/react-query';
import { CopyIcon, Loader2Icon, MoreHorizontalIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { ConfirmDialog } from '~/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { httpDelete, httpPost } from '~/lib/http';

/** Where a row's delete stands, so the row can dim while it runs and close once it has. */
export type DeleteState = 'idle' | 'deleting' | 'deleted';

type TemplateActionsProps = {
  templateId: string;
  /**
   * Names the trigger for the template it acts on. A list of twelve rows
   * otherwise has twelve buttons all called "More actions", which a screen
   * reader's button list cannot tell apart.
   */
  templateTitle?: string;
  /** Duplicating adds a template; hide the action once the plan cap is hit. */
  canDuplicate?: boolean;
  /**
   * Reported as the delete moves: `deleting` when the request leaves, `idle`
   * if it fails, `deleted` once the server has removed the template, before the
   * list is refreshed to drop the row.
   */
  onDeleteStateChange?: (state: DeleteState) => void;
};

/**
 * A row's secondary actions behind one ⋯ button: Duplicate and Delete. The
 * primary action of the row is the workflow button beside it; these are the
 * ones a reader reaches for rarely, and Delete asks before it does anything.
 */
export function TemplateActions({
  templateId,
  templateTitle,
  canDuplicate = true,
  onDeleteStateChange,
}: TemplateActionsProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  // Set when Delete is chosen, read when the menu finishes closing. A ref and
  // not the `confirming` state: Radix hands focus back from the menu after its
  // content has unmounted, and the handler it calls then is the one from the
  // render before the menu closed, which has not seen the dialog open.
  const askedToDelete = useRef(false);
  const confirmationClosing = useRef(false);
  const deleteCompleted = useRef(false);
  const finishDelete = () => {
    onDeleteStateChange?.('deleted');
    router.refresh();
  };

  const { mutate: duplicateTemplate, isPending: isDuplicating } = useMutation({
    mutationFn: async () => {
      return httpPost<{ template: { id: string } }>(`/api/v1/templates/${templateId}/duplicate`, {});
    },
    // Stay on the list: duplicating is often batch housekeeping, and the new
    // row appearing beside the original is confirmation enough.
    onSuccess: () => {
      toast.success('Template duplicated');
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message || 'Could not duplicate the template');
    },
  });

  const { mutate: deleteTemplate, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      return httpDelete(`/api/v1/templates/${templateId}`);
    },
    onMutate: () => onDeleteStateChange?.('deleting'),
    onSuccess: () => {
      toast.success('Template deleted');
      // A quick response can arrive while the modal still owns focus during
      // its exit animation. Keep the row until that focus scope is released,
      // so the list can hand focus to its neighbour before the refresh.
      if (confirmationClosing.current) deleteCompleted.current = true;
      else finishDelete();
    },
    onError: (error) => {
      onDeleteStateChange?.('idle');
      toast.error(error.message || 'Could not delete the template');
    },
  });

  // One request at a time per row: a delete racing a duplicate of the same
  // template would answer the duplicate with a 404 and a confusing toast.
  // The trigger stays enabled and shows the spinner, so keyboard focus is not
  // lost to a button that went disabled under it; the items are what refuse.
  const busy = isDuplicating || isDeleting;

  return (
    <>
      {/* Not modal: Delete opens its own dialog from inside this menu, and a
          modal menu would leave that layer unclickable behind its
          pointer-event guard. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={templateTitle ? `More actions for ${templateTitle}` : 'More actions'}
            aria-busy={busy || undefined}
          >
            {busy ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : <MoreHorizontalIcon />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(event) => {
            // The dialog has taken focus. Returning it to the trigger now
            // would pull it back out from under the question.
            if (askedToDelete.current) {
              askedToDelete.current = false;
              event.preventDefault();
            }
          }}
        >
          {canDuplicate ? (
            <DropdownMenuItem className="pointer-coarse:h-11" disabled={busy} onSelect={() => duplicateTemplate()}>
              <CopyIcon />
              Duplicate template
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            className="text-danger-ink hover:bg-danger-wash focus:bg-danger-wash pointer-coarse:h-11 [&_svg]:text-danger-ink"
            disabled={busy}
            onSelect={() => {
              askedToDelete.current = true;
              setConfirming(true);
            }}
          >
            <Trash2Icon />
            Delete template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this template?"
        description="This cannot be undone."
        onConfirm={() => {
          confirmationClosing.current = true;
          deleteCompleted.current = false;
          deleteTemplate();
        }}
        onCloseAutoFocus={(event) => {
          confirmationClosing.current = false;
          // Always handled here: the dialog has no trigger of its own to
          // return to, since it is opened from the menu and not from a button.
          event.preventDefault();
          if (deleteCompleted.current) {
            // The list owns the handoff after deletion; restoring the old
            // trigger would undo it just before that trigger disappears.
            deleteCompleted.current = false;
            finishDelete();
          } else {
            triggerRef.current?.focus();
          }
        }}
      />
    </>
  );
}
