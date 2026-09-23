'use client';

import { ImageIcon, ImagePlusIcon, Loader2Icon, UploadIcon } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '~/lib/http';
import { toastUploaded, UPLOAD_MIME_TYPES, type Asset } from '~/lib/assets';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { EmptyState, ErrorState } from '~/components/ui/surfaces';
import { AssetGrid, type PendingUpload } from './asset-grid';
import { useAssets } from './use-assets';
import { useDuplicateNameGuard } from './duplicate-name-dialog';
import { useFileDrop } from './use-file-drop';
import { cn } from '~/lib/classname';
import { localId } from '~/lib/id';

const inputClass =
  'h-9 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink placeholder:text-faint';

export function AssetPickerDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (asset: Asset) => void;
}) {
  const { query, upload } = useAssets({ enabled: open });
  // Stable across renders, unlike the mutation object — the document drop
  // listener must not be re-registered mid-drag.
  const { mutateAsync: uploadOne } = upload;
  // The host passes onPick inline; reading it through a ref keeps handleFiles
  // — and therefore the document listener — stable across parent renders.
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [search, setSearch] = useState('');
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const assets = (query.data?.assets ?? []).filter((asset) =>
    asset.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const duplicates = useDuplicateNameGuard(query.data?.assets ?? []);

  // Uploading from inside the picker is "use this now", so the new asset is
  // picked without a second click.
  const handleFiles = useCallback(async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!(await duplicates.check(file))) return;
    setPendingUpload({ id: localId(), name: file.name, bytes: file.size });
    try {
      const result = await uploadOne(file);
      toastUploaded(result);
      onPickRef.current(result.asset);
    } catch (error) {
      toast.error(errorMessage(error) || 'Image upload failed. Please try again.');
    } finally {
      setPendingUpload(null);
    }
  }, [uploadOne, duplicates.check]);

  const dragging = useFileDrop(handleFiles, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-0 max-w-2xl overflow-hidden p-4">
        {/* Dropping anywhere in the window while the picker is open uploads
            into it (useFileDrop); this sheet says so over the dialog. */}
        <div
          aria-hidden={!dragging}
          className={cn(
            'pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-raised/85 backdrop-blur-sm transition-opacity duration-base motion-reduce:transition-none',
            dragging ? 'opacity-100' : 'opacity-0',
          )}
        >
          <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-accent bg-raised px-8 py-6 text-center shadow-lg">
            <ImagePlusIcon className="size-6 text-accent-ink" />
            <p className="text-sm font-medium text-ink">Drop an image to upload and use it</p>
            <p className="text-2xs text-muted">JPEG, PNG, GIF or WebP · up to 5 MB</p>
          </div>
        </div>

        <DialogHeader>
          <DialogTitle>Choose an image</DialogTitle>
          <DialogDescription>Images you have uploaded before, ready to reuse — or drop a new one here.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <input
            className={inputClass}
            placeholder="Search by file name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search images"
          />
          <input
            ref={fileInput}
            type="file"
            accept={UPLOAD_MIME_TYPES.join(',')}
            className="hidden"
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <Button variant="primary" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
            {upload.isPending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
            Upload
          </Button>
        </div>

        {duplicates.dialog}

        <div className="max-h-[60vh] overflow-y-auto">
          {query.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2Icon className="size-5 animate-spin text-faint" />
            </div>
          ) : query.isError ? (
            <ErrorState description="We could not load your images. They are still there." onRetry={() => query.refetch()} />
          ) : assets.length === 0 && !pendingUpload ? (
            <EmptyState
              icon={ImageIcon}
              title={search ? 'No images match' : 'No images yet'}
              description={search ? 'Try a different file name.' : 'Upload one to use it here'}
              action={search ? undefined : <Button variant="primary" onClick={() => fileInput.current?.click()}>Upload</Button>}
            />
          ) : (
            <AssetGrid mode="pick" size="md" assets={assets} pending={pendingUpload ? [pendingUpload] : []} onPick={onPick} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
