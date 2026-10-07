import type { Mail } from '@temply/shared/schema';
import { templateStage, type TemplateStage } from '@temply/shared/stage';
import { TEMPLATE_STATUS_BADGE, templateStatus, type TemplateListItem, type TemplateStatus } from './template-search';

export type WorkflowTemplate = Mail & { live_version?: number | null };
export type TemplateCopy = 'draft' | 'staged' | 'live';

export const STAGE_LABEL: Record<TemplateStage, string> = {
  draft: 'Draft', staging: 'Staging', waiting: 'Sign-off', live: 'Live',
};
export const STAGE_TONE = {
  draft: 'neutral', staging: 'accent', waiting: 'warn', live: 'success',
} as const;

export type TemplatePillTone = 'neutral' | 'lavender' | 'mint' | 'butter' | 'rose' | 'sky';
export type TemplatePill = { label: string; tone: TemplatePillTone };

/**
 * The words a list row uses for a template that is in the release flow. They
 * are not STAGE_LABEL: the track and the workflow panel name the steps
 * ("Staging", "Sign-off") and a pill names where the template is now, so it
 * reads as a state ("In staging") beside Published and Draft.
 */
export const STAGE_PILL: Record<'staging' | 'waiting', TemplatePill> = {
  staging: { label: 'In staging', tone: 'sky' },
  waiting: { label: 'In sign-off', tone: 'butter' },
};

/** The server keeps a sent-back copy in staging and stamps the return, so this is a state of staging, not a stage of its own. */
const RETURNED_PILL: TemplatePill = { label: 'Sent back', tone: 'rose' };

// Words come from the status vocabulary the editor header shares, so a row
// and the editor it opens never name one state two ways. The tones are the
// list's own: the washes name a place, where the editor's severity tones say
// how things are going.
const STATUS_PILL: Record<TemplateStatus, TemplatePill> = {
  published: { label: TEMPLATE_STATUS_BADGE.published.label, tone: 'mint' },
  'unpublished-changes': { label: TEMPLATE_STATUS_BADGE['unpublished-changes'].label, tone: 'lavender' },
  draft: { label: TEMPLATE_STATUS_BADGE.draft.label, tone: 'neutral' },
};

export function stageOf(row: TemplateListItem): TemplateStage {
  return templateStage({ ...row, staged_at: row.staged_at ?? null, review_requested_at: row.review_requested_at ?? null });
}

/**
 * The one pill a row shows. A template in the release flow is named for its
 * place in it; every other is named for how it stands against what is live,
 * so a row never carries a stage and a status that disagree. The stage wins
 * for the same reason `templateStage` lets a candidate outrank the draft/live
 * comparison.
 */
export function templatePill(row: TemplateListItem): TemplatePill {
  const stage = stageOf(row);
  if (stage === 'waiting') return STAGE_PILL.waiting;
  if (stage === 'staging') return row.returned_at ? RETURNED_PILL : STAGE_PILL.staging;
  return STATUS_PILL[templateStatus(row)];
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
