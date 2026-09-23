'use client';

import { CopyIcon, Trash2Icon } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { withTransform, type Asset } from '~/lib/assets';
import { assetDate, assetMeta, copyAssetUrl } from './asset-grid';

/** Large enough to judge the image, small enough not to pull the original
 *  (a 5 MB upload) into the dialog. */
const PREVIEW_TRANSFORM = 'tr=w-1600';

/** The image at a size you can actually look at, with the facts beside it
 *  and the same two actions the card offers — nothing here that the grid
 *  cannot do, only room to see. */
export function AssetPreviewDialog({
  asset,
  onOpenChange,
  onDelete,
}: {
  /** The asset to show, or null while closed. */
  asset: Asset | null;
  onOpenChange: (open: boolean) => void;
  onDelete: (asset: Asset) => void;
}) {
  return (
    <Dialog open={asset !== null} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-0 max-w-3xl overflow-hidden p-4">
        {asset && (
          <>
            <DialogHeader>
              <DialogTitle className="truncate" title={asset.name}>{asset.name}</DialogTitle>
              <DialogDescription className="tabular-nums">
                {[assetMeta(asset), assetDate(asset)].filter(Boolean).join(' · ')}
              </DialogDescription>
            </DialogHeader>

            <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded-md bg-sunken">
              <img
                src={withTransform(asset.url, PREVIEW_TRANSFORM)}
                alt={asset.name}
                className="max-h-[70vh] max-w-full object-contain"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => void copyAssetUrl(asset)}>
                <CopyIcon />
                Copy URL
              </Button>
              <Button variant="danger" onClick={() => onDelete(asset)}>
                <Trash2Icon />
                Delete
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
