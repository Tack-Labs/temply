'use client';

import { CheckCircle2Icon, LayoutTemplateIcon, MailIcon, PaletteIcon, SlidersHorizontalIcon } from 'lucide-react';
import { pressable } from '~/components/ui/button';
import { cn } from '~/lib/classname';

export type IdleTab = 'details' | 'brand' | 'data' | 'checks';

const TABS: Array<{ id: IdleTab; label: string; icon: typeof MailIcon }> = [
  { id: 'details', label: 'Details', icon: MailIcon },
  { id: 'brand', label: 'Brand', icon: PaletteIcon },
  { id: 'data', label: 'Data', icon: SlidersHorizontalIcon },
  { id: 'checks', label: 'Checks', icon: CheckCircle2Icon },
];

/**
 * The bottom bar: a read-only canvas never raises a selection, so this is
 * the sections nav and nothing else — Content plus the four tabs, each one
 * a disclosure onto a sheet the shell owns.
 */
export function EditorBottomBar({
  checksCount,
  openTab,
  onOpenTab,
}: {
  checksCount: { errors: number; warnings: number };
  // Which sheet each trigger has open. Every one of them is a disclosure, and
  // a disclosure that never says it is expanded reads as a plain button to a
  // screen reader.
  openTab: IdleTab | null;
  onOpenTab: (tab: IdleTab) => void;
}) {
  const badge = checksCount.errors > 0 ? { n: checksCount.errors, tone: 'danger' as const } : checksCount.warnings > 0 ? { n: checksCount.warnings, tone: 'warn' as const } : null;

  return (
    <div data-editor-bottom-bar className="relative z-40 shrink-0 border-t border-line bg-raised pb-[env(safe-area-inset-bottom)]">
      <nav aria-label="Editor sections" className="flex min-h-14 items-stretch justify-around">
        <span className="flex min-w-16 flex-col items-center justify-center gap-0.5 text-2xs font-medium text-accent-ink">
          <LayoutTemplateIcon className="size-5" />
          Content
        </span>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            // Without this the badge's bare number joins the label and the
            // tab is announced as "Checks1".
            aria-label={tab.id === 'checks' && badge ? `${tab.label}, ${badge.n} ${badge.tone === 'danger' ? (badge.n === 1 ? 'error' : 'errors') : badge.n === 1 ? 'warning' : 'warnings'}` : undefined}
            aria-haspopup="dialog"
            aria-expanded={openTab === tab.id}
            onClick={() => onOpenTab(tab.id)}
            className={cn('relative flex min-w-16 flex-col items-center justify-center gap-0.5 text-2xs text-muted hover:text-ink', pressable)}
          >
            <tab.icon className="size-5" />
            {tab.label}
            {tab.id === 'checks' && badge ? (
              <span className={cn('absolute top-1.5 right-3 min-w-4 rounded-full px-1 text-center text-2xs font-semibold text-white', badge.tone === 'danger' ? 'bg-danger' : 'bg-warn')}>
                {badge.n}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
    </div>
  );
}
