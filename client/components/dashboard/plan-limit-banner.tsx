import { ArrowUpRightIcon, SparklesIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '~/components/ui/button';

/**
 * Shown when a plan limit is reached, above the list it caps. States the limit
 * and offers the way out, so the wall arrives before the click rather than as
 * an error after it. Some limits can't be bought past — keys and brands are
 * five on every plan — and there the way out is in the detail, not a button.
 */
export function PlanLimitBanner({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: { label: string; href: string } | null;
}) {
  return (
    // The page-level notice, in the accent's wash: a limit is information,
    // not a fault.
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-card bg-accent-wash px-6 py-4">
      <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
        <SparklesIcon aria-hidden className="mt-1 size-5 shrink-0 text-accent-ink" />
        <div className="min-w-0">
          <p className="text-18 font-bold text-accent-ink">{title}</p>
          <p className="mt-0.5 text-ui text-muted">{detail}</p>
        </div>
      </div>
      {action ? (
        <Button size="compact" variant="primary" asChild>
          <Link href={action.href}>
            {action.label}
            <ArrowUpRightIcon />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
