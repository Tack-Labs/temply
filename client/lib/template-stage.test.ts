import { describe, expect, it } from 'bun:test';
import {
  copyOf, nextStep, sortByStage, stageOf, STAGE_LABEL, STAGE_PILL, templatePill, type WorkflowTemplate,
} from './template-stage';
import { TEMPLATE_STATUS_BADGE } from './template-search';
import type { TemplateListItem } from './template-search';

const row = (id: string, patch: Partial<TemplateListItem> = {}): TemplateListItem => ({
  id, title: id, short_code: null, preview_text: null, updated_at: 'later', published_at: 'earlier', has_unpublished_changes: true, ...patch,
});

describe('template workflow presentation', () => {
  it('puts waiting and staging before drafts and live, and keeps the API recency within a stage', () => {
    const list = [row('live', { updated_at: 'earlier' }), row('draft-new'), row('waiting-new', { review_requested_at: 'now' }),
      row('staged', { staged_at: 'now' }), row('waiting-old', { review_requested_at: 'now' }), row('draft-old')];
    expect(sortByStage(list).map((item) => item.id)).toEqual(['waiting-new', 'waiting-old', 'staged', 'draft-new', 'draft-old', 'live']);
    expect(list[0]?.id).toBe('live');
  });
  it('accepts a row from before staging existed', () => {
    expect(stageOf(row('older'))).toBe('draft');
  });
  it('takes both roles through staging, and sends an admin to review a waiting copy', () => {
    expect(nextStep('draft', false).action).toBe('stage');
    expect(nextStep('staging', false).action).toBe('request-signoff');
    expect(nextStep('waiting', true)).toEqual({ label: 'Review', action: 'review' });
    expect(nextStep('waiting', false)).toEqual({ label: 'View sign-off', action: 'review' });
  });
  it('keys each preview to its own copy and treats a missing candidate as absent', () => {
    const template = { content: 'draft', theme: null, preview_text: 'Draft', updated_at: 'd',
      staged_content: 'staged', staged_theme: 'brand', staged_preview_text: 'Staged', staged_at: 's',
      published_content: 'live', published_theme: null, published_preview_text: 'Live', published_at: 'l' } as WorkflowTemplate;
    expect(copyOf(template, 'draft')?.stamp).toBe('d');
    expect(copyOf(template, 'staged')).toEqual({ content: 'staged', theme: 'brand', preview_text: 'Staged', stamp: 's' });
    expect(copyOf(template, 'live')?.content).toBe('live');
    expect(copyOf({ ...template, staged_at: null }, 'staged')).toBeNull();
  });
});

// The one pill a row carries. A template in the release flow is named for its
// place in it; every other template is named for how it stands against what
// is live. Six states, never two at once.
describe('templatePill', () => {
  const live = { published_at: 'earlier', has_unpublished_changes: false };

  it('names a template that is not in the flow by how it stands against what is live', () => {
    expect(templatePill(row('a', { ...live }))).toEqual({ label: 'Published', tone: 'mint' });
    expect(templatePill(row('b', { has_unpublished_changes: true }))).toEqual({ label: 'Unpublished changes', tone: 'lavender' });
    expect(templatePill(row('c', { published_at: null, has_unpublished_changes: false }))).toEqual({ label: 'Draft', tone: 'neutral' });
  });

  it('names a candidate in staging, and a copy waiting on an admin', () => {
    expect(templatePill(row('a', { staged_at: 'now' }))).toEqual({ label: 'In staging', tone: 'sky' });
    expect(templatePill(row('b', { staged_at: 'now', review_requested_at: 'now' }))).toEqual({ label: 'In sign-off', tone: 'butter' });
  });

  it('says a candidate was sent back, which the server records as staging with a return stamp', () => {
    expect(templatePill(row('a', { staged_at: 'now', returned_at: 'later' }))).toEqual({ label: 'Sent back', tone: 'rose' });
  });

  it('lets the flow outrank the draft and live words, as the stage does', () => {
    // Staged from a published template whose draft has since been discarded
    // back to what is live: the status alone would say Published.
    expect(templatePill(row('a', { ...live, staged_at: 'now' })).label).toBe('In staging');
    expect(templatePill(row('b', { published_at: null, staged_at: 'now', review_requested_at: 'now' })).label).toBe('In sign-off');
  });

  it('prefers the open request over an older return stamp', () => {
    expect(templatePill(row('a', { staged_at: 'now', review_requested_at: 'now', returned_at: 'earlier' })).label).toBe('In sign-off');
  });

  it('accepts a row from before staging existed', () => {
    expect(templatePill(row('older')).label).toBe('Unpublished changes');
  });

  it('takes its words for the three statuses from the status vocabulary, so the two cannot drift', () => {
    expect(templatePill(row('a', { ...live })).label).toBe(TEMPLATE_STATUS_BADGE.published.label);
    expect(templatePill(row('b')).label).toBe(TEMPLATE_STATUS_BADGE['unpublished-changes'].label);
    expect(templatePill(row('c', { published_at: null })).label).toBe(TEMPLATE_STATUS_BADGE.draft.label);
  });

  it('gives each of the six states its own look', () => {
    const pills = [
      templatePill(row('a', { ...live })),
      templatePill(row('b')),
      templatePill(row('c', { published_at: null })),
      templatePill(row('d', { staged_at: 'now' })),
      templatePill(row('e', { staged_at: 'now', review_requested_at: 'now' })),
      templatePill(row('f', { staged_at: 'now', returned_at: 'later' })),
    ];
    expect(new Set(pills.map((pill) => pill.tone)).size).toBe(6);
    expect(new Set(pills.map((pill) => pill.label)).size).toBe(6);
  });
});

describe('STAGE_PILL', () => {
  it('names the two stages the pill covers in the pill words, and leaves the track and panel words alone', () => {
    expect(STAGE_PILL.staging.label).toBe('In staging');
    expect(STAGE_PILL.waiting.label).toBe('In sign-off');
    expect(STAGE_LABEL.staging).toBe('Staging');
    expect(STAGE_LABEL.waiting).toBe('Sign-off');
  });
});
