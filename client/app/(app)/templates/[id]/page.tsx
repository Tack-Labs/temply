import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { EmailEditorSandbox } from '~/components/email-editor-sandbox';
import { serverFetch } from '~/lib/server-fetch';
import type { Billing } from '~/lib/billing';

interface TemplatePageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Template | Temply',
  description: 'Edit your template.',
  robots: 'noindex',
};

export default async function TemplatePage({ params }: TemplatePageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  const { id } = await params;
  const res = await serverFetch(`/api/v1/templates/${id}`);
  if (!res.ok) redirect('/dashboard/templates');
  const { template } = await res.json();
  if (!template) redirect('/dashboard/templates');

  // A failed read of the plan leaves the editor open; the server still
  // refuses a write from a read-only workspace, with its own message.
  const billingRes = await serverFetch('/api/v1/billing').catch(() => null);
  const billing: Billing | null = billingRes?.ok ? await billingRes.json() : null;

  return (
    <EmailEditorSandbox
      key={template.id}
      template={template}
      autofocus="end"
      readOnly={billing?.plan === 'lapsed'}
    />
  );
}
