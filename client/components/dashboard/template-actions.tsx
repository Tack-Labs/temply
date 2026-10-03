'use client';

import { useMutation } from '@tanstack/react-query';
import { CopyIcon, Loader2Icon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { ConfirmDialog } from '~/components/ui/confirm-dialog';
import { httpDelete, httpPost } from '~/lib/http';

/** Where a row's delete stands, so the row can dim while it runs and close once it has. */
export type DeleteState = 'idle' | 'deleting' | 'deleted';

type TemplateActionsProps = {
  templateId: string;
  /**
   * Gives each button the name of the template it acts on. A list of twelve
   * rows otherwise has twelve buttons all called "Delete template", which a
   * screen reader's button list cannot tell apart.
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

export function TemplateActions({
  templateId,
  templateTitle,
  canDuplicate = true,
  onDeleteStateChange,
}: TemplateActionsProps) {
  const router = useRouter();
  // “Delete template” stays the stem of the name: it is what the buttons were
  // called before they carried a title, and what the specs look for.
  const subject = templateTitle ? ` “${templateTitle}”` : '';

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
      toast.error(error.message || 'Failed to duplicate template');
    },
  });

  const { mutate: deleteTemplate, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      return httpDelete(`/api/v1/templates/${templateId}`);
    },
    onMutate: () => onDeleteStateChange?.('deleting'),
    onSuccess: () => {
      toast.success('Template deleted');
      onDeleteStateChange?.('deleted');
      router.refresh();
    },
    onError: (error) => {
      onDeleteStateChange?.('idle');
      toast.error(error.message || 'Failed to delete template');
    },
  });

  // One request at a time per row: a delete racing a duplicate of the same
  // template would answer the duplicate with a 404 and a confusing toast.
  const busy = isDuplicating || isDeleting;

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {canDuplicate ? (
        <Button
          variant="ghost"
          size="icon-sm"
          touch
          onClick={() => duplicateTemplate()}
          disabled={busy}
          aria-label={`Duplicate template${subject}`}
        >
          {isDuplicating ? <Loader2Icon className="animate-spin" /> : <CopyIcon />}
        </Button>
      ) : null}
      <ConfirmDialog
        title="Delete this template?"
        description="This cannot be undone."
        onConfirm={() => deleteTemplate()}
      >
        <Button variant="danger-quiet" size="icon-sm" touch disabled={busy} aria-label={`Delete template${subject}`}>
          {isDeleting ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
        </Button>
      </ConfirmDialog>
    </div>
  );
}
