import { auth, currentUser } from '@clerk/nextjs/server';
import { isLimitReached } from '@temply/shared/plans';
import { redirect } from 'next/navigation';
import { NewTemplateButton } from '~/components/dashboard/new-template-button';
import { NextStepBanner } from '~/components/dashboard/next-step-banner';
import { RecentTemplates } from '~/components/dashboard/recent-templates';
import { StarterChips } from '~/components/dashboard/starter-chips';
import { UsageSection } from '~/components/dashboard/usage-section';
import { PageHeader } from '~/components/ui/surfaces';
import type { Billing } from '~/lib/billing';
import { pickNextStep } from '~/lib/next-step';
import { serverFetch } from '~/lib/server-fetch';
import type { TemplateListItem } from '~/lib/template-search';

export const dynamic = 'force-dynamic';

/** How many templates the home shows; the rest are one "View all" away. */
const RECENT_COUNT = 5;

/** The body of an answer that was ok, or null for anything else, a throw and an unreadable body included. */
async function readJson<T>(res: Response | null): Promise<T | null> {
  if (!res?.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * The billing body when it has what the page and its tiles read without a
 * look first, null when it does not. An answer that is ok and lacks them (a
 * proxy's placeholder, a body from a version that has moved on) is a failed
 * load, which the usage section says for itself; left to be read, it would
 * throw past the section into the app's error page.
 */
function readBilling(body: Partial<Billing> | null): Billing | null {
  return body?.usage && body.limits && body.overage ? (body as Billing) : null;
}

/**
 * The template rows when the body is a list of them, null when it is not. The
 * same reasoning as billing, with a sharper edge: an ok answer without a
 * `templates` array, read as "no rows", draws the empty state and tells a
 * customer with forty templates that they have none. Each row is checked for
 * the two fields every card keys and titles itself by, which the schema
 * guarantees (`id`, and `title` is `notNull`).
 */
function readTemplates(body: unknown): TemplateListItem[] | null {
  const list = (body as { templates?: unknown } | null)?.templates;
  if (!Array.isArray(list)) return null;
  const isRow = (row: unknown): row is TemplateListItem =>
    typeof row === 'object' &&
    row !== null &&
    typeof (row as { id?: unknown }).id === 'string' &&
    typeof (row as { title?: unknown }).title === 'string';
  return list.every(isRow) ? list : null;
}

export default async function DashboardPage() {
  const { userId, orgRole } = await auth();

  if (!userId) redirect('/login');

  // Each read can fail on its own, and the page says which one did: a failed
  // templates fetch is not an empty account, and a failed billing fetch is
  // not a free plan. Neither takes the other's half of the page down. The
  // greeting needs only the user, so all three are started together: asked in
  // turn, a Clerk round trip would be added to every load's first byte.
  const [user, templatesBody, billingBody] = await Promise.all([
    currentUser(),
    serverFetch('/api/v1/templates')
      .catch(() => null)
      .then((res) => readJson<unknown>(res)),
    serverFetch('/api/v1/billing')
      .catch(() => null)
      .then((res) => readJson<Partial<Billing>>(res)),
  ]);
  const billing = readBilling(billingBody);
  const listed = readTemplates(templatesBody);

  const templatesFailed = listed === null;
  // The list already leaves the documents out, but it also carries fields no
  // card reads (`created_at`, a `stage` of its own). Project down to what a
  // card and the banner read before they cross into the client components, so
  // nothing a later version adds rides along in the RSC payload.
  const rows = (listed ?? []).map(
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
      returned_at: template.returned_at ?? null,
    }),
  );
  const recent = rows.slice(0, RECENT_COUNT);
  // Picked from every template, not the few a card shows: one waiting for
  // sign-off is the thing not to miss, however long ago it was touched. A
  // failed list is not a clean account, so it says nothing either way.
  const next = templatesFailed ? null : pickNextStep(rows);

  const atLimit = billing ? isLimitReached(billing.usage.templates, billing.limits.maxTemplates) : false;
  // A read-only workspace can't make anything; the dashboard's banner says
  // why, so the page only takes away the controls.
  const readOnly = billing?.plan === 'lapsed';

  const canCreate = !(atLimit || readOnly);
  const isAdmin = orgRole === 'org:admin';

  return (
    // The heading stays "Welcome back" plus the first name rather than a
    // greeting for the time of day: it is the one h1 the sign-in specs and the
    // workspace switch wait for, and the server does not know the reader's hour.
    //
    // The sections are spaced by a top padding each, the banner's inside the
    // part of it that closes, rather than a gap between siblings: a gap would
    // stay behind when the banner has nothing to say, and open with it.
    <div className="fade-in-mount motion-reduce:transition-none">
      <PageHeader
        title={`Welcome back${user?.firstName ? `, ${user.firstName}` : ''}`}
        description="Your emails, your team, and a clear next step."
        actions={<NewTemplateButton disabled={!canCreate} />}
      />

      <NextStepBanner template={next} isAdmin={isAdmin} />

      <div className="space-y-9 pt-9">
        <StarterChips disabled={!canCreate} />
        <RecentTemplates templates={recent} failed={templatesFailed} canCreate={canCreate} />
        <UsageSection billing={billing} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
