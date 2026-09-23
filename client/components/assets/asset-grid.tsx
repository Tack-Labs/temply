'use client';

import { CopyIcon, Loader2Icon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { List, Row, Tile } from '~/components/ui/item';
import { cn } from '~/lib/classname';
import { EMAIL_TRANSFORM, THUMB_TRANSFORM, withTransform, type Asset } from '~/lib/assets';
import { formatBytes } from '@temply/shared/bytes';
import type { AssetView } from './asset-view-switch';

/** A file whose upload is in flight — drawn as a card so the user sees where
 *  the asset will land, not just a spinner somewhere else on the page. */
export type PendingUpload = { id: string; name: string; bytes: number };

type Props = {
  assets: Asset[];
  pending?: PendingUpload[];
  /** Cards or rows. The picker only ever needs cards. */
  view?: AssetView;
  /** `sm` is the page's grid (the list view carries density); `md` suits a dialog ~40rem wide. */
  size?: 'sm' | 'md';
} & (
  | { mode: 'pick'; onPick: (asset: Asset) => void; onDelete?: never; onPreview?: never }
  | {
      mode: 'manage';
      onDelete: (asset: Asset) => void;
      /** Clicking the image itself opens it large; omit to make it inert. */
      onPreview?: (asset: Asset) => void;
      onPick?: never;
    }
);

export function assetMeta(asset: Asset): string {
  return [formatBytes(asset.bytes), asset.width && asset.height ? `${asset.width} × ${asset.height}` : null]
    .filter(Boolean)
    .join(' · ');
}

export function assetDate(asset: Asset): string | null {
  return asset.created_at
    ? new Date(asset.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
}

/** Copies the email-weight URL, so a pasted URL weighs the same as a picked one. */
export async function copyAssetUrl(asset: Asset) {
  try {
    await navigator.clipboard.writeText(withTransform(asset.url, EMAIL_TRANSFORM));
    toast.success('URL copied');
  } catch {
    toast.error('Could not copy the URL.');
  }
}

/** Copy and delete, the same pair on a card's footer and a row's edge. */
function ManageActions({ asset, onDelete }: { asset: Asset; onDelete: (asset: Asset) => void }) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Copy URL of ${asset.name}`}
        title="Copy URL"
        onClick={() => void copyAssetUrl(asset)}
      >
        <CopyIcon />
      </Button>
      <Button
        variant="danger-quiet"
        size="icon-sm"
        aria-label={`Delete ${asset.name}`}
        title="Delete"
        onClick={() => onDelete(asset)}
      >
        <Trash2Icon />
      </Button>
    </>
  );
}

/** One grid for the library page and the editor picker. In `pick` mode every
 *  card is a button; in `manage` mode the card carries copy and delete. */
export function AssetGrid(props: Props) {
  const { assets, mode, pending = [], view = 'grid', size = 'sm' } = props;

  if (view === 'list') return <AssetList {...props} />;

  return (
    <ul
      className={cn(
        'grid gap-3',
        size === 'sm' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'grid-cols-3 sm:grid-cols-4',
      )}
    >
      {pending.map((file) => (
        <Tile
          key={file.id}
          busy
          media={
            <div className="flex aspect-[4/3] items-center justify-center bg-sunken">
              <Loader2Icon className="size-5 animate-spin text-faint" />
            </div>
          }
          title={file.name}
          subtitle={`Uploading · ${formatBytes(file.bytes)}`}
        />
      ))}
      {assets.map((asset) => {
        const slots = {
          // Odd shapes sit inside a fixed well instead of reflowing the row.
          media: (
            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-sunken">
              <img
                src={withTransform(asset.url, THUMB_TRANSFORM)}
                alt={asset.name}
                loading="lazy"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ),
          title: <span title={asset.name}>{asset.name}</span>,
          subtitle: assetMeta(asset),
        };

        if (mode === 'pick') {
          return <Tile key={asset.id} {...slots} onClick={() => props.onPick(asset)} primaryLabel={`Use ${asset.name}`} />;
        }
        const actions = <ManageActions asset={asset} onDelete={props.onDelete} />;
        if (props.onPreview) {
          const preview = props.onPreview;
          return (
            <Tile
              key={asset.id}
              {...slots}
              onClick={() => preview(asset)}
              primaryLabel={`Preview ${asset.name}`}
              actions={actions}
            />
          );
        }
        return <Tile key={asset.id} {...slots} actions={actions} />;
      })}
    </ul>
  );
}

/** Rows instead of cards: a small thumbnail, the name, the numbers and the
 *  date in columns, with the actions always visible rather than on hover. */
function AssetList(props: Props) {
  const { assets, mode, pending = [] } = props;

  return (
    <List>
      {pending.map((file) => (
        <Row
          key={file.id}
          busy
          leading={
            <div className="flex size-10 items-center justify-center rounded-sm bg-sunken">
              <Loader2Icon className="size-4 animate-spin text-faint" />
            </div>
          }
          title={<span title={file.name}>{file.name}</span>}
          meta={<p className="shrink-0 text-2xs text-muted tabular-nums">Uploading · {formatBytes(file.bytes)}</p>}
        />
      ))}
      {assets.map((asset) => {
        const slots = {
          leading: (
            <div className="flex size-10 items-center justify-center overflow-hidden rounded-sm bg-sunken">
              <img
                src={withTransform(asset.url, THUMB_TRANSFORM)}
                alt=""
                loading="lazy"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ),
          title: <span title={asset.name}>{asset.name}</span>,
          meta: (
            <>
              <p className="hidden w-32 shrink-0 truncate text-2xs text-muted tabular-nums sm:block">{assetMeta(asset)}</p>
              <p className="hidden w-24 shrink-0 text-2xs text-muted tabular-nums md:block">{assetDate(asset)}</p>
            </>
          ),
        };

        if (mode === 'pick') {
          return <Row key={asset.id} {...slots} onClick={() => props.onPick(asset)} primaryLabel={`Use ${asset.name}`} />;
        }
        const actions = <ManageActions asset={asset} onDelete={props.onDelete} />;
        if (props.onPreview) {
          const preview = props.onPreview;
          return (
            <Row
              key={asset.id}
              {...slots}
              onClick={() => preview(asset)}
              primaryLabel={`Preview ${asset.name}`}
              actions={actions}
            />
          );
        }
        return <Row key={asset.id} {...slots} actions={actions} />;
      })}
    </List>
  );
}
