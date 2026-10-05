import { describe, expect, it } from 'bun:test';
import { STAGE_ORDER, templateStage } from './stage';

const SYNCED = { updated_at: '2026-10-01T10:00:00.000Z', published_at: '2026-10-01T10:00:00.000Z' };
const AHEAD = { updated_at: '2026-10-01T11:00:00.000Z', published_at: '2026-10-01T10:00:00.000Z' };
const NEVER = { updated_at: '2026-10-01T10:00:00.000Z', published_at: null };
const none = { staged_at: null, review_requested_at: null };
const staged = { staged_at: '2026-10-01T12:00:00.000Z', review_requested_at: null };
const waiting = { staged_at: '2026-10-01T12:00:00.000Z', review_requested_at: '2026-10-01T12:05:00.000Z' };

describe('templateStage', () => {
  it('is live when the template is published and the draft has not moved', () => {
    expect(templateStage({ ...SYNCED, ...none })).toBe('live');
  });

  it('is draft when the draft is ahead of what is live', () => {
    expect(templateStage({ ...AHEAD, ...none })).toBe('draft');
  });

  it('is draft when the template was never published', () => {
    expect(templateStage({ ...NEVER, ...none })).toBe('draft');
  });

  it('is staging once a candidate is staged, whatever the draft reads as', () => {
    expect(templateStage({ ...AHEAD, ...staged })).toBe('staging');
    expect(templateStage({ ...SYNCED, ...staged })).toBe('staging');
    expect(templateStage({ ...NEVER, ...staged })).toBe('staging');
  });

  it('is waiting once sign-off is requested, ahead of every other stamp', () => {
    expect(templateStage({ ...AHEAD, ...waiting })).toBe('waiting');
    expect(templateStage({ ...SYNCED, ...waiting })).toBe('waiting');
    expect(templateStage({ ...NEVER, ...waiting })).toBe('waiting');
  });

  it('reads a stamp the server did not send as absent', () => {
    // A rolling deploy can hand the client a row from before these columns.
    const old = { ...SYNCED } as Parameters<typeof templateStage>[0];
    expect(templateStage(old)).toBe('live');
  });

  it('needs nothing but the four stamps', () => {
    const row = { ...AHEAD, ...staged, content: '{}', title: 'Welcome' };
    expect(templateStage(row)).toBe('staging');
  });
});

describe('STAGE_ORDER', () => {
  it('runs left to right along the pipeline', () => {
    expect([...STAGE_ORDER]).toEqual(['draft', 'staging', 'waiting', 'live']);
  });
});
