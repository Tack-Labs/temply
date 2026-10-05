import { auth, currentUser } from '@clerk/nextjs/server';
import { isLimitReached } from '@temply/shared/plans';
import { redirect } from 'next/navigation';
import { NewTemplateButton } from '~/components/dashboard/new-template-button';
import { RecentTemplates } from '~/components/dashboard/recent-templates';
import { GetStarted } from '~/components/dashboard/get-started';
import { UsageSection } from '~/components/dashboard/usage-section';
import { PageHeader } from '~/components/ui/surfaces';
import type { Billing } from '~/lib/billing';
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
      .then((res) => readJson<{ templates?: TemplateListItem[] }>(res)),
    serverFetch('/api/v1/billing')
      .catch(() => null)
      .then((res) => readJson<Partial<Billing>>(res)),
  ]);
  const billing = readBilling(billingBody);

  const templatesFailed = templatesBody === null;
  // The API returns full rows, content and theme included. Project down to
  // what a row renders before they cross into the client component, so
  // nothing else rides along in the RSC payload.
  const recent = (templatesBody?.templates ?? []).slice(0, RECENT_COUNT).map(
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

  const atLimit = billing ? isLimitReached(billing.usage.templates, billing.limits.maxTemplates) : false;
  // A read-only workspace can't make anything; the dashboard's banner says
  // why, so the page only takes away the controls.
  const readOnly = billing?.plan === 'lapsed';

  return (
    // The heading stays "Welcome back" plus the first name rather than a
    // greeting for the time of day: it is the one h1 the sign-in specs and the
    // workspace switch wait for, and the server does not know the reader's hour.
    <div className="fade-in-mount space-y-6 motion-reduce:transition-none">
      <PageHeader
        title={`Welcome back${user?.firstName ? `, ${user.firstName}` : ''}`}
        description="Your emails, your team, and a clear next step."
        actions={<NewTemplateButton disabled={atLimit || readOnly} />}
      />

      {!templatesFailed ? <GetStarted template={templatesBody?.templates?.[0]} /> : null}

      <RecentTemplates
        templates={recent}
        failed={templatesFailed}
        emptyAction={<NewTemplateButton disabled={readOnly} />}
      />
      <UsageSection billing={billing} isAdmin={orgRole === 'org:admin'} />
    </div>
  );
}
