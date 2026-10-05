import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRightIcon, PlugIcon } from 'lucide-react';
import { serverFetch } from '~/lib/server-fetch';
import type { TemplateListItem } from '~/lib/template-search';
import { NewTemplateButton } from '~/components/dashboard/new-template-button';
import { RefreshErrorState } from '~/components/dashboard/refresh-error-state';
import { Card, EmptyState, PageHeader } from '~/components/ui/surfaces';

export const metadata = { title: 'Connect your app', robots: 'noindex' };
export default async function ConnectPage() {
  const { userId } = await auth();
  if (!userId) redirect('/login');
  const response = await serverFetch('/api/v1/templates').catch(() => null);
  if (!response?.ok) return <RefreshErrorState description="We could not load your templates. Try again to choose one to connect." />;
  const { templates } = await response.json() as { templates: TemplateListItem[] };
  return <div className="space-y-6">
    <PageHeader title="Connect your app" description="Choose an email to get setup steps with its details already filled in. You can follow them or share them with a developer." />
    <Card className="bg-accent-wash p-5"><h2 className="font-display text-lg font-semibold text-ink">Design here. Send from your app.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">Your app tells Temply which email it needs and supplies the customer’s details. Temply returns the finished email. Your existing email provider delivers it.</p></Card>
    {!templates.length ? <EmptyState icon={PlugIcon} title="Start with your first email" description="Create a template before connecting it to your app. A starter gives you something to try straight away." action={<NewTemplateButton />} /> :
      <div className="grid gap-4 sm:grid-cols-2">{templates.map((template) => <Link key={template.id} href={`/templates/${template.id}/connect`}>
        <Card interactive className="flex h-full items-center gap-4 p-5"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-wash text-accent-ink"><PlugIcon className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="break-words text-base font-medium text-ink">{template.title}</h2><p className="mt-1 text-sm text-muted">Open the four setup steps</p></div><ArrowRightIcon className="size-4 shrink-0 text-muted" /></Card>
      </Link>)}</div>}
  </div>;
}
