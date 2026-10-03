'use client';

import { useEffect, useRef, useState } from 'react';
import { FileTextIcon, ListFilterIcon, SearchIcon, XIcon } from 'lucide-react';
import { editedOn } from '~/components/dashboard/locale-date';
import { type DeleteState, TemplateActions } from '~/components/dashboard/template-actions';
import { TemplateRowThumbnail } from '~/components/dashboard/template-row-thumbnail';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { List, Row } from '~/components/ui/item';
import { SegmentedControl } from '~/components/ui/segmented-control';
import { Badge, EmptyState } from '~/components/ui/surfaces';
import { useHydrated } from '~/hooks/use-hydrated';
import { cn } from '~/lib/classname';
import {
  browseTemplates,
  TEMPLATE_STATUS_BADGE,
  templateCountLabel,
  templateStatus,
  type TemplateFilter,
  type TemplateListItem,
} from '~/lib/template-search';

type TemplateListProps = {
  /** Already ordered by the API (most recently updated first) — never re-sort. */
  templates: TemplateListItem[];
  canDuplicate: boolean;
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
  hydrated,
  onDeleted,
}: {
  template: TemplateListItem;
  canDuplicate: boolean;
  hydrated: boolean;
  /** The server has removed this template; the row is about to close. */
  onDeleted: (templateId: string) => void;
}) {
  const [phase, setPhase] = useState<DeleteState>('idle');
  const badge = TEMPLATE_STATUS_BADGE[templateStatus(template)];
  const edited = hydrated ? editedOn(template.updated_at) : null;

  return (
    <Row
      href={`/templates/${template.id}`}
      // Dimmed and unclickable while the delete runs, by class rather than
      // `busy`: busy swaps the link for a div, which would remount the
      // thumbnail and reload its preview in the middle of the row's exit.
      className={phase === 'deleting' ? 'pointer-events-none opacity-60' : undefined}
      leaving={phase === 'deleted'}
      // The badge and the date sit under the name on a narrow list and
      // trail it on a wide one. It is the list's own width that decides, not
      // the window's: beside the sidebar the same window has less room.
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
              empty until hydration because the date is the reader's locale. */}
          <p className="min-w-0 text-xs text-muted tabular-nums @2xl:w-32 @2xl:shrink-0 @2xl:text-right">
            {edited && template.updated_at ? (
              <>
                Edited <time dateTime={template.updated_at}>{edited}</time>
              </>
            ) : null}
          </p>
        </div>
      }
      actions={
        <TemplateActions
          templateId={template.id}
          templateTitle={template.title}
          canDuplicate={canDuplicate}
          onDeleteStateChange={(state) => {
            setPhase(state);
            if (state === 'deleted') onDeleted(template.id);
          }}
        />
      }
    />
  );
}

export function TemplateList({ templates, canDuplicate, emptyAction }: TemplateListProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TemplateFilter>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const emptyRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  const view = browseTemplates(templates, { query, filter });
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
          <div className="flex flex-col gap-3 pb-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 sm:w-72">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <Input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search templates…"
                aria-label="Search templates"
                // WebKit draws its own × on search inputs; suppress it so ours is
                // the only clear control.
                className="pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none"
              />
              {query ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Clear search"
                  onClick={clearSearch}
                  className="absolute top-1/2 right-1 -translate-y-1/2"
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
              className="max-sm:self-start"
            />

            {/* Mounted for the life of the list: a live region announces a change
                to its text, not text it was mounted with. */}
            <p role="status" className="text-xs text-muted tabular-nums sm:ml-auto">
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
          className="fade-in-mount rounded-xl motion-reduce:transition-none"
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
        <List className="@container rounded-xl">
          {view.rows.map((template) => (
            <TemplateRow
              key={template.id}
              template={template}
              canDuplicate={canDuplicate}
              hydrated={hydrated}
              onDeleted={moveFocusFromDeleted}
            />
          ))}
        </List>
      )}
    </div>
  );
}
