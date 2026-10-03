'use client';

import { FileTextIcon } from 'lucide-react';
import Link from 'next/link';
import { editedOn } from '~/components/dashboard/locale-date';
import { RefreshErrorState } from '~/components/dashboard/refresh-error-state';
import { TemplateRowThumbnail } from '~/components/dashboard/template-row-thumbnail';
import { Button } from '~/components/ui/button';
import { List, Row } from '~/components/ui/item';
import { Badge, EmptyState } from '~/components/ui/surfaces';
import { useHydrated } from '~/hooks/use-hydrated';
import { TEMPLATE_STATUS_BADGE, templateStatus, type TemplateListItem } from '~/lib/template-search';

/**
 * A row of the templates list without its actions: the whole row opens the
 * editor, and anything that changes a template is a visit to the list away.
 * The layout is TemplateRow's in template-list.tsx — the thumbnail at 64px
 * and 80px, the badge and the date under the name on a narrow list and
 * trailing it on a wide one, the list's own width deciding rather than the
 * window's — and the two change together.
 */
function RecentRow({ template, hydrated }: { template: TemplateListItem; hydrated: boolean }) {
  const badge = TEMPLATE_STATUS_BADGE[templateStatus(template)];
  const edited = hydrated ? editedOn(template.updated_at) : null;

  return (
    <Row
      href={`/templates/${template.id}`}
      bodyClassName="flex-wrap gap-y-1 @2xl:flex-nowrap"
      leading={<TemplateRowThumbnail templateId={template.id} updatedAt={template.updated_at} />}
      title={template.title}
      subtitle={template.preview_text || 'No preview text'}
      meta={
        // pl-19 lines the meta up with the title: the thumbnail's 64px plus the row's gap.
        <div className="flex w-full items-center gap-2 pl-19 @2xl:w-auto @2xl:gap-3 @2xl:pl-0">
          <div className="flex shrink-0 @2xl:w-36">
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </div>
          {/* A fixed cell on a wide list so the dates line up down the rows;
              empty until hydration because the date is the reader's locale.
              "Edited", not "Published": a draft has an edit date and no
              publish one, and the badge already says which it is. */}
          <p className="min-w-0 text-xs text-muted tabular-nums @2xl:w-32 @2xl:shrink-0 @2xl:text-right">
            {edited && template.updated_at ? (
              <>
                Edited <time dateTime={template.updated_at}>{edited}</time>
              </>
            ) : null}
          </p>
        </div>
      }
    />
  );
}

/**
 * The templates most recently touched, with the three ways that can come out
 * kept apart: a list, an account with nothing yet, and a fetch that failed.
 * The last must never draw as the second — "your templates are gone" is a
 * different thing to be told than "we could not reach the server".
 */
export function RecentTemplates({
  templates,
  failed,
  emptyAction,
}: {
  /** Already ordered by the API (most recently updated first) and cut to the few the page shows — never re-sort. */
  templates: TemplateListItem[];
  failed: boolean;
  /** The empty state's way forward. A slot because the button needs Clerk and the query client, which a test does not have. */
  emptyAction: React.ReactNode;
}) {
  const hydrated = useHydrated();

  return (
    <section aria-labelledby="recent-heading" className="space-y-2.5">
      {/* Held at the height "View all" makes the row (28px, 44px on a coarse
          pointer) for the empty and failed states too, which draw no link, so
          the loading skeleton's row is the one that arrives. */}
      <div className="flex min-h-7 items-center justify-between gap-3 pointer-coarse:min-h-11">
        <h2 id="recent-heading" className="font-display text-sm font-semibold tracking-display text-ink">
          Recent templates
        </h2>
        {!failed && templates.length > 0 ? (
          <Button variant="link" size="sm" touch asChild className="px-0">
            <Link href="/dashboard/templates">View all</Link>
          </Button>
        ) : null}
      </div>

      {failed ? (
        <RefreshErrorState description="We could not reach the server, so your templates are not shown. This is not a sign that they are gone." />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title="No templates yet"
          description="Start one and it will appear here, ready to edit or send."
          action={emptyAction}
        />
      ) : (
        <List className="@container rounded-xl">
          {templates.map((template) => (
            <RecentRow key={template.id} template={template} hydrated={hydrated} />
          ))}
        </List>
      )}
    </section>
  );
}
