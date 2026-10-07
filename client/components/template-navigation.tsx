'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useGuardedLink } from '~/hooks/use-guarded-link';
import { cn } from '~/lib/classname';

const sections = [
  { path: '', label: 'Edit email' },
  { path: '/variables', label: 'Variables' },
  { path: '/versions', label: 'Versions' },
  { path: '/review', label: 'Review & release' },
  { path: '/connect', label: 'Connect your app' },
];

/**
 * The row of sections under the editor's header. The current one is bold and
 * carries a 3px violet underline, and says so to a screen reader with
 * `aria-current`; the underline is a fade-in on mount, so moving between
 * sections draws it rather than snapping it into place. `trailing` is the
 * row's right-hand end: the editor puts its view switch there, and the pages
 * that are not the editor leave it empty. When the two do not fit side by
 * side the trailing end wraps to a row of its own, and the tabs scroll
 * sideways rather than wrap, so the row is never more than two lines.
 */
export function TemplateNavigation({ id, beforeNavigate, trailing }: {
  id: string;
  beforeNavigate?: () => Promise<boolean>;
  trailing?: React.ReactNode;
}) {
  const pathname = usePathname();
  const guarded = useGuardedLink(beforeNavigate);
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 border-b-[1.5px] border-line bg-raised px-4 sm:px-7">
      {/* The padding and the equal negative margin give the focus ring room: a
          scroll container clips what is drawn outside its edge. */}
      <nav aria-label="Template" className="-mx-2 -my-2 flex max-w-full gap-1.5 overflow-x-auto px-2 py-2">
        {sections.map(({ path, label }) => {
          const href = `/templates/${id}${path}`;
          const current = pathname === href;
          return (
            <Link
              key={path}
              href={href}
              onClick={guarded(href)}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'relative inline-flex h-[54px] shrink-0 items-center rounded-field px-3.5 text-lg transition-colors duration-fast ease-out motion-reduce:transition-none',
                current ? 'font-bold text-ink' : 'font-semibold text-muted hover:text-ink',
              )}
            >
              {label}
              {current ? (
                <span
                  aria-hidden="true"
                  className="fade-in-mount absolute inset-x-3.5 bottom-0 h-[3px] rounded-t-[3px] bg-accent motion-reduce:transition-none"
                />
              ) : null}
            </Link>
          );
        })}
      </nav>
      {trailing ? <div className="flex items-center py-1.5">{trailing}</div> : null}
    </div>
  );
}
