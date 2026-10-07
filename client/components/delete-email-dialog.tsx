'use client';

import { DialogClose } from '@radix-ui/react-dialog';
import { useMutation } from '@tanstack/react-query';
import { Loader2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { httpDelete } from '~/lib/http';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';

type DeleteEmailDialogProps = {
  templateId?: string;
  /** The control that opens the dialog. The phone passes a menu item, and a
   *  dialog trigger has to be the item itself or the menu eats the tap. Left
   *  out, or `null`, no trigger is drawn, for a dialog opened from outside. */
  trigger?: React.ReactElement | null;
  /** Hand over `open` and `onOpenChange` to hold the state outside. A dialog
   *  mounted inside menu content goes when the menu closes, so a menu that
   *  opens this keeps the state itself and mounts the dialog beside it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** With no trigger of its own the dialog has nowhere to hand focus back to
   *  when it closes; the opener says where. */
  onCloseAutoFocus?: React.ComponentProps<typeof DialogContent>['onCloseAutoFocus'];
};

/**
 * Deletes the template and returns to the list. A failure keeps the customer
 * where they are, with the dialog still open and its button free again, and
 * says why: the template is still there, and a dialog that goes quiet after
 * Delete reads as though it worked.
 */
export function useDeleteTemplate(templateId: string | undefined) {
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      return httpDelete(`/api/v1/templates/${templateId}`);
    },
    onSettled: () => {
      router.refresh();
    },
    onSuccess: () => {
      toast.success('Template deleted');
      router.push('/dashboard/templates');
    },
    onError: (error) => {
      toast.error(error.message || 'Could not delete the template');
    },
  });
}

export function DeleteEmailDialog(props: DeleteEmailDialogProps) {
  const { templateId, trigger, open, onOpenChange, onCloseAutoFocus } = props;

  const { mutate: deleteTemplate, isPending: isDeleteTemplatePending } = useDeleteTemplate(templateId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}

      <DialogContent className="max-w-xs p-4" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the email
            and remove data from our servers.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <DialogClose asChild>
            <Button size="compact" variant="secondary" disabled={isDeleteTemplatePending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="compact"
            variant="danger"
            disabled={isDeleteTemplatePending || !templateId}
            onClick={() => deleteTemplate()}
          >
            {isDeleteTemplatePending ? <Loader2Icon className="animate-spin" /> : null}
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
