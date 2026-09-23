'use client';

import { useMutation } from '@tanstack/react-query';
import { CopyIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { ConfirmDialog } from '~/components/ui/confirm-dialog';
import { httpDelete, httpPost } from '~/lib/http';

type TemplateActionsProps = {
  templateId: string;
  /** Duplicating adds a template; hide the action once the plan cap is hit. */
  canDuplicate?: boolean;
};

export function TemplateActions({ templateId, canDuplicate = true }: TemplateActionsProps) {
  const router = useRouter();

  const { mutateAsync: duplicateTemplate, isPending: isDuplicating } = useMutation({
    mutationFn: async () => {
      return httpPost<{ template: { id: string } }>(`/api/v1/templates/${templateId}/duplicate`, {});
    },
    // Stay on the grid: duplicating is often batch housekeeping, and the new
    // card appearing beside the original is confirmation enough.
    onSuccess: () => {
      toast.success('Template duplicated');
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to duplicate template');
    },
  });

  const { mutateAsync: deleteTemplate, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      return httpDelete(`/api/v1/templates/${templateId}`);
    },
    onSuccess: () => {
      toast.success('Template deleted');
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete template');
    },
  });

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {canDuplicate ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => duplicateTemplate()}
          disabled={isDuplicating}
          aria-label="Duplicate template"
        >
          <CopyIcon />
        </Button>
      ) : null}
      <ConfirmDialog
        title="Delete this template?"
        description="This cannot be undone."
        onConfirm={() => deleteTemplate()}
      >
        <Button
          variant="danger-quiet"
          size="icon-sm"
          disabled={isDeleting}
          aria-label="Delete template"
        >
          <Trash2Icon />
        </Button>
      </ConfirmDialog>
    </div>
  );
}
