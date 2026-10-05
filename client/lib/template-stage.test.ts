import { describe, expect, it } from 'bun:test';
import { copyOf, nextStep, sortByStage, stageOf, type WorkflowTemplate } from './template-stage';
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
