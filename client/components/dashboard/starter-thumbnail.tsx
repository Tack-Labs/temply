'use client';

import { useQuery } from '@tanstack/react-query';
import { MailIcon } from 'lucide-react';
import { useLayoutEffect, useState } from 'react';
import { useInView } from '~/hooks/use-in-view';
import { httpPost } from '~/lib/http';
import type { StarterTemplate } from '~/lib/starter-templates';

/** The fixed width the renderer lays every email out at. */
const EMAIL_WIDTH = 600;
/** Wrapper aspect ratio (width / height); the iframe height follows from it. */
const THUMBNAIL_ASPECT = 8 / 5;

/**
 * A starter rendered by the real engine and scaled into the gallery tile, so
 * the choice is between emails, not icons. The starters are static, so each
 * render is kept for the session; the preview endpoint draws placeholders
 * in the pills and the Temply mark in the logo slot, the way the finished
 * template will look before the user touches it.
 */
export function StarterThumbnail({ starter }: { starter: StarterTemplate }) {
  const { ref, inView } = useInView();
  const [scale, setScale] = useState<number | null>(null);

  const { data, isError } = useQuery({
    queryKey: ['starter-preview', starter.id],
    queryFn: () =>
      httpPost<{ html: string }>('/api/v1/emails/preview', {
        content: starter.content,
        previewText: starter.previewText,
      }),
    enabled: inView,
    staleTime: Infinity,
    retry: 1,
  });

  // Measure before first paint so the iframe never flashes at full size.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setScale(el.clientWidth / EMAIL_WIDTH);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setScale(entry.contentRect.width / EMAIL_WIDTH);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return (
    // Decoration inside the tile's button: clicks fall through to it.
    <div ref={ref} aria-hidden="true" className="pointer-events-none aspect-[8/5] overflow-hidden bg-sunken">
      {isError ? (
        <div className="flex h-full flex-col items-center justify-center gap-1.5">
          <MailIcon className="size-5 text-faint" />
          <span className="text-xs text-muted">Preview unavailable</span>
        </div>
      ) : data && scale !== null ? (
        // biome-ignore lint/a11y/useIframeTitle: decoration, aria-hidden — the card's link carries the name
        <iframe
          srcDoc={data.html}
          sandbox=""
          tabIndex={-1}
          aria-hidden="true"
          title=""
          loading="lazy"
          // The email runs taller than the crop; without this the frame
          // draws a scrollbar down the tile's edge.
          scrolling="no"
          className="fade-in-mount border-0"
          style={{
            width: EMAIL_WIDTH,
            height: EMAIL_WIDTH / THUMBNAIL_ASPECT,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      ) : (
        <div className="size-full animate-pulse bg-active" />
      )}
    </div>
  );
}
