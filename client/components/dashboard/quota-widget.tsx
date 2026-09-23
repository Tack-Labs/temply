'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '~/components/ui/button';
import { httpGet } from '~/lib/http';

type Quota = {
  plan: 'free' | 'pro' | 'enterprise';
  cancelAt: string | null;
  api: { used: number; limit: number | null; remaining: number | null };
  resetsOn: string;
};

function formatReset(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function QuotaWidget() {
  const { data } = useQuery({
    queryKey: ['quota'],
    queryFn: () => httpGet<Quota>('/api/v1/quota', {}),
    staleTime: 30_000,
  });

  if (!data) return null;

  const { used, limit } = data.api;
  const unlimited = limit === null;
  const pct = unlimited || limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const over = !unlimited && pct >= 100;

  return (
    <div className="rounded-md border border-rail-line bg-rail-raised p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-rail-ink">
          <span className="capitalize">{data.plan} plan</span>
          {/* A scheduled cancellation is worth a glance from anywhere in the
              app, not only on the plan page. */}
          {data.cancelAt ? (
            <span className="font-normal text-rail-muted"> · ends {formatReset(data.cancelAt.slice(0, 10))}</span>
          ) : null}
        </span>
        {/* A percentage answers the question this widget exists for — how
            close am I? — in a glance. The exact counts are a click away on the
            plan page, and the progress bar's label carries them for anyone
            reading with assistive tech. */}
        <span className="text-2xs text-rail-muted tabular-nums">
          {unlimited ? `${used.toLocaleString()} · ∞` : `${pct}%`}
        </span>
      </div>
      {!unlimited ? (
        <div
          // The empty track has to read against the card it sits on. `hover`
          // is one value away from `raised`, so at zero usage — a new account,
          // every time — the bar looked missing rather than empty.
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-rail-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={`${used} of ${limit} monthly API calls used`}
        >
          <div className={over ? 'h-full rounded-full bg-danger' : 'h-full rounded-full bg-accent'} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <div className="mt-1.5 flex items-center justify-between text-2xs text-rail-muted">
        <span>API calls this month</span>
        <span>resets {formatReset(data.resetsOn)}</span>
      </div>
      {data.plan === 'free' ? (
        <Button variant="primary" size="sm" asChild className="mt-2 w-full">
          <Link href="/dashboard/settings/plan">Upgrade</Link>
        </Button>
      ) : null}
    </div>
  );
}
