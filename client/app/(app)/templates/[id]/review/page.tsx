import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { TemplateReview } from '~/components/template-review';
import { TemplateFrame } from '~/components/template-frame';
import { RefreshErrorState } from '~/components/dashboard/refresh-error-state';
import { serverFetch } from '~/lib/server-fetch';

export const metadata = { title: 'Sign-off | Temply', robots: 'noindex' };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId, orgRole } = await auth();
  if (!userId) redirect('/login');
  const { id } = await params;
  const [res, billingRes] = await Promise.all([
    serverFetch(`/api/v1/templates/${id}`).catch(() => null),
    serverFetch('/api/v1/billing').catch(() => null),
  ]);
  if (res?.status === 404) redirect('/dashboard/templates');
  // The route's layout is a bare column, so the frame is what gives a failed
  // load its way back, its tab row and its `main`. The template's name is the
  // thing that did not load, so the header carries the page's name instead.
  if (!res?.ok) {
    return (
      <TemplateFrame id={id} title="Sign-off">
        <RefreshErrorState description="We could not load this template for sign-off. Try again." />
      </TemplateFrame>
    );
  }
  const { template } = await res.json();
  const billing = billingRes?.ok ? await billingRes.json() : null;
  return <TemplateFrame id={id} title={template.title}><div className="mx-auto max-w-5xl"><TemplateReview key={`${id}:${template.staged_at ?? template.published_at}`} template={template}
    isAdmin={orgRole === 'org:admin'} userId={userId} readOnly={billing?.plan === 'lapsed'} /></div></TemplateFrame>;
}
