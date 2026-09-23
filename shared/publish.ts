/**
 * The one rule both sides use to tell a draft from what is live. Publishing
 * writes a single stamp to updated_at and published_at; every draft write
 * bumps only updated_at. So "unpublished changes" is a string inequality —
 * no parsing of SQLite's `datetime('now')` against JS ISO strings, which do
 * not sort together.
 */
export function hasUnpublishedChanges(row: {
  updated_at: string | null;
  published_at: string | null;
}): boolean {
  return row.published_at !== null && row.updated_at !== row.published_at;
}
