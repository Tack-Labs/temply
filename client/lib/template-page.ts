import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { Mail } from '@temply/shared/schema';
import type { Billing } from './billing';
import { serverFetch } from './server-fetch';

export type TemplatePageRow = Mail & { live_version?: number | null };

export async function loadTemplatePage(id: string) {
  const { userId, orgRole } = await auth();
  if (!userId) redirect('/login');
  const [response, billingResponse] = await Promise.all([
    serverFetch(`/api/v1/templates/${id}`),
    serverFetch('/api/v1/billing').catch(() => null),
  ]);
  if (response.status === 404) redirect('/dashboard/templates');
  if (!response.ok) throw new Error('Could not load this template. Try again.');
  const { template } = await response.json() as { template: TemplatePageRow };
  if (!template) redirect('/dashboard/templates');
  const billing: Billing | null = billingResponse?.ok ? await billingResponse.json() : null;
  return { template, readOnly: billing?.plan === 'lapsed', isAdmin: orgRole === 'org:admin' };
}
