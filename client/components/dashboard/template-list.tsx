'use client';

import { useRef, useState } from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import { TemplateActions } from '~/components/dashboard/template-actions';
import { TemplateThumbnail } from '~/components/dashboard/template-thumbnail';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Tile } from '~/components/ui/item';
import { Badge, EmptyState } from '~/components/ui/surfaces';
import { filterTemplates, type TemplateListItem } from '~/lib/template-search';

type TemplateListProps = {
  /** Already ordered by the API (most recently updated first) — never re-sort. */
  templates: TemplateListItem[];
  canDuplicate: boolean;
};

export function TemplateList({ templates, canDuplicate }: TemplateListProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = filterTemplates(templates, query);

  // Both clear controls unmount themselves on click; without this, keyboard
  // focus falls back to <body> and a keyboard user re-tabs from the top.
  const clearSearch = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-3">
      <div className="relative">
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

      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title="No templates match"
          description={`Nothing matches “${query.trim()}”. Try a different title, preview text, or short code.`}
          // Not a second "Clear search": the × in the field already answers
          // to that name, and two buttons with one name is a list a reader
          // cannot choose from. This one is named for what they are after.
          action={
            <Button variant="secondary" onClick={clearSearch}>
              Show all templates
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((template) => (
            <Tile
              key={template.id}
              href={`/templates/${template.id}`}
              media={<TemplateThumbnail templateId={template.id} updatedAt={template.updated_at} />}
              title={template.title}
              subtitle={template.preview_text || 'No preview text'}
              meta={
                template.has_unpublished_changes ? (
                  <Badge tone="warn">Draft</Badge>
                ) : template.published_at ? (
                  `Published ${new Date(template.published_at).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}`
                ) : null
              }
              actions={<TemplateActions templateId={template.id} canDuplicate={canDuplicate} />}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
