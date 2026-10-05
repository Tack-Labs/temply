import { hasUnpublishedChanges } from './publish';

/**
 * Where a template sits on its way to the API: a draft being written, a
 * candidate staged for a look, a candidate waiting on an admin, or what is
 * live. It sits beside the status words (Published, Unpublished changes,
 * Draft), which still answer "is the draft ahead of what is live" and are
 * not renamed by it.
 */
export type TemplateStage = 'draft' | 'staging' | 'waiting' | 'live';

/** The pipeline left to right, for a track that draws one segment per stage. */
export const STAGE_ORDER: readonly TemplateStage[] = ['draft', 'staging', 'waiting', 'live'];

/**
 * Derived from four stamps and stored nowhere, so the server and the client
 * cannot disagree about it. A candidate outranks the draft/live comparison:
 * a template with one staged is in staging even when its draft has since
 * moved, or been discarded back to what is live. Stamps are tested for
 * presence rather than for null, since a client can hold a row from before
 * these columns existed.
 */
export function templateStage(row: {
  updated_at: string | null;
  published_at: string | null;
  staged_at: string | null;
  review_requested_at: string | null;
}): TemplateStage {
  if (row.review_requested_at) return 'waiting';
  if (row.staged_at) return 'staging';
  if (row.published_at !== null && !hasUnpublishedChanges(row)) return 'live';
  return 'draft';
}
