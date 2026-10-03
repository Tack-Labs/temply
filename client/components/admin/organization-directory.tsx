import Link from 'next/link';
import { Building2Icon } from 'lucide-react';
import type { AdminOrganizations } from '@temply/shared/admin';
import { formatBytes } from '@temply/shared/bytes';
import { Badge, Card, EmptyState } from '~/components/ui/surfaces';
import { Button } from '~/components/ui/button';

const count = (value: number) => value.toLocaleString('en-GB');
const date = (value: string | number) => new Date(value).toLocaleDateString('en-GB', {
  timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric',
});

const PLAN_LABELS = {
  'not-started': 'Not started', trial: 'Trial', lapsed: 'Read-only', team: 'Team', enterprise: 'Enterprise',
} as const;

function pageHref(page: number, query: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set('q', query);
  return `/dashboard/admin?${params}`;
}

/** Member counts are memberships: the same person can belong to several organisations. */
export function OrganizationDirectory({ data, query }: { data: AdminOrganizations; query: string }) {
  const first = (data.page - 1) * data.pageSize + 1;
  const last = first + data.organizations.length - 1;
  const month = new Date(`${data.period}-01T12:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'Europe/London', month: 'long', year: 'numeric',
  });

  return (
    <section aria-label="Organisations" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="font-medium text-ink">{count(data.totalCount)} {query ? 'matching ' : ''}organisations</p>
        <p className="text-muted">API usage for {month} · Europe/London</p>
      </div>
      <p className="text-xs text-muted">Members are counted per organisation. Usage counts successful API calls.</p>

      {data.organizations.length ? (
        <ul className="space-y-3">
          {data.organizations.map((organization) => {
            const sub = organization.subscription;
            return (
              <li key={organization.id}>
                <Card className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <h2 className="break-words font-display text-base font-semibold tracking-display text-ink">{organization.name}</h2>
                    <p className="mt-1 break-all font-mono text-2xs text-muted">{organization.id}</p>
                    <p className="mt-2 text-xs text-muted">Joined {date(organization.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Members</p>
                    <p className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">
                      {organization.members === null ? 'Unavailable' : count(organization.members)}
                    </p>
                    {sub.seats !== null ? <p className="mt-1 text-xs text-muted">{count(sub.seats)} subscription seats</p> : null}
                  </div>
                  <dl className="grid content-start grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm tabular-nums">
                    <dt className="text-muted">Live API calls</dt><dd className="text-ink">{count(organization.usage.liveCalls)}</dd>
                    <dt className="text-muted">Test API calls</dt><dd className="text-ink">{count(organization.usage.testCalls)}</dd>
                    <dt className="text-muted">Templates</dt><dd className="text-ink">{count(organization.usage.templates)}</dd>
                    <dt className="text-muted">Storage</dt><dd className="text-ink">{formatBytes(organization.usage.storageBytes)}</dd>
                  </dl>
                  <div className="space-y-1.5 text-xs text-muted">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={sub.plan === 'lapsed' ? 'warn' : sub.plan === 'not-started' ? 'neutral' : 'accent'}>{PLAN_LABELS[sub.plan]}</Badge>
                      {sub.status ? <Badge tone={sub.status === 'past_due' ? 'warn' : 'neutral'}>{sub.status.replaceAll('_', ' ')}</Badge> : null}
                    </div>
                    {sub.plan === 'not-started' ? <p>Workspace has not been opened yet.</p> : null}
                    {sub.trialEndsAt && sub.plan === 'trial' ? <p>Trial ends {date(sub.trialEndsAt)}</p> : null}
                    {sub.currentPeriodEnd ? <p>Billing period ends {date(sub.currentPeriodEnd)}</p> : null}
                    {sub.cancelAt ? <p>Cancellation {date(sub.cancelAt)}</p> : null}
                    {sub.templatePacks ? <p>{count(sub.templatePacks)} template packs</p> : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={Building2Icon} title="No organisations found" description={query ? 'Try a different name or organisation ID.' : 'There are no organisations on this page.'} />
      )}

      <nav aria-label="Organisation pages" className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted">{data.organizations.length ? `${count(first)}–${count(last)} of ${count(data.totalCount)}` : `Page ${count(data.page)}`}</p>
        <div className="flex gap-2">
          {data.page > 1 ? <Button variant="secondary" size="sm" touch asChild><Link href={pageHref(data.page - 1, query)}>Previous</Link></Button> : null}
          {data.page * data.pageSize < data.totalCount ? <Button variant="secondary" size="sm" touch asChild><Link href={pageHref(data.page + 1, query)}>Next</Link></Button> : null}
        </div>
      </nav>
    </section>
  );
}
