import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { NewTemplateButton } from '~/components/dashboard/new-template-button';
import { PlanLimitBanner } from '~/components/dashboard/plan-limit-banner';
import { RefreshErrorState } from '~/components/dashboard/refresh-error-state';
import { TemplateList } from '~/components/dashboard/template-list';
import { PageHeader } from '~/components/ui/surfaces';
import { serverFetch } from '~/lib/server-fetch';
import type { TemplateListItem } from '~/lib/template-search';
import { PLAN_PAGE, type Billing } from '~/lib/billing';
import { INCLUDED, PRICES_USD, TEMPLATE_PACK, formatUsd, isLimitReached } from '@temply/shared/plans';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const { userId, orgRole } = await auth();

  if (!userId) redirect('/login');

  // A failed request used to be coerced into an empty list, which drew the
  // "no templates yet" screen — indistinguishable from an account that really
  // is empty. Keep the two apart. A request that throws (the API unreachable,
  // or past its timeout) is as much a failed load as one answered with an
  // error, and gets the same retry rather than the app's error page.
  const [res, billingRes] = await Promise.all([
    serverFetch('/api/v1/templates').catch(() => null),
    serverFetch('/api/v1/billing').catch(() => null),
  ]);
  const failed = !res?.ok;
  const { templates = [] }: { templates?: TemplateListItem[] } = res?.ok ? await res.json() : {};

  // Project the list's contract before it crosses into the client component.
  const list: TemplateListItem[] = templates.map(
    (template): TemplateListItem => ({
      id: template.id,
      title: template.title,
      preview_text: template.preview_text ?? null,
      short_code: template.short_code ?? null,
      updated_at: template.updated_at ?? null,
      published_at: template.published_at ?? null,
      has_unpublished_changes: template.has_unpublished_changes ?? false,
      staged_at: template.staged_at ?? null,
      review_requested_at: template.review_requested_at ?? null,
      review_requested_by: template.review_requested_by ?? null,
      returned_at: template.returned_at ?? null,
      live_version: template.live_version ?? null,
    }),
  );

  const billing: Billing | null = billingRes?.ok ? await billingRes.json() : null;
  const templateLimit = billing?.limits.maxTemplates ?? null;
  const atLimit = billing ? isLimitReached(billing.usage.templates, templateLimit) : false;
  // A read-only workspace can't make anything; the dashboard's banner says
  // why, so the list only takes away the controls.
  const readOnly = billing?.plan === 'lapsed';
  const isAdmin = orgRole === 'org:admin';
  const pack = `${TEMPLATE_PACK.templates} more at ${formatUsd(PRICES_USD.templatePack)} a month each`;
  const limitBanner =
    !atLimit || readOnly
      ? null
      : billing?.plan === 'trial'
        ? {
            title: `You've used all ${INCLUDED.templates} templates in your trial.`,
            detail: isAdmin
              ? `Subscribe, then add a template pack for ${pack}.`
              : `Ask an admin to subscribe; template packs add ${pack}.`,
            action: isAdmin ? { label: 'Subscribe', href: PLAN_PAGE } : null,
          }
        : {
            title: `You've used all ${templateLimit} templates on your plan.`,
            detail: isAdmin
              ? `Add a template pack for ${pack}.`
              : `Ask an admin to add a template pack for ${pack}.`,
            action: isAdmin ? { label: 'Add a pack', href: PLAN_PAGE } : null,
          };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Templates"
        description="Every email you have built here."
        actions={<NewTemplateButton disabled={atLimit || readOnly} />}
      />

      {limitBanner ? <PlanLimitBanner {...limitBanner} /> : null}

      {failed ? (
        <RefreshErrorState description="We could not reach the server, so your templates are not shown. This is not a sign that they are gone." />
      ) : (
        // The list draws the empty account's invitation itself rather than the
        // page swapping it in: deleting the last template then empties a list
        // that stays mounted, which is what lets it keep the reader's focus.
        <TemplateList
          templates={list}
          canDuplicate={!atLimit && !readOnly}
          isAdmin={isAdmin}
          readOnly={readOnly}
          emptyAction={<NewTemplateButton disabled={readOnly} />}
        />
      )}
    </div>
  );
}
