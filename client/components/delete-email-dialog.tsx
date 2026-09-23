'use client';

import { DialogClose } from '@radix-ui/react-dialog';
import { useMutation } from '@tanstack/react-query';
import { Loader2Icon, Trash2Icon } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { useRouter } from 'next/navigation';
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
  /** Replaces the default button — the phone opens this from a menu item, and
   *  a dialog trigger has to be the item itself or the menu eats the tap. */
  trigger?: React.ReactElement;
};

export function DeleteEmailDialog(props: DeleteEmailDialogProps) {
  const { templateId, trigger } = props;

  const router = useRouter();

  const { mutate: deleteTemplate, isPending: isDeleteTemplatePending } =
    useMutation({
      mutationFn: async () => {
        return httpDelete(`/api/v1/templates/${templateId}`);
      },
      onSettled: () => {
        router.refresh();
      },
      onSuccess: () => {
        router.push('/dashboard/templates');
      },
    });

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="danger-quiet" disabled={isDeleteTemplatePending || !templateId}>
            {isDeleteTemplatePending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
            <span className="hidden lg:inline-block">Delete</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-xs p-4">
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the email
            and remove data from our servers.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <DialogClose asChild>
            <Button variant="secondary" disabled={isDeleteTemplatePending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
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
