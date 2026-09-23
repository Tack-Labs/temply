'use client';

import { useEffect, useState } from 'react';
import { LayoutGridIcon, ListIcon } from 'lucide-react';
import { pressable } from '~/components/ui/button';
import { cn } from '~/lib/classname';

export type AssetView = 'grid' | 'list';

const VIEWS: { value: AssetView; label: string; icon: React.ReactNode }[] = [
  { value: 'grid', label: 'Grid', icon: <LayoutGridIcon className="size-3.5" /> },
  { value: 'list', label: 'List', icon: <ListIcon className="size-3.5" /> },
];

/** 24px segment plus the 2px gap between them — same geometry as the
 *  editor's content-mode switch, so the two controls read as one family. */
const SEGMENT_STEP = 26;
const STORAGE_KEY = 'temply.assets.view';

/** The chosen view, remembered per browser. Storage can be unavailable
 *  (private mode, blocked site data), so every access is guarded and the
 *  grid is the answer whenever nothing is stored. */
export function useAssetView(): [AssetView, (next: AssetView) => void] {
  const [view, setView] = useState<AssetView>('grid');
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'grid' || stored === 'list') setView(stored);
    } catch {
      // No storage — the default stands.
    }
  }, []);
  const choose = (next: AssetView) => {
    setView(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered this time; the control still works.
    }
  };
  return [view, choose];
}

export function AssetViewSwitch({
  view,
  onViewChange,
}: {
  view: AssetView;
  onViewChange: (next: AssetView) => void;
}) {
  const index = VIEWS.findIndex((entry) => entry.value === view);

  return (
    <div
      role="group"
      aria-label="Library view"
      className="relative flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5"
    >
      <span
        aria-hidden
        className="absolute top-0.5 left-0.5 size-6 rounded-sm bg-accent-wash transition-transform duration-slow ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(${Math.max(index, 0) * SEGMENT_STEP}px)` }}
      />
      {VIEWS.map((entry) => (
        <button
          key={entry.value}
          type="button"
          aria-label={entry.label}
          aria-pressed={entry.value === view}
          title={entry.label}
          onClick={() => onViewChange(entry.value)}
          className={cn(
            'relative z-10 flex size-6 items-center justify-center rounded-sm bg-transparent',
            pressable,
            entry.value === view ? 'text-accent-ink' : 'text-muted hover:text-ink',
          )}
        >
          {entry.icon}
        </button>
      ))}
    </div>
  );
}
