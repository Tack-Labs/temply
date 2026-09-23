/**
 * The shape the templates list actually renders. The API sends more fields;
 * typing only what the list uses keeps the search logic honest about which
 * columns a query can match.
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
