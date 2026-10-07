'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { TemplateWorkflowAction } from '~/components/template-workflow-action';
import { sortByStage, stageOf, templatePill } from '~/lib/template-stage';
import { FileTextIcon, ListFilterIcon, SearchIcon, XIcon } from 'lucide-react';
import { type DeleteState, TemplateActions } from '~/components/dashboard/template-actions';
import { TemplateRowThumbnail } from '~/components/dashboard/template-row-thumbnail';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { List, Row } from '~/components/ui/item';
import { SegmentedControl } from '~/components/ui/segmented-control';
import { Badge, EmptyState, Reveal } from '~/components/ui/surfaces';
import { useHydrated } from '~/hooks/use-hydrated';
import { cn } from '~/lib/classname';
import { browseTemplates, templateCountLabel, type TemplateFilter, type TemplateListItem } from '~/lib/template-search';
import { exactTime, relativeTime } from '~/lib/relative-time';

type TemplateListProps = {
  /** Ordered by recency within each stage. */
  templates: TemplateListItem[];
  canDuplicate: boolean;
  isAdmin?: boolean;
  readOnly?: boolean;
  /** The empty state's way forward. A slot because the button needs Clerk and the query client, which a test does not have. */
  emptyAction: React.ReactNode;
};

/** A long query is cut so it cannot push the empty state's one sentence off the screen. */
function quoted(query: string): string {
  return `“${query.length > 40 ? `${query.slice(0, 40).trimEnd()}…` : query}”`;
}

const FIRST_TEMPLATE = {
  title: 'No templates yet',
  description: 'Start one and it will appear here, ready to edit or send.',
};

const FILTER_LABEL: Record<Exclude<TemplateFilter, 'all'>, string> = {
  published: 'Published',
  drafts: 'Drafts',
};

/**
 * What the list says when nothing is left to show. A search that finds nothing
 * and a filter that holds nothing are different news, so they read
 * differently; `key` changes only when the news does, so the state fades in
 * once rather than on every keystroke.
 */
function noMatchCopy(query: string, filter: TemplateFilter) {
  const trimmed = query.trim();
  if (trimmed) {
    return {
      key: 'search',
      icon: SearchIcon,
      title: 'No templates match',
      description:
        filter === 'all'
          ? `Nothing matches ${quoted(trimmed)}. Try a different title, preview text, or short code.`
          : `Nothing under ${FILTER_LABEL[filter]} matches ${quoted(trimmed)}. Try a different search, or look under All.`,
    };
  }
  if (filter === 'published') {
    return {
      key: 'published',
      icon: ListFilterIcon,
      title: 'No published templates',
      description: 'None of your templates is live yet. Publish one from the editor and it will appear here.',
    };
  }
  return {
    key: 'drafts',
    icon: ListFilterIcon,
    title: 'No drafts',
    description: 'Every template is published, with no changes waiting.',
  };
}

function TemplateRow({
  template,
  canDuplicate,
  isAdmin,
  readOnly,
  hydrated,
  onDeleted,
}: {
  template: TemplateListItem;
  canDuplicate: boolean;
  isAdmin: boolean;
  readOnly: boolean;
  hydrated: boolean;
  /** The server has removed this template; the row is about to close. */
  onDeleted: (templateId: string) => void;
}) {
  const [phase, setPhase] = useState<DeleteState>('idle');
  const pill = templatePill(template);
  const stage = stageOf(template);
  // Both read the reader's clock and locale, so neither exists until the page
  // has hydrated: the server's "2 hours ago" is the server's, not theirs.
  const edited = hydrated ? relativeTime(template.updated_at, new Date()) : null;

  return (
    <Row
      href={`/templates/${template.id}`}
      // Dimmed and unclickable while the delete runs, by class rather than
      // `busy`: busy swaps the link for a div, which would remount the
      // thumbnail and reload its preview in the middle of the row's exit.
      className={cn(phase === 'deleting' && 'pointer-events-none opacity-60')}
      leaving={phase === 'deleted'}
      // Two lines of the row on a narrow list, one on a wide one. It is the
      // list's own width that decides, not the window's: beside the sidebar
      // the same window has less room. Narrow, the link (thumbnail and text)
      // is the first line and the status and actions the second; from @4xl
      // they are one line of fixed cells, 190px for the status and 168px for
      // the action, so the columns run straight down the rows.
      bodyClassName="gap-5 pt-4 pb-2 @4xl:py-4 @4xl:pr-5 @4xl:pl-6"
      contentClassName="grid grid-cols-1 @4xl:grid-cols-[minmax(0,1fr)_auto]"
      leading={<TemplateRowThumbnail templateId={template.id} updatedAt={template.updated_at} tone={pill.tone} />}
      title={template.title}
      subtitle={
        <>
          {template.preview_text || 'No preview text'}
          {edited && template.updated_at ? (
            <>
              {' · edited '}
              <time dateTime={template.updated_at} title={exactTime(template.updated_at) ?? undefined}>
                {edited}
              </time>
            </>
          ) : null}
        </>
      }
      actions={
        // flex-1 so the wrapper's full-width track on a narrow row is the
        // cluster's to fill, and ml-auto can push the actions to the right edge
        // whether they share a line with the status or wrapped under it. The
        // padding indents the cluster under the title: the row's 16px, the
        // thumbnail's 56px and the 20px gap, once the row is wide enough that
        // the title is not itself pressed against the thumbnail.
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 pr-1 pb-4 pl-4 @lg:pl-23 @4xl:flex-nowrap @4xl:gap-5 @4xl:pr-3 @4xl:pb-0 @4xl:pl-0">
          <div className="@4xl:w-47.5">
            <Badge dot tone={pill.tone}>
              {pill.label}
            </Badge>
          </div>
          {/* `contents` on a wide row hands the action and the menu to the
              cluster's own columns. */}
          <div className="ml-auto flex items-center gap-1 @4xl:contents">
            {/* The workflow button sizes itself for a toolbar (28px, 12px
                text); here it is the row's one call to action, so it takes the
                row's 44px and 15px text, and fills its column on a wide row.
                Styled from outside because the button is shared with the
                editor, where its size is right. */}
            <div className="@4xl:w-42 [&>:is(a,button)]:h-11 [&>:is(a,button)]:px-4 [&>:is(a,button)]:text-ui [&>:is(a,button)]:font-semibold @4xl:[&>:is(a,button)]:w-full">
              <TemplateWorkflowAction
                id={template.id}
                stage={stage}
                isAdmin={isAdmin}
                disabled={readOnly || phase !== 'idle'}
                title={template.title}
              />
            </div>
            <TemplateActions
              templateId={template.id}
              templateTitle={template.title}
              canDuplicate={canDuplicate}
              onDeleteStateChange={(state) => {
                setPhase(state);
                if (state === 'deleted') onDeleted(template.id);
              }}
            />
          </div>
        </div>
      }
    />
  );
}

