'use client';

import { EDITOR_SHORTCUTS, formatKeys } from '~/lib/editor-shortcuts';
import { useIsApple } from '~/lib/use-platform';
import { cn } from '~/lib/classname';

/**
 * The same list the editor's own cheatsheet shows, from the same source. Two
 * copies of a shortcut list disagree within a month.
 *
 * A client component only so the keys can be written for the reader's own
 * platform; the content itself never changes.
 */
export function ShortcutTable() {
  const isApple = useIsApple();

  return (
    <div className="mt-6 grid gap-x-10 gap-y-7 sm:grid-cols-2">
      {EDITOR_SHORTCUTS.map((group) => (
        <section key={group.title}>
          <h4 className="font-mono text-2xs tracking-[0.16em] text-accent-ink uppercase">
            {group.title}
          </h4>
          <dl className="mt-3 space-y-2">
            {group.items.map((item) => (
              <div key={item.keys} className="flex items-baseline gap-3">
                <dt className="shrink-0">
                  {/* Held invisible rather than guessed: the key stays in the
                      markup for anything reading the page, and nobody is shown
                      the wrong one for a frame. */}
                  <kbd
                    className={cn(
                      'rounded-xs border border-line bg-raised px-1.5 py-0.5 font-mono text-2xs text-ink',
                      isApple === null && 'opacity-0'
                    )}
                  >
                    {formatKeys(item.keys, isApple ?? true)}
                  </kbd>
                </dt>
                <dd className="text-sm text-muted">{item.what}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
