import { describe, expect, it } from 'bun:test';
import { nextStepCopy, pickNextStep } from './next-step';
import type { TemplateListItem } from './template-search';

const STAMP = '2026-10-05T09:00:00.000Z';

// Live unless a patch says otherwise: publishing writes one stamp to both
// columns, so equal stamps are what "nothing ahead of what is live" looks like.
const row = (id: string, patch: Partial<TemplateListItem> = {}): TemplateListItem => ({
  id, title: `Title ${id}`, short_code: null, preview_text: null,
  updated_at: STAMP, published_at: STAMP, has_unpublished_changes: false, ...patch,
});
const live = (id: string) => row(id);
const changed = (id: string, patch: Partial<TemplateListItem> = {}) =>
  row(id, { updated_at: '2026-10-05T10:00:00.000Z', has_unpublished_changes: true, ...patch });
const staged = (id: string, patch: Partial<TemplateListItem> = {}) =>
  row(id, { staged_at: '2026-10-05T11:00:00.000Z', ...patch });
const waiting = (id: string, patch: Partial<TemplateListItem> = {}) =>
  staged(id, { review_requested_at: '2026-10-05T12:00:00.000Z', ...patch });

describe('pickNextStep', () => {
  it('takes a template in sign-off over staging, and staging over a draft', () => {
    const list = [changed('draft'), staged('staging'), waiting('signoff'), live('done')];
    expect(pickNextStep(list)?.id).toBe('signoff');
    expect(pickNextStep(list.filter((item) => item.id !== 'signoff'))?.id).toBe('staging');
    expect(pickNextStep(list.filter((item) => item.id === 'draft' || item.id === 'done'))?.id).toBe('draft');
  });

  it('keeps the list’s own recency within a stage', () => {
    expect(pickNextStep([changed('newer'), changed('older')])?.id).toBe('newer');
  });

  it('looks past the rows a page shows, since it is handed the whole list', () => {
    const many = [...Array.from({ length: 8 }, (_, i) => live(`l${i}`)), waiting('buried')];
    expect(pickNextStep(many)?.id).toBe('buried');
  });

  it('names a draft that was never published', () => {
    expect(pickNextStep([live('a'), row('new', { published_at: null })])?.id).toBe('new');
  });

  it('is nothing when every template is live, and nothing for an empty account', () => {
    expect(pickNextStep([live('a'), live('b')])).toBeNull();
    expect(pickNextStep([])).toBeNull();
  });

  it('does not reorder what it was given', () => {
    const list = [live('a'), waiting('b')];
    pickNextStep(list);
    expect(list.map((item) => item.id)).toEqual(['a', 'b']);
  });
});

describe('nextStepCopy', () => {
  it('asks an admin to review a template in sign-off, at the review page', () => {
    expect(nextStepCopy(waiting('w'), true)).toEqual({
      kind: 'waiting',
      title: 'Title w is ready for your sign-off',
      lead: 'Moved to sign-off',
      stamp: '2026-10-05T12:00:00.000Z',
      tail: '',
      button: 'Review',
      href: '/templates/w/review',
    });
  });

  it('tells anyone else that it is waiting, and offers the same page to look at', () => {
    const copy = nextStepCopy(waiting('w'), false);
    expect(copy.title).toBe('Title w is waiting for sign-off');
    expect(copy.button).toBe('View sign-off');
    expect(copy.href).toBe('/templates/w/review');
    expect(copy.lead).toBe('Moved to sign-off');
  });

  it('points a staged template at the review page, and says what comes next', () => {
    expect(nextStepCopy(staged('s'), true)).toEqual({
      kind: 'staging',
      title: 'Title s is in staging',
      lead: 'Staged',
      stamp: '2026-10-05T11:00:00.000Z',
      tail: 'Ask for sign-off when it is ready.',
      button: 'Open',
      href: '/templates/s/review',
    });
  });

  it('reads a sent-back copy as sent back, counted from when it came back', () => {
    const copy = nextStepCopy(staged('s', { returned_at: '2026-10-05T13:00:00.000Z' }), true);
    expect(copy.kind).toBe('returned');
    expect(copy.title).toBe('Title s was sent back');
    expect(copy.lead).toBe('Sent back');
    expect(copy.stamp).toBe('2026-10-05T13:00:00.000Z');
    expect(copy.tail).toBe('Make the changes, then ask for sign-off again.');
    expect(copy.href).toBe('/templates/s/review');
  });

  it('sends a draft with changes to the editor, counted from the last edit', () => {
    expect(nextStepCopy(changed('d'), false)).toEqual({
      kind: 'draft',
      title: 'Title d has unpublished changes',
      lead: 'Edited',
      stamp: '2026-10-05T10:00:00.000Z',
      tail: '',
      button: 'Open',
      href: '/templates/d',
    });
  });

  it('reads a template that was never published as a draft with changes too', () => {
    const copy = nextStepCopy(row('n', { published_at: null }), false);
    expect(copy.kind).toBe('draft');
    expect(copy.title).toBe('Title n has unpublished changes');
    expect(copy.href).toBe('/templates/n');
  });

  it('leaves the time out rather than invent one when the stamp is missing', () => {
    expect(nextStepCopy(changed('d', { updated_at: null }), false).stamp).toBeNull();
  });

  it('calls a template with no title Untitled, as the editor does', () => {
    expect(nextStepCopy(waiting('w', { title: '' }), true).title).toBe('Untitled is ready for your sign-off');
  });
});
