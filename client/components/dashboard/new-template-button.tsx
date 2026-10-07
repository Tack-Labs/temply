'use client';

import { FileTextIcon, Loader2Icon, PlusIcon } from 'lucide-react';
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
import { useCreateFromStarter } from '~/hooks/use-create-from-starter';

/**
 * "New template" opens a gallery rather than an empty editor: the emails a
 * startup sends first, each a finished draft to reword. Picking one creates
 * the template and opens it.
 */
export function NewTemplateButton({ disabled = false }: { disabled?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const { starters, create, busy: creating, pickedId } = useCreateFromStarter();

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
          if (!next && creating) return;
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

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy={creating || undefined}>
            {starters.map((starter) => {
              const busy = pickedId === starter.id;
              return (
                <Tile
                  key={starter.id}
                  busy={busy}
                  onClick={() => create(starter)}
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
