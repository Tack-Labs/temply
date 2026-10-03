import { describe, expect, it } from 'bun:test';
import { formatPublishStamp, publishBadge, publishStatus, publishView } from './publish-state';

// Intl may put a narrow no-break space before "PM"; normalise so the
// assertions read the same on every ICU build.
const plain = (s: string) => s.replace(/\s/g, ' ');
const utc = { locale: 'en-US', timeZone: 'UTC' };
const now = new Date('2026-10-03T15:00:00Z');

describe('publishStatus', () => {
  it('is a draft until the first publish, whatever the unpublished flag says', () => {
    expect(publishStatus(null, false)).toBe('draft');
    expect(publishStatus(null, true)).toBe('draft');
  });

  it('is published while the draft matches the live copy', () => {
    expect(publishStatus('2026-10-03T14:15:00Z', false)).toBe('published');
  });

  it('reads unpublished changes once a published template has been edited', () => {
    expect(publishStatus('2026-10-03T14:15:00Z', true)).toBe('unpublished-changes');
  });
});

describe('formatPublishStamp', () => {
  it('gives the time alone for something published today', () => {
    expect(plain(formatPublishStamp('2026-10-03T14:15:00Z', now, utc))).toBe('2:15 PM');
  });

  it('gives the day for an earlier date this year', () => {
    expect(formatPublishStamp('2026-09-28T09:00:00Z', now, utc)).toBe('Sep 28');
  });

  it('adds the year once it is not this one', () => {
    expect(formatPublishStamp('2025-12-31T09:00:00Z', now, utc)).toBe('Dec 31, 2025');
  });

  it('compares calendar days in the reader zone, not in UTC', () => {
    // 23:30 UTC on the 3rd is already 12:30 on the 4th in Auckland, and the
    // reader's "now" is the 4th there, so it is today for them.
    const auckland = { locale: 'en-US', timeZone: 'Pacific/Auckland' };
    const later = new Date('2026-10-04T00:10:00Z');
    expect(plain(formatPublishStamp('2026-10-03T23:30:00Z', later, auckland))).toBe('12:30 PM');
  });

  it('is empty for a timestamp it cannot read', () => {
    expect(formatPublishStamp('not a date', now, utc)).toBe('');
  });
});

describe('publishBadge', () => {
  it('shares its words and tones with the templates list', () => {
    expect(publishBadge('draft', null)).toEqual({ label: 'Draft', tone: 'neutral' });
    expect(publishBadge('unpublished-changes', '2:15 PM')).toEqual({
      label: 'Unpublished changes',
      tone: 'warn',
    });
  });

  it('puts the stamp on the in-sync label', () => {
    expect(publishBadge('published', '2:15 PM')).toEqual({ label: 'Published 2:15 PM', tone: 'success' });
  });

  it('never reads exactly "Published" — that word is the toast', () => {
    expect(publishBadge('published', 'Sep 28')?.label).not.toBe('Published');
  });

  it('shows nothing for a published template until the stamp is known', () => {
    expect(publishBadge('published', null)).toBeNull();
    expect(publishBadge('published', '')).toBeNull();
  });
});

describe('publishView', () => {
  const FIRST = '2026-10-03T14:15:00Z';

  it('has the stamp the moment a draft is published, never a badge-less frame', () => {
    const draft = publishView(null, false, now, utc);
    expect(draft.badge).toEqual({ label: 'Draft', tone: 'neutral' });
    // The state the hook's old effect left behind for one committed frame:
    // published, with the stamp still to come.
    const published = publishView(FIRST, false, now, utc);
    expect(published.status).toBe('published');
    expect(published.badge).not.toBeNull();
    expect(plain(published.badge?.label ?? '')).toBe('Published 2:15 PM');
  });

  it('carries the new time, not the old one, the moment a template is republished', () => {
    const before = publishView(FIRST, false, now, utc);
    const edited = publishView(FIRST, true, now, utc);
    expect(edited.badge?.label).toBe('Unpublished changes');
    const after = publishView('2026-10-03T14:45:00Z', false, now, utc);
    expect(plain(before.badge?.label ?? '')).toBe('Published 2:15 PM');
    expect(plain(after.badge?.label ?? '')).toBe('Published 2:45 PM');
  });

  it('keeps the in-sync badge off the bare word the toast owns', () => {
    expect(publishView(FIRST, false, now, utc).badge?.label).not.toBe('Published');
  });

  it('gives the server and the first client render the same answer', () => {
    // Without a clock a published template has no badge and no tooltip; a
    // draft already knows what it is, because that needs no locale.
    expect(publishView(FIRST, false, null, utc)).toEqual({ status: 'published', badge: null, label: null });
    expect(publishView(null, false, null, utc)).toEqual({
      status: 'draft',
      badge: { label: 'Draft', tone: 'neutral' },
      label: null,
    });
  });

  it('re-words the stamp when the day turns over under a tab left open', () => {
    expect(plain(publishView(FIRST, false, now, utc).badge?.label ?? '')).toBe('Published 2:15 PM');
    const tomorrow = new Date('2026-10-04T08:00:00Z');
    expect(publishView(FIRST, false, tomorrow, utc).badge?.label).toBe('Published Oct 3');
  });

  it('puts the full time in the tooltip, and says so plainly when nothing was published', () => {
    // The date-time joiner ("," or " at ") is the ICU build's to choose.
    expect(plain(publishView(FIRST, false, now, utc).label ?? '')).toMatch(/^Published Oct 3, 2026.+2:15 PM$/);
    expect(publishView(null, false, now, utc).label).toBe('Not published yet');
  });
});