export function TemplateList({ templates, canDuplicate, emptyAction, isAdmin = false, readOnly = false }: TemplateListProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TemplateFilter>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const emptyRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  const view = browseTemplates(templates, { query, filter });
  const ordered = sortByStage(view.rows);
  const waiting = templates.filter((row) => stageOf(row) === 'waiting');
  // The notice closes over its own duration, and a reader who has just sent
  // the last one back should not watch it count "0 templates" on the way
  // out. It keeps the last count and review target it showed until it opens
  // again. Adjusted during render, not in an effect, so a notice opening on
  // a new count never paints the old one first.
  const notice = { count: waiting.length, reviewId: waiting[0]?.id };
  const [held, setHeld] = useState(notice);
  if (notice.count > 0 && (notice.count !== held.count || notice.reviewId !== held.reviewId)) setHeld(notice);
  const shown = notice.count > 0 ? notice : held;
  // An account with no templates at all, which has nothing to search or
  // filter, apart from a search or a filter that matched none of them.
  const nothingYet = templates.length === 0;
  const noMatch = !nothingYet && view.rows.length === 0 ? noMatchCopy(query, filter) : null;

  // Deleting the last template refreshes the page to an empty list, and the
  // toolbar the reader's focus was on goes inert with it, which drops focus to
  // <body>. The empty state is drawn here, in the same render that empties the
  // list, so it is there to take it; it names what happened where a button
  // would only say what to do next. A first visit to an empty account arrives
  // already empty and takes nothing, and a reader who has moved on elsewhere
  // keeps wherever they went.
  const wasEmpty = useRef(nothingYet);
  useEffect(() => {
    if (nothingYet && !wasEmpty.current) {
      const active = document.activeElement;
      if (!active || active === document.body || rootRef.current?.contains(active)) emptyRef.current?.focus();
    }
    wasEmpty.current = nothingYet;
  }, [nothingYet]);

  // A deleted row takes keyboard focus with it: the row goes inert as it
  // closes, and focus falls back to <body>. Hand it to the row that slides
  // into the gap, else the one above, else the search field. Done when the
  // server confirms rather than when the request leaves, so a delete that
  // fails leaves focus where the reader had it. A reader who has moved on
  // while the request ran keeps wherever they went. Read from the DOM, not
  // from `view`, because what counts is the rows still open on screen: a
  // neighbour mid-delete is inert and cannot take focus.
  const moveFocusFromDeleted = (templateId: string) => {
    const items = Array.from(rootRef.current?.querySelectorAll('li') ?? []);
    const at = items.findIndex((item) => item.querySelector('a')?.getAttribute('href') === `/templates/${templateId}`);
    if (at < 0) return;
    const active = document.activeElement;
    if (active && active !== document.body && !items[at]!.contains(active)) return;
    const target = [...items.slice(at + 1), ...items.slice(0, at).reverse()]
      .map((item) => item.querySelector('a'))
      .find((link) => link && !link.closest('[inert]'));
    (target ?? inputRef.current)?.focus();
  };

  // The controls that clear things unmount themselves on click; without this,
  // keyboard focus falls back to <body> and a keyboard user re-tabs from the
  // top.
  const clearSearch = () => {
    setQuery('');
    inputRef.current?.focus();
  };
  const showAll = () => {
    setQuery('');
    setFilter('all');
    inputRef.current?.focus();
  };

  return (
    <div ref={rootRef}>
      <Reveal open={waiting.length > 0}>
        {/* Spacing inside the child, not on the Reveal, so it closes with it. */}
        {shown.count > 0 ? (
          <div className="pb-5">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-card bg-warn-wash px-6 py-4">
              <div className="min-w-0">
                <p className="text-18 font-bold text-warn-ink">
                  {shown.count} {shown.count === 1 ? 'template is' : 'templates are'} waiting for {isAdmin ? 'your sign-off' : 'an admin'}
                </p>
                <p className="mt-0.5 text-ui text-muted">
                  Customers keep the live version until {isAdmin ? 'you approve' : 'an admin approves'} the new one.
                </p>
              </div>
              {isAdmin && shown.reviewId ? (
                <Button asChild size="compact">
                  {/* The link opens one template's sign-off, so at two or more
                      it must not read as reviewing all of them. */}
                  <Link href={`/templates/${shown.reviewId}/review`}>{shown.count === 1 ? 'Review template' : 'Review next'}</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Reveal>
      {/* With no templates there is nothing to search or filter, so the toolbar
          closes up through its grid track rather than vanishing. `inert` takes
          it out of the tab order and the accessibility tree; `aria-hidden`
          is left off because focus can still be inside it as it closes, and a
          hidden element holding focus is worse than an inert one. The clip
          applies only once it is closing, so an open toolbar's focus outlines
          are not cut off. */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-base ease-out motion-reduce:transition-none',
          nothingYet ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
        )}
      >
        <div className={cn('min-h-0', nothingYet && 'overflow-hidden')} inert={nothingYet}>
          <div className="flex flex-col gap-4 pb-5 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 sm:max-w-105 sm:flex-1 sm:basis-70">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
              <Input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or subject"
                aria-label="Search templates"
                // WebKit draws its own × on search inputs; suppress it so ours is
                // the only clear control. The right padding clears that ×, which
                // is 44px on a coarse pointer.
                className="rounded-full pr-12 pl-11 [&::-webkit-search-cancel-button]:appearance-none"
              />
              {query ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Clear search"
                  onClick={clearSearch}
                  className="absolute top-1/2 right-2 -translate-y-1/2 pointer-coarse:right-0.5"
                >
                  <XIcon />
                </Button>
              ) : null}
            </div>

            {/* The counts follow the search, so an option never promises rows
                the search has already taken away. */}
            <SegmentedControl
              label="Filter templates"
              value={filter}
              onValueChange={setFilter}
              options={[
                { value: 'all', label: 'All', count: view.counts.all },
                { value: 'published', label: 'Published', count: view.counts.published },
                { value: 'drafts', label: 'Drafts', count: view.counts.drafts },
              ]}
              className="max-sm:self-start sm:ml-auto"
            />

            {/* Mounted for the life of the list: a live region announces a change
                to its text, not text it was mounted with. */}
            <p role="status" className="text-ui text-muted tabular-nums">
              {templateCountLabel(view.rows.length, view.total)}
            </p>
          </div>
        </div>
      </div>

      {nothingYet ? (
        <div
          ref={emptyRef}
          role="group"
          // Named for the area, not for what it says: the title inside is the
          // same words, and a reader landing here after the last delete would
          // hear the name and then the heading repeating it. EmptyState gives
          // its title no id to label this by.
          aria-label="Templates"
          tabIndex={-1}
          className="fade-in-mount rounded-card motion-reduce:transition-none"
        >
          <EmptyState
            icon={FileTextIcon}
            title={FIRST_TEMPLATE.title}
            description={FIRST_TEMPLATE.description}
            action={emptyAction}
          />
        </div>
      ) : noMatch ? (
        <div key={noMatch.key} className="fade-in-mount motion-reduce:transition-none">
          <EmptyState
            icon={noMatch.icon}
            title={noMatch.title}
            description={noMatch.description}
            // Not a second "Clear search": the × in the field already answers
            // to that name, and two buttons with one name is a list a reader
            // cannot choose from. This one is named for what they are after,
            // and it undoes the filter as well as the search.
            action={
              <Button variant="secondary" onClick={showAll}>
                Show all templates
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <List className="@container">
            {ordered.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                canDuplicate={canDuplicate}
                isAdmin={isAdmin}
                readOnly={readOnly}
                hydrated={hydrated}
                onDeleted={moveFocusFromDeleted}
              />
            ))}
          </List>
          <p className="mt-5 text-ui text-muted">Each template shows one status. Deleting always asks first.</p>
        </>
      )}
    </div>
  );
}
