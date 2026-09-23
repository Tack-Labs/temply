'use client';

import { ImageIcon, ImagePlusIcon, Loader2Icon, UploadIcon } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { formatBytes } from '@temply/shared/bytes';
import { AssetGrid, type PendingUpload } from '~/components/assets/asset-grid';
import { AssetPreviewDialog } from '~/components/assets/asset-preview-dialog';
import { AssetViewSwitch, useAssetView } from '~/components/assets/asset-view-switch';
import { useAssets } from '~/components/assets/use-assets';
import { useDuplicateNameGuard } from '~/components/assets/duplicate-name-dialog';
import { useFileDrop } from '~/components/assets/use-file-drop';
import { Button } from '~/components/ui/button';
import { ConfirmDialog } from '~/components/ui/confirm-dialog';
import { PageLoading } from '~/components/ui/page-loading';
import { EmptyState, ErrorState, PageHeader } from '~/components/ui/surfaces';
import { assetUsage, toastUploaded, UPLOAD_MIME_TYPES, type Asset } from '~/lib/assets';
import { cn } from '~/lib/classname';
import { errorMessage } from '~/lib/http';
import { localId } from '~/lib/id';
import { useMinimumDisplay } from '~/hooks/use-minimum-display';

const inputClass =
  'h-9 w-full max-w-xs rounded-md border border-line bg-raised px-3 text-sm text-ink placeholder:text-faint';

export default function AssetsPage() {
  const { query, upload, remove } = useAssets();
  const showLoading = useMinimumDisplay(query.isLoading);
  // Stable across renders, unlike the mutation object itself — the document
  // drop listener must not be re-registered mid-drag.
  const { mutateAsync: uploadOne } = upload;
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ asset: Asset; templates: number } | null>(null);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [preview, setPreview] = useState<Asset | null>(null);
  const [view, setView] = useAssetView();
  const fileInput = useRef<HTMLInputElement>(null);

  const list = query.data;
  const assets = (list?.assets ?? []).filter((asset) =>
    asset.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const duplicates = useDuplicateNameGuard(list?.assets ?? []);

  const used = list?.usedBytes ?? 0;
  const limit = list?.limitBytes ?? null;
  const ratio = limit ? used / limit : 0;
  const usage = limit ? `${formatBytes(used)} of ${formatBytes(limit)} used` : `${formatBytes(used)} used`;

  const uploadFiles = useCallback(async (files: FileList | File[] | null) => {
    // A name the library already holds is asked about first; a declined
    // file is skipped, the rest go ahead.
    const accepted: File[] = [];
    for (const file of Array.from(files ?? [])) {
      if (await duplicates.check(file)) accepted.push(file);
    }
    // Every file gets its placeholder card up front, so a multi-file drop
    // shows the whole queue rather than one card at a time.
    const queue = accepted.map((file) => ({
      file,
      pending: { id: localId(), name: file.name, bytes: file.size },
    }));
    setPendingUploads((current) => [...current, ...queue.map((entry) => entry.pending)]);
    const settle = (ids: string[]) =>
      setPendingUploads((current) => current.filter((entry) => !ids.includes(entry.id)));

    for (const [index, { file, pending }] of queue.entries()) {
      try {
        toastUploaded(await uploadOne(file));
        settle([pending.id]);
      } catch (error) {
        toast.error(errorMessage(error) || `Could not upload ${file.name}.`);
        // A quota refusal will refuse the rest too; stop instead of toasting
        // the same sentence for every remaining file, and clear their cards.
        settle(queue.slice(index).map((entry) => entry.pending.id));
        break;
      }
    }
  }, [uploadOne, duplicates.check]);

  const dragging = useFileDrop(uploadFiles);

  const askDelete = async (asset: Asset) => {
    setPreview(null);
    try {
      const { templates } = await assetUsage(asset.id);
      setPendingDelete({ asset, templates: templates.length });
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not check where this image is used.');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { asset } = pendingDelete;
    setPendingDelete(null);
    try {
      await remove.mutateAsync(asset.id);
      toast.success('Image deleted');
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not delete the image.');
    }
  };

  return (
    <div className="space-y-5">
      {/* The whole window is the drop target (see useFileDrop); this is the
          sheet that says so while a file is in the air. */}
      <div
        aria-hidden={!dragging}
        className={cn(
          'pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-surface/80 backdrop-blur-sm transition-opacity duration-base motion-reduce:transition-none',
          dragging ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-accent bg-raised px-10 py-8 text-center shadow-lg">
          <ImagePlusIcon className="size-6 text-accent-ink" />
          <p className="text-sm font-medium text-ink">Drop images to upload</p>
          <p className="text-2xs text-muted">JPEG, PNG, GIF or WebP · up to 5 MB each</p>
        </div>
      </div>

      <PageHeader
        title="Assets"
        description={usage}
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              accept={UPLOAD_MIME_TYPES.join(',')}
              multiple
              className="hidden"
              onChange={(event) => { void uploadFiles(event.target.files); event.target.value = ''; }}
            />
            <Button variant="primary" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
              {upload.isPending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
              Upload
            </Button>
          </>
        }
      />

      {limit && ratio >= 0.8 ? (
        <p className={cn('text-sm', ratio >= 1 ? 'text-danger-ink' : 'text-warn-ink')}>
          {ratio >= 1 ? 'Storage is full.' : 'Storage is almost full.'}{' '}
          <Link href="/dashboard/settings/plan" className="underline underline-offset-2">
            Delete images or upgrade
          </Link>
        </p>
      ) : null}

      {(list?.assets.length ?? 0) > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <input
            className={inputClass}
            placeholder="Search by file name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search images"
          />
          <AssetViewSwitch view={view} onViewChange={setView} />
        </div>
      ) : null}

      {showLoading ? (
        <PageLoading label="Loading your images…" />
      ) : query.isError ? (
        <ErrorState
          description="We could not load your images. Anything you uploaded is still there."
          onRetry={() => query.refetch()}
        />
      ) : assets.length === 0 && pendingUploads.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title={search ? 'No images match' : 'No images yet'}
          description={search ? 'Try a different file name.' : 'Upload one to reuse it across templates, or drop images anywhere on this page'}
          action={search ? undefined : <Button variant="primary" onClick={() => fileInput.current?.click()}>Upload</Button>}
        />
      ) : (
        <AssetGrid
          mode="manage"
          view={view}
          assets={assets}
          pending={pendingUploads}
          onDelete={askDelete}
          onPreview={setPreview}
        />
      )}

      {duplicates.dialog}

      <AssetPreviewDialog
        asset={preview}
        onOpenChange={(open) => { if (!open) setPreview(null); }}
        onDelete={askDelete}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        title={pendingDelete ? `Delete "${pendingDelete.asset.name}"?` : ''}
        description={
          pendingDelete && pendingDelete.templates > 0
            ? `It is used in ${pendingDelete.templates} template${pendingDelete.templates === 1 ? '' : 's'} — those images will stop showing.`
            : 'This removes the file from your library.'
        }
        onConfirm={confirmDelete}
      />
    </div>
  );
}
