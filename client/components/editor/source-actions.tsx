'use client';

import { CheckIcon, CopyIcon, DownloadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useCopyToClipboard } from '~/hooks/use-copy-to-clipboard';
import { cn } from '~/lib/classname';
import { Button } from '../ui/button';

// A leaf module: the view switch and the phone's sheets both import these, and
// the sandbox imports both of them, so these cannot live in the sandbox's file
// without that file importing itself back through them.

/** A file name from the subject line: "Welcome to Temply" → welcome-to-temply. */
export function fileSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'email';
}

/**
 * Saves what the view shows as a file. The escape hatch that makes the
 * product safe to try: the HTML is yours, with or without an account.
 * Nothing is rendered again — it is the same source the pane is showing.
 */
export function DownloadButton({ content, filename, mimeType, label }: { content: string; filename: string; mimeType: string; label: string }) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    // The browser has the blob by now; the URL only needs to outlive the click.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Button variant="ghost" size="icon" className="size-10 [&_svg]:size-5" aria-label={label} title={label} onClick={download} disabled={!content}>
      <DownloadIcon />
    </Button>
  );
}

/** Copies the source already on screen — no second render to fetch it. The
 *  label names what is being copied: the same pane serves HTML and text. */
export function CopyHtmlButton({ html, label = 'Copy HTML' }: { html: string; label?: string }) {
  // Through the hook, not navigator.clipboard directly: the phone is opened
  // over plain http on the LAN, where the API is undefined and a bare call
  // rejects into nothing. A copy that cannot happen has to say so.
  const [copiedText, copy] = useCopyToClipboard();
  const copied = copiedText === html;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      onClick={async () => {
        if (!(await copy(html))) toast.error('Could not copy. This browser blocks clipboard access.');
      }}
      className={cn('size-10 [&_svg]:size-5', copied && 'text-accent-ink hover:text-accent-ink')}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
