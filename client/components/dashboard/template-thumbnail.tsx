'use client';

import { useQuery } from '@tanstack/react-query';
import { MailIcon } from 'lucide-react';
import { useLayoutEffect, useState } from 'react';
import { useInView } from '~/hooks/use-in-view';
import { httpGet } from '~/lib/http';

/** The fixed width render() lays every email out at. */
const EMAIL_WIDTH = 600;
/** Wrapper aspect ratio (width / height); the iframe height follows from it. */
const THUMBNAIL_ASPECT = 8 / 5;

type TemplateThumbnailProps = {
  templateId: string;
  updatedAt: string | null;
};

/**
 * The template's own rendered HTML, scaled down into a card-sized window. It
 * lives in a sandboxed iframe on purpose: the email keeps its own theme's
 * colours and styles, fully isolated from app dark mode — the thumbnail must
 * show the email as recipients get it, never re-dressed in `--ds-*` tokens.
 */
export function TemplateThumbnail({ templateId, updatedAt }: TemplateThumbnailProps) {
  const { ref, inView } = useInView();
  const [scale, setScale] = useState<number | null>(null);

  const { data, isError } = useQuery({
    // Keyed on updatedAt so an edit invalidates the thumbnail naturally; the
    // matching ?v makes the response immutable-cacheable in the browser too.
    queryKey: ['template-preview', templateId, updatedAt],
    queryFn: () =>
      httpGet<{ html: string }>(
        `/api/v1/templates/${templateId}/preview`,
        updatedAt ? { v: updatedAt } : undefined,
      ),
    enabled: inView,
    staleTime: Infinity,
    retry: 1,
  });

  // Measure before first paint so the iframe never flashes at full size, then
  // track the wrapper as the grid reflows.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setScale(el.clientWidth / EMAIL_WIDTH);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setScale(entry.contentRect.width / EMAIL_WIDTH);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return (
    // pointer-events-none lets every click fall through to the Link wrapping
    // the card, so the thumbnail is decoration rather than a click target.
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none aspect-[8/5] overflow-hidden border-b border-line bg-sunken"
    >
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
          // Emails run taller than the crop; without this the frame draws a
          // scrollbar down the card's edge. Deprecated in HTML but the only
          // way in — CSS can't reach inside a sandboxed document.
          scrolling="no"
          className="border-0"
          style={{
            width: EMAIL_WIDTH,
            // Pre-scale height that fills the wrapper exactly: with the
            // aspect ratio fixed, wrapperHeight / scale is a constant.
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
