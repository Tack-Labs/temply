import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import type { AdminOrganizations } from '@temply/shared/admin';
import { OrganizationDirectory } from '~/components/admin/organization-directory';
import { RefreshErrorState } from '~/components/dashboard/refresh-error-state';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { PageHeader } from '~/components/ui/surfaces';
import { serverFetch } from '~/lib/server-fetch';

export const metadata: Metadata = { title: 'Temply admin' };

export default async function AdminPage({ searchParams }: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect('/login');
  if (!orgId || orgRole !== 'org:admin') notFound();
  const params = await searchParams;
  const rawPage = Number(params.page ?? 1);
  const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 100_000 ? rawPage : 1;
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const response = await serverFetch(`/api/v1/admin/organizations?${new URLSearchParams({ page: String(page), q: query })}`, {
    cache: 'no-store',
  }).catch(() => null);
  if (response?.status === 401) redirect('/login');
  if (response?.status === 403) notFound();
  const data: AdminOrganizations | null = response?.ok ? await response.json().catch(() => null) : null;

  return (
    <div className="fade-in-mount space-y-6 motion-reduce:transition-none">
      <PageHeader title="Temply admin" description="Organisations, members, usage and subscriptions across Temply." />
      <form action="/dashboard/admin" method="get" className="space-y-2">
        <label htmlFor="organisation-search" className="text-sm font-medium text-ink">Find an organisation</label>
        <div className="flex flex-wrap items-center gap-2">
          <Input id="organisation-search" name="q" defaultValue={query} maxLength={100} placeholder="Name or organisation ID" className="min-w-0 flex-1 basis-48" />
          <Button size="compact" type="submit" variant="secondary">Search</Button>
          {query ? <Button size="compact" variant="link" asChild><Link href="/dashboard/admin">Clear</Link></Button> : null}
        </div>
      </form>
      {data ? <OrganizationDirectory data={data} query={query} /> : (
        <RefreshErrorState title="Organisations could not be loaded" description="We could not load the organisation directory. Try again to see the latest figures." />
      )}
    </div>
  );
}
