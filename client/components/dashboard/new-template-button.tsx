'use client';

import { useOrganization } from '@clerk/nextjs';
import { useMutation } from '@tanstack/react-query';
import { FileTextIcon, Loader2Icon, PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { StarterThumbnail } from '~/components/dashboard/starter-thumbnail';
import { Tile } from '~/components/ui/item';
import { httpPost } from '~/lib/http';
import { personaliseStarter, STARTER_TEMPLATES, type StarterTemplate } from '~/lib/starter-templates';
import { toast } from 'sonner';

type SaveTemplateResponse = {
  template: { id: string };
};

/**
 * "New template" opens a gallery rather than an empty editor: the emails a
 * startup sends first, each a finished draft to reword. Picking one creates
 * the template and opens it.
 */
export function NewTemplateButton({ disabled = false }: { disabled?: boolean } = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  // The starters are written for a sample company; the workspace's own name
  // and logo go in before anyone sees them, in the gallery and in the
  // template made. Clerk always has an image for an org — initials when
  // nothing was uploaded — so only a real upload replaces the mark.
  const { organization } = useOrganization();
  const workspace = {
    name: organization?.name,
    logoUrl: organization?.hasImage ? organization.imageUrl : null,
  };
  const starters = STARTER_TEMPLATES.map((starter) => personaliseStarter(starter, workspace));

  const { mutateAsync: createTemplate, isPending } = useMutation({
    mutationFn: async (starter: StarterTemplate) => {
      return httpPost<SaveTemplateResponse>('/api/v1/templates', {
        title: starter.subject,
        previewText: starter.previewText,
        content: JSON.stringify(starter.content),
      });
    },
    onSuccess: (data) => {
      router.push(`/templates/${data.template.id}`);
    },
    onError: (error) => {
      setPicked(null);
      toast.error(error.message || 'Could not create the template');
    },
  });

  const pick = (starter: StarterTemplate) => {
    if (isPending) return;
    setPicked(starter.id);
    void createTemplate(starter);
  };

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} disabled={disabled}>
        <PlusIcon />
        New template
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          // The dialog stays up while the pick is in flight, so the busy tile
          // is the feedback and the redirect closes it.
          if (!next && isPending) return;
          setOpen(next);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Start a template</DialogTitle>
            <DialogDescription>
              Pick the email closest to the one you need. Everything is yours to change.
            </DialogDescription>
          </DialogHeader>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy={isPending || undefined}>
            {starters.map((starter) => {
              const busy = picked === starter.id;
              return (
                <Tile
                  key={starter.id}
                  busy={busy}
                  onClick={() => pick(starter)}
                  primaryLabel={`Start from ${starter.name}`}
                  media={
                    <div className="relative">
                      {/* Blank renders as a logo over nothing, which reads as
                          a broken preview rather than an empty page. Say so. */}
                      {starter.id === 'blank' ? (
                        <div className="flex aspect-[8/5] flex-col items-center justify-center gap-1.5 bg-sunken">
                          <FileTextIcon className="size-5 text-faint" />
                          <span className="text-xs text-muted">An empty page</span>
                        </div>
                      ) : (
                        <StarterThumbnail starter={starter} />
                      )}
                      {busy ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-raised/70">
                          <Loader2Icon className="size-5 animate-spin text-faint" />
                        </div>
                      ) : null}
                    </div>
                  }
                  title={starter.name}
                  subtitle={starter.description}
                  subtitleLines={2}
                />
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
