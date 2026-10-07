/**
 * The shape the templates list and the dashboard home render. The API's row
 * carries more (`created_at`, and a `stage` of its own); typing only what
 * these screens read keeps the search logic honest about which columns a query
 * can match. The stage is derived again from the stamps (`stageOf`), by the
 * rule the server uses, rather than read from the row.
 */
export type TemplateListItem = {
  id: string;
  title: string;
  preview_text: string | null;
  short_code: string | null;
  updated_at: string | null;
  published_at: string | null;
  /** The draft differs from the published copy. */
  has_unpublished_changes: boolean;
  staged_at?: string | null;
  review_requested_at?: string | null;
  review_requested_by?: string | null;
  returned_at?: string | null;
  live_version?: number | null;
};

/**
 * Case-insensitive substring match over title, preview text, and short code.
 * The API orders templates by recency; the filter must not disturb that, so
 * it only ever removes rows.
 */
export function filterTemplates(
  templates: TemplateListItem[],
  query: string,
): TemplateListItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return templates;

  return templates.filter((template) =>
    [template.title, template.preview_text ?? '', template.short_code ?? ''].some(
      (field) => field.toLowerCase().includes(needle),
    ),
  );
}

/**
 * Where a template stands against what the public API serves. A new template
 * is born published (the create route stamps both copies), so `draft` is only
 * a row from before that: never published, answering 404 on the public API.
 * `unpublished-changes` is the common working state: live, with a newer draft
 * behind it. The Drafts filter reads this, and so does the row's pill
 * (`templatePill`) for a template outside the release flow. One in staging or
 * sign-off is named for its stage, which outranks this: its draft can have
 * been discarded back to what is live, so the pill says "In staging" while the
 * filter still counts it as published.
 */
export type TemplateStatus = 'published' | 'unpublished-changes' | 'draft';

export function templateStatus(
  template: Pick<TemplateListItem, 'published_at' | 'has_unpublished_changes'>,
): TemplateStatus {
  // Checked first: the flag is only ever set on a row that has been published,
  // but a never-published row must not read as live whatever the flag says.
  // `== null` on purpose: a row that omits the field has no publish stamp
  // either, and `undefined` must not read as live.
  if (template.published_at == null) return 'draft';
  return template.has_unpublished_changes ? 'unpublished-changes' : 'published';
}

/**
 * How each status is named and toned in the editor's publish badge. The
 * templates list and the dashboard cards take the words from here, so a row
 * and the editor it opens never name one state two ways, and tone them on
 * their own palette (`STATUS_PILL`). Three states get three looks: `warn` for
 * changes waiting (the live copy is out of date and deserves a look),
 * `success` for in sync, and the quiet `neutral` for a row that has never gone
 * live at all.
 */
export const TEMPLATE_STATUS_BADGE: Record<
  TemplateStatus,
  { label: string; tone: 'success' | 'warn' | 'neutral' }
> = {
  published: { label: 'Published', tone: 'success' },
  'unpublished-changes': { label: 'Unpublished changes', tone: 'warn' },
  draft: { label: 'Draft', tone: 'neutral' },
};

/** `drafts` is everything that is not cleanly published, so the three counts add up. */
export type TemplateFilter = 'all' | 'published' | 'drafts';

export function matchesTemplateFilter(
  template: Pick<TemplateListItem, 'published_at' | 'has_unpublished_changes'>,
  filter: TemplateFilter,
): boolean {
  if (filter === 'all') return true;
  const published = templateStatus(template) === 'published';
  return filter === 'published' ? published : !published;
}

export type TemplateView = {
  /**
   * The search, then the filter, still in the API's order. The list sorts this
   * by stage (`sortByStage`) before it draws, stably, so recency holds within
   * a stage.
   */
  rows: TemplateListItem[];
  /**
   * Taken after the search and before the filter, so each option states what
   * choosing it would show right now. A count that ignored the search would
   * promise rows the search has already removed.
   */
  counts: Record<TemplateFilter, number>;
  /** The workspace's whole list, the denominator of "3 of 12". */
  total: number;
};

export function browseTemplates(
  templates: TemplateListItem[],
  { query, filter }: { query: string; filter: TemplateFilter },
): TemplateView {
  const searched = filterTemplates(templates, query);
  const published = searched.filter((template) => matchesTemplateFilter(template, 'published')).length;
  return {
    rows: filter === 'all' ? searched : searched.filter((template) => matchesTemplateFilter(template, filter)),
    counts: { all: searched.length, published, drafts: searched.length - published },
    total: templates.length,
  };
}

/** "12 templates", or "3 of 12 templates" while a search or filter hides some. */
export function templateCountLabel(shown: number, total: number): string {
  const noun = total === 1 ? 'template' : 'templates';
  return shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`;
}
