'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '~/components/ui/confirm-dialog';
import type { Asset } from '~/lib/assets';

/** The extension the server will store, from the browser's MIME. Mirrors
 *  EXT_BY_MIME on the server closely enough to compare names before upload;
 *  the server's own duplicate flag still covers anything this misses. */
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export function storedName(file: File): string {
  const stem = file.name.replace(/\.[^.]+$/, '') || 'image';
  const ext = EXT_BY_MIME[file.type] ?? file.name.split('.').pop()?.toLowerCase() ?? '';
  return ext ? `${stem}.${ext}` : stem;
}

/**
 * Asks before uploading a file whose name the library already holds. Same
 * name, different image, different id — allowed, but the person should
 * choose that rather than discover it. `check` resolves true to proceed.
 */
export function useDuplicateNameGuard(existing: Asset[]): {
  check: (file: File) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [asking, setAsking] = useState<string | null>(null);
  const resolver = useRef<((proceed: boolean) => void) | null>(null);
  // Read through a ref so `check` stays stable for document-level listeners.
  const names = useRef(new Set<string>());
  names.current = new Set(existing.map((asset) => asset.name.toLowerCase()));

  const check = useCallback((file: File) => {
    const name = storedName(file);
    if (!names.current.has(name.toLowerCase())) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setAsking(name);
    });
  }, []);

  const settle = (proceed: boolean) => {
    resolver.current?.(proceed);
    resolver.current = null;
    setAsking(null);
  };

  const dialog = (
    <ConfirmDialog
      open={asking !== null}
      onOpenChange={(open) => { if (!open) settle(false); }}
      title={asking ? `"${asking}" already exists` : ''}
      description="Adding it keeps both — they are separate images with their own links."
      confirmLabel="Add anyway"
      confirmVariant="primary"
      onConfirm={() => settle(true)}
    />
  );

  return { check, dialog };
}
