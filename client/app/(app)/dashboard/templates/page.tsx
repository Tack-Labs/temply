import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { FileTextIcon } from 'lucide-react';
import { NewTemplateButton } from '~/components/dashboard/new-template-button';
import { PlanLimitBanner } from '~/components/dashboard/plan-limit-banner';
import { TemplateList } from '~/components/dashboard/template-list';
import { EmptyState, ErrorState, PageHeader } from '~/components/ui/surfaces';
import { serverFetch } from '~/lib/server-fetch';
import type { TemplateListItem } from '~/lib/template-search';
import { isLimitReached } from '@temply/shared/plans';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const { userId } = await auth();

  if (!userId) redirect('/login');

  // A failed request used to be coerced into an empty list, which drew the
  // "no templates yet" screen — indistinguishable from an account that really
  // is empty. Keep the two apart.
  const [res, billingRes] = await Promise.all([
    serverFetch('/api/v1/templates'),
    serverFetch('/api/v1/billing').catch(() => null),
  ]);
  const failed = !res.ok;
  const { templates = [] }: { templates: TemplateListItem[] } = failed
    ? { templates: [] }
    : await res.json();

  // The API returns full rows — content, theme, user_id and all. Project down
  // to the fields the list renders before the array crosses into the client
  // component, so nothing else rides along in the RSC payload.
  const list: TemplateListItem[] = templates.map(
    (template): TemplateListItem => ({
      id: template.id,
      title: template.title,
      preview_text: template.preview_text ?? null,
      short_code: template.short_code ?? null,
      updated_at: template.updated_at ?? null,
      published_at: template.published_at ?? null,
      has_unpublished_changes: template.has_unpublished_changes ?? false,
    }),
  );

  const billing = billingRes?.ok ? await billingRes.json() : null;
  const templateLimit = billing?.limits?.maxTemplates ?? null;
  const atLimit = billing ? isLimitReached(billing.usage?.templates ?? templates.length, templateLimit) : false;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Templates"
        description="Every email you have built here."
        actions={<NewTemplateButton disabled={atLimit} />}
      />

      {atLimit ? (
        <PlanLimitBanner
          title={`You've used all ${templateLimit} templates on the Free plan.`}
          detail="Upgrade to Pro for unlimited templates."
        />
      ) : null}

      {failed ? (
        <ErrorState description="We could not reach the server, so your templates are not shown. This is not a sign that they are gone." />
      ) : list.length === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title="No templates yet"
          description="Start one and it will appear here, ready to edit or send."
          action={<NewTemplateButton />}
        />
      ) : (
        <TemplateList templates={list} canDuplicate={!atLimit} />
      )}
    </div>
  );
}
