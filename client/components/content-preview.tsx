'use client';

import { Loader2Icon } from 'lucide-react';
import { EmailPreviewIFrame } from './email-preview-iframe';
import { cn } from '~/lib/classname';

/**
 * The Content section in preview mode: the inbox line an email arrives on,
 * then the email itself. Both were previously locked inside a modal.
 */
export function ContentPreview({
  html,
  isPending,
  forceDark,
  subject,
  previewText,
  from,
  className,
  minHeight,
}: {
  html: string;
  isPending: boolean;
  forceDark: boolean;
  subject: string;
  previewText: string;
  from: string;
  className?: string;
  /** The height the editor occupied, so the swap does not move the page. */
  minHeight?: number;
}) {
  const senderName = from.trim() || 'Your sender address';
  const senderInitial = (from.trim()[0] ?? '?').toUpperCase();

  return (
    // The height the editor had, held by the whole pane rather than the frame
    // alone — the inbox strip above it counts toward what the section occupied.
    <div
      className={cn('flex flex-col gap-3 bg-sunken p-3.5', className)}
      style={{ minHeight: minHeight ? `${minHeight}px` : undefined }}
    >
      <div className="flex items-start gap-3 rounded-xl border border-line bg-raised p-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-hover text-sm font-medium text-muted">
          {senderInitial}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate text-sm font-medium text-ink">{senderName}</h3>
          <h4 className="truncate text-sm text-ink">{subject || 'No subject yet'}</h4>
          <p className="truncate text-sm text-muted">
            {previewText ||
              'No preview text. Inboxes will show the opening line instead.'}
          </p>
        </div>
      </div>

      {/* The frame grows with the email and the page scrolls, so the card
          has one scrollbar, the frame's own, and not a second inside it. */}
      <div className="relative flex w-full flex-1 overflow-hidden rounded-xl border border-line bg-canvas">
        <EmailPreviewIFrame
          wrapperClassName="w-full"
          className="block w-full"
          innerHTML={html}
          forceDark={forceDark}
          autoHeight
        />
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-canvas/60">
            <Loader2Icon className="size-5 animate-spin text-faint" />
          </div>
        )}
      </div>
    </div>
  );
}
