import { useEffect, useState } from 'react';

export type ImageUrlStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok' }
  | { kind: 'insecure' }
  | { kind: 'unreachable' }
  | { kind: 'variable' };

/**
 * Answers the question the sender actually has about a pasted image URL: will
 * the recipient see it? A format check only tells you the string looks like a
 * URL — a perfectly-formed `https://example.com/logo.png` that 404s is exactly
 * the case that ships silently.
 *
 * Uses `new Image()` rather than `fetch`, so it is not subject to CORS: the
 * browser loads the image the same way a mail client would. A server that
 * blocks hotlinking will report a failure here — but that is a true signal,
 * because the recipient's client would be blocked the same way.
 */
export function useImageUrlStatus(url: string, isVariable: boolean): ImageUrlStatus {
  const [status, setStatus] = useState<ImageUrlStatus>({ kind: 'idle' });

  useEffect(() => {
    if (isVariable) {
      setStatus({ kind: 'variable' });
      return;
    }

    const trimmed = url.trim();
    if (!trimmed) {
      setStatus({ kind: 'idle' });
      return;
    }

    // Flag http before spending a load on it: mail clients block or warn on
    // mixed/insecure images, so this is worth saying regardless of whether the
    // image happens to load right now.
    if (/^http:\/\//i.test(trimmed)) {
      setStatus({ kind: 'insecure' });
      return;
    }

    let cancelled = false;
    setStatus({ kind: 'checking' });

    const img = new Image();
    img.onload = () => {
      if (!cancelled) setStatus({ kind: 'ok' });
    };
    img.onerror = () => {
      if (!cancelled) setStatus({ kind: 'unreachable' });
    };
    img.src = trimmed;

    return () => {
      cancelled = true;
      // Drop the handlers so a late load/error cannot set state after unmount.
      img.onload = null;
      img.onerror = null;
    };
  }, [url, isVariable]);

  return status;
}

export function imageUrlMessage(status: ImageUrlStatus): { tone: 'muted' | 'warn'; text: string } | null {
  switch (status.kind) {
    case 'checking':
      return { tone: 'muted', text: 'Checking the image…' };
    case 'ok':
      return { tone: 'muted', text: 'Loads fine.' };
    case 'insecure':
      return {
        tone: 'warn',
        text: 'This is an http link. Many email clients block insecure images — use https.',
      };
    case 'unreachable':
      return {
        tone: 'warn',
        text: 'This did not load. Recipients may not see it either. Check the link is public and points straight at an image.',
      };
    default:
      return null;
  }
}
