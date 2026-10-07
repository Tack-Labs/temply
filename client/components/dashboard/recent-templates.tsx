'use client';

import { ArrowRightIcon, FileTextIcon } from 'lucide-react';
import Link from 'next/link';
import { RefreshErrorState } from '~/components/dashboard/refresh-error-state';
import { SectionHeading } from '~/components/dashboard/section-heading';
import { TemplateCardThumbnail } from '~/components/dashboard/template-card-thumbnail';
import { Button } from '~/components/ui/button';
import { Badge, Card, EmptyState } from '~/components/ui/surfaces';
import { useHydrated } from '~/hooks/use-hydrated';
import { exactTime, relativeTime } from '~/lib/relative-time';
import type { TemplateListItem } from '~/lib/template-search';
import { templatePill } from '~/lib/template-stage';

/**
 * A template as a card: its preview, its name, where it stands and when it
 * was last edited. The whole card opens the editor, and anything that changes
 * a template is a visit to the list away. The pill is the list's own
 * (`templatePill`), so a template in sign-off reads "In sign-off" on both.
 */
function RecentCard({ template, hydrated }: { template: TemplateListItem; hydrated: boolean }) {
  const pill = templatePill(template);
  // Reads the reader's clock, so it waits for hydration and fades in: the
  // server's "2 hours ago" is the server's, not theirs. "Edited", not
  // "Published": a draft has an edit date and no publish one, and the pill
  // already says which it is.
  const edited = hydrated ? relativeTime(template.updated_at, new Date()) : null;

  return (
    <li>
      <Link href={`/templates/${template.id}`} className="block h-full rounded-card">
        <Card interactive className="flex h-full flex-col gap-3.5 p-3 pb-4.5">
          <TemplateCardThumbnail templateId={template.id} updatedAt={template.updated_at} tone={pill.tone} />
          <div className="flex min-w-0 flex-1 flex-col gap-2 px-1.5">
            <div className="min-w-0">
              <p className="truncate text-18 font-bold text-ink">{template.title}</p>
              <p className="truncate text-ui text-muted">{template.preview_text || 'No preview text'}</p>
            </div>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <Badge dot tone={pill.tone}>
                {pill.label}
              </Badge>
              {edited && template.updated_at ? (
                <span className="fade-in-mount text-sm text-muted tabular-nums motion-reduce:transition-none">
                  Edited{' '}
                  <time dateTime={template.updated_at} title={exactTime(template.updated_at) ?? undefined}>
                    {edited}
                  </time>
                </span>
              ) : null}
            </div>
          </div>
        </Card>
      </Link>
    </li>
  );
}

/**
 * The templates most recently touched, with the three ways that can come out
 * kept apart: cards, an account with nothing yet, and a fetch that failed.
 * The last must never draw as the second — "your templates are gone" is a
 * different thing to be told than "we could not reach the server".
 */
export function RecentTemplates({
  templates,
  failed,
  canCreate,
}: {
  /** Already ordered by the API (most recently updated first) and cut to the few the page shows — never re-sort. */
  templates: TemplateListItem[];
  failed: boolean;
  /** The starters above are usable, so the empty state can point at them. */
  canCreate: boolean;
}) {
  const hydrated = useHydrated();

  return (
    <section aria-labelledby="recent-heading" className="space-y-3.5">
      {/* Held at the height "View all" makes the row (44px) for the empty and
          failed states too, which draw no link, so the loading skeleton's row
          is the one that arrives. */}
      <div className="flex min-h-11 items-center justify-between gap-4">
        <SectionHeading id="recent-heading">Recent templates</SectionHeading>
        {!failed && templates.length > 0 ? (
          <Button variant="link" asChild className="h-11 px-0 text-ui font-bold [&_svg]:size-4">
            <Link href="/dashboard/templates">
              View all
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </div>

      {failed ? (
        <RefreshErrorState description="We could not reach the server, so your templates are not shown. This is not a sign that they are gone." />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title="No templates yet"
          description={
            canCreate
              ? 'Pick a starter above and it will appear here, ready to edit or send.'
              : 'Templates you make will appear here, ready to edit or send.'
          }
        />
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4.5">
          {templates.map((template) => (
            <RecentCard key={template.id} template={template} hydrated={hydrated} />
          ))}
        </ul>
      )}
    </section>
  );
}
