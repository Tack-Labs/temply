import type { Mail } from '@temply/shared/schema';
import { templateStage, type TemplateStage } from '@temply/shared/stage';
import type { TemplateListItem } from './template-search';

export type WorkflowTemplate = Mail & { live_version?: number | null };
export type TemplateCopy = 'draft' | 'staged' | 'live';

export const STAGE_LABEL: Record<TemplateStage, string> = {
  draft: 'Draft', staging: 'Staging', waiting: 'Sign-off', live: 'Live',
};
export const STAGE_TONE = {
  draft: 'neutral', staging: 'accent', waiting: 'warn', live: 'success',
} as const;

export function stageOf(row: TemplateListItem): TemplateStage {
  return templateStage({ ...row, staged_at: row.staged_at ?? null, review_requested_at: row.review_requested_at ?? null });
}

const priority: Record<TemplateStage, number> = { waiting: 0, staging: 1, draft: 2, live: 3 };

/** Stable within each stage: the API already orders by recency. */
export function sortByStage(rows: TemplateListItem[]): TemplateListItem[] {
  return [...rows].sort((a, b) => priority[stageOf(a)] - priority[stageOf(b)]);
}

export function nextStep(stage: TemplateStage, isAdmin: boolean) {
  switch (stage) {
    case 'draft': return { label: 'Move to staging', action: 'stage' as const };
    case 'staging': return { label: 'Ask for sign-off', action: 'request-signoff' as const };
    case 'waiting': return { label: isAdmin ? 'Review' : 'View sign-off', action: 'review' as const };
    case 'live': return { label: 'Edit draft', action: 'edit' as const };
  }
}

export function copyOf(row: WorkflowTemplate, copy: TemplateCopy) {
  if (copy === 'draft') return { content: row.content, theme: row.theme, preview_text: row.preview_text, stamp: row.updated_at };
  if (copy === 'staged') return row.staged_at && row.staged_content !== null
    ? { content: row.staged_content, theme: row.staged_theme, preview_text: row.staged_preview_text, stamp: row.staged_at } : null;
  return row.published_at && row.published_content !== null
    ? { content: row.published_content, theme: row.published_theme, preview_text: row.published_preview_text, stamp: row.published_at } : null;
}
