import { auth, currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileTextIcon } from 'lucide-react';
import { NewTemplateButton } from '~/components/dashboard/new-template-button';
import { Button } from '~/components/ui/button';
import { List, Row } from '~/components/ui/item';
import { Badge, EmptyState, ErrorState, PageHeader, StatTile } from '~/components/ui/surfaces';
import { serverFetch } from '~/lib/server-fetch';
import type { TemplateListItem } from '~/lib/template-search';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) redirect('/login');

  const user = await currentUser();

  const [templatesRes, billingRes] = await Promise.all([
    serverFetch('/api/v1/templates'),
    serverFetch('/api/v1/billing').catch(() => null),
  ]);

  // Track the failure rather than folding it into an empty result: "we could
  // not reach the server" and "you have nothing yet" are different messages.
  const templatesFailed = !templatesRes.ok;
  const { templates = [] }: { templates: TemplateListItem[] } = templatesFailed
    ? { templates: [] }
    : await templatesRes.json();
  const billing = billingRes?.ok ? await billingRes.json() : null;

  const recentTemplates = templates.slice(0, 5);

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Welcome back${user?.firstName ? `, ${user.firstName}` : ''}`}
        description="Where your templates and usage stand today."
      />

      {/* The tiles are the navigation: each one opens the page it summarises. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/dashboard/templates">
          <StatTile
            label="Templates"
            value={templatesFailed ? '—' : templates.length}
            interactive
          />
        </Link>
        <Link href="/dashboard/settings/api-keys">
          <StatTile
            label="API keys"
            value={billing?.usage?.apiKeys ?? '—'}
            interactive
          />
        </Link>
        <Link href="/dashboard/settings/plan">
          <StatTile
            label="Plan"
            value={<span className="capitalize">{billing?.plan ?? '—'}</span>}
            hint={billing ? undefined : 'Usage could not be loaded'}
            className="h-full"
            interactive
          />
        </Link>
      </div>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-ink">Recent templates</h2>
          {!templatesFailed && templates.length > 0 ? (
            <Button variant="link" size="sm" asChild className="px-0">
              <Link href="/dashboard/templates">View all</Link>
            </Button>
          ) : null}
        </div>

        {templatesFailed ? (
          <ErrorState description="We could not reach the server, so your templates are not shown. This is not a sign that they are gone." />
        ) : recentTemplates.length === 0 ? (
          <EmptyState
            icon={FileTextIcon}
            title="No templates yet"
            description="Start one and it will appear here, ready to edit or send."
            action={<NewTemplateButton />}
          />
        ) : (
          <List>
            {recentTemplates.map((template) => (
              <Row
                key={template.id}
                href={`/templates/${template.id}`}
                title={template.title}
                subtitle={template.preview_text || 'No preview text'}
                meta={
                  template.has_unpublished_changes ? (
                    <Badge tone="warn">Draft</Badge>
                  ) : template.published_at ? (
                    <span className="hidden shrink-0 text-xs text-muted tabular-nums sm:block">
                      {new Date(template.published_at).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  ) : null
                }
              />
            ))}
          </List>
        )}
      </section>
    </div>
  );
}
