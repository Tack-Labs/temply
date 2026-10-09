'use client';

import { useEffect, useState } from 'react';
import { LayoutGridIcon, ListIcon } from 'lucide-react';
import { pressable } from '~/components/ui/button';
import { cn } from '~/lib/classname';

export type AssetView = 'grid' | 'list';

const VIEWS: { value: AssetView; label: string; icon: React.ReactNode }[] = [
  { value: 'grid', label: 'Grid', icon: <LayoutGridIcon className="size-4" /> },
  { value: 'list', label: 'List', icon: <ListIcon className="size-4" /> },
];

/** 40px segment plus the 2px gap between them: the segmented control's own
 *  geometry, so this reads as one family with the filters beside it and the
 *  editor's view switch, and stands the search field's 48px tall in its
 *  track. */
const SEGMENT_STEP = 42;
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
      className="relative flex items-center gap-0.5 rounded-full bg-track p-1"
    >
      {/* The chosen pill slides between the two; the segmented control's
          own pill does not move, but here the two options are icons of one
          size, so the travel reads as the choice changing hands. */}
      <span
        aria-hidden
        className="absolute top-1 left-1 size-10 rounded-full bg-raised shadow-sm transition-transform duration-slow ease-out motion-reduce:transition-none"
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
            'relative z-10 flex size-10 items-center justify-center rounded-full bg-transparent',
            pressable,
            entry.value === view ? 'text-ink' : 'text-ink-soft hover:text-ink',
          )}
        >
          {entry.icon}
        </button>
      ))}
    </div>
  );
}
