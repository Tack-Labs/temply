import { ArrowUpRightIcon, SparklesIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '~/components/ui/button';

/**
 * Shown when a plan limit is reached, above the list it caps. States the limit
 * and offers the way out, so the wall arrives before the click rather than as
 * an error after it.
 */
export function PlanLimitBanner({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent-wash bg-accent-wash/40 px-3.5 py-3 shadow-sm">
      <div className="flex items-start gap-2.5">
        <SparklesIcon className="mt-0.5 size-4 shrink-0 text-accent-ink" />
        <div>
          <p className="text-sm font-medium text-ink">{title}</p>
          <p className="mt-0.5 text-sm text-muted">{detail}</p>
        </div>
      </div>
      <Button variant="primary" asChild>
        <Link href="/dashboard/settings/plan">
          Upgrade
          <ArrowUpRightIcon />
        </Link>
      </Button>
    </div>
  );
}
