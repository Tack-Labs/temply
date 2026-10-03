import { describe, expect, test } from 'bun:test';
import {
  browseTemplates,
  filterTemplates,
  matchesTemplateFilter,
  TEMPLATE_STATUS_BADGE,
  templateCountLabel,
  templateStatus,
  type TemplateListItem,
} from './template-search';

const item = (overrides: Partial<TemplateListItem> & { id: string }): TemplateListItem => ({
  title: 'Untitled',
  preview_text: null,
  short_code: null,
  updated_at: null,
  published_at: '2026-10-01T09:00:00.000Z',
  has_unpublished_changes: false,
  ...overrides,
});

const templates: TemplateListItem[] = [
  item({ id: 'tpl_1', title: 'Welcome email', preview_text: 'Glad you are here', short_code: 'WELC01' }),
  item({ id: 'tpl_2', title: 'Receipt', preview_text: 'Your order shipped', short_code: 'RCPT02', has_unpublished_changes: true }),
  item({ id: 'tpl_3', title: 'Newsletter', published_at: null }),
];

const ids = (result: TemplateListItem[]) => result.map((t) => t.id);

describe('filterTemplates', () => {
  test('empty query returns every template in order', () => {
    expect(filterTemplates(templates, '')).toBe(templates);
    expect(ids(filterTemplates(templates, ''))).toEqual(['tpl_1', 'tpl_2', 'tpl_3']);
  });

  test('whitespace-only query returns every template in order', () => {
    expect(ids(filterTemplates(templates, '   '))).toEqual(['tpl_1', 'tpl_2', 'tpl_3']);
  });

  test('matches title case-insensitively', () => {
    expect(ids(filterTemplates(templates, 'WELCOME'))).toEqual(['tpl_1']);
    expect(ids(filterTemplates(templates, 'receipt'))).toEqual(['tpl_2']);
  });

  test('matches preview text', () => {
    expect(ids(filterTemplates(templates, 'order shipped'))).toEqual(['tpl_2']);
  });

  test('matches short code', () => {
    expect(ids(filterTemplates(templates, 'rcpt'))).toEqual(['tpl_2']);
  });

  test('rows with null preview text and short code neither throw nor match', () => {
    expect(ids(filterTemplates(templates, 'shipped'))).toEqual(['tpl_2']);
    expect(ids(filterTemplates(templates, 'newsletter'))).toEqual(['tpl_3']);
  });

  test('no match returns an empty array', () => {
    expect(filterTemplates(templates, 'zebra')).toEqual([]);
  });

  test('result preserves input order when several rows match', () => {
    expect(ids(filterTemplates(templates, 'e'))).toEqual(['tpl_1', 'tpl_2', 'tpl_3']);
  });
});

describe('templateStatus', () => {
  test('a published template with nothing waiting is published', () => {
    expect(templateStatus({ published_at: '2026-10-01T09:00:00.000Z', has_unpublished_changes: false })).toBe('published');
  });

  test('a published template edited since is unpublished-changes, not a draft', () => {
    expect(templateStatus({ published_at: '2026-10-01T09:00:00.000Z', has_unpublished_changes: true })).toBe(
      'unpublished-changes',
    );
  });

  test('a template that was never published is a draft', () => {
    expect(templateStatus({ published_at: null, has_unpublished_changes: false })).toBe('draft');
  });

  test('never published wins over a stray unpublished-changes flag', () => {
    // The server only sets the flag on a row that has a published_at, but the
    // list must not call a template live that has never been.
    expect(templateStatus({ published_at: null, has_unpublished_changes: true })).toBe('draft');
  });

  test('a row with no published_at at all is a draft, not published', () => {
    // The type says null, but a response can omit the field; undefined must not
    // slip past the check and read as live.
    const row = { has_unpublished_changes: false } as Parameters<typeof templateStatus>[0];
    expect(templateStatus(row)).toBe('draft');
    expect(templateStatus({ ...row, has_unpublished_changes: true })).toBe('draft');
  });

  test('every status has a label and a tone, and the labels are the product vocabulary', () => {
    expect(TEMPLATE_STATUS_BADGE.published.label).toBe('Published');
    expect(TEMPLATE_STATUS_BADGE['unpublished-changes'].label).toBe('Unpublished changes');
    expect(TEMPLATE_STATUS_BADGE.draft.label).toBe('Draft');
    const tones = new Set(Object.values(TEMPLATE_STATUS_BADGE).map((badge) => badge.tone));
    // Three states, three looks: a published template must not read like one
    // with changes waiting.
    expect(tones.size).toBe(3);
  });
});

describe('matchesTemplateFilter', () => {
  const published = templates[0]!;
  const changed = templates[1]!;
  const draft = templates[2]!;

  test('all matches everything', () => {
    expect([published, changed, draft].map((t) => matchesTemplateFilter(t, 'all'))).toEqual([true, true, true]);
  });

  test('published matches only a template with nothing waiting', () => {
    expect([published, changed, draft].map((t) => matchesTemplateFilter(t, 'published'))).toEqual([true, false, false]);
  });

  test('drafts matches unpublished changes and never-published alike', () => {
    expect([published, changed, draft].map((t) => matchesTemplateFilter(t, 'drafts'))).toEqual([false, true, true]);
  });
});

describe('browseTemplates', () => {
  test('with no query and the all filter every row shows, in order, and published + drafts adds up to all', () => {
    const view = browseTemplates(templates, { query: '', filter: 'all' });
    expect(ids(view.rows)).toEqual(['tpl_1', 'tpl_2', 'tpl_3']);
    expect(view.counts).toEqual({ all: 3, published: 1, drafts: 2 });
    expect(view.counts.published + view.counts.drafts).toBe(view.counts.all);
    expect(view.total).toBe(3);
  });

  test('a filter narrows the rows without disturbing their order', () => {
    expect(ids(browseTemplates(templates, { query: '', filter: 'drafts' }).rows)).toEqual(['tpl_2', 'tpl_3']);
    expect(ids(browseTemplates(templates, { query: '', filter: 'published' }).rows)).toEqual(['tpl_1']);
  });

  test('the filter does not change the counts: every option keeps promising what it would show', () => {
    const all = browseTemplates(templates, { query: '', filter: 'all' }).counts;
    expect(browseTemplates(templates, { query: '', filter: 'drafts' }).counts).toEqual(all);
    expect(browseTemplates(templates, { query: '', filter: 'published' }).counts).toEqual(all);
  });

  test('search and filter combine', () => {
    const view = browseTemplates(templates, { query: 'receipt', filter: 'drafts' });
    expect(ids(view.rows)).toEqual(['tpl_2']);
    expect(ids(browseTemplates(templates, { query: 'receipt', filter: 'published' }).rows)).toEqual([]);
  });

  test('counts follow the search, so an option never promises rows the search has removed', () => {
    const view = browseTemplates(templates, { query: 'e', filter: 'all' });
    expect(view.counts).toEqual({ all: 3, published: 1, drafts: 2 });
    const narrowed = browseTemplates(templates, { query: 'welcome', filter: 'all' });
    expect(narrowed.counts).toEqual({ all: 1, published: 1, drafts: 0 });
    // The total is the workspace's, not the search's: it is what "3 of 12" is a part of.
    expect(narrowed.total).toBe(3);
  });

  test('a filter with nothing in it, and a search with no match, both yield no rows', () => {
    const none = browseTemplates([item({ id: 'a' })], { query: '', filter: 'drafts' });
    expect(none.rows).toEqual([]);
    expect(none.counts).toEqual({ all: 1, published: 1, drafts: 0 });
    expect(browseTemplates(templates, { query: 'zebra', filter: 'all' }).counts).toEqual({ all: 0, published: 0, drafts: 0 });
  });

  test('an empty workspace has no rows and zero counts', () => {
    const view = browseTemplates([], { query: '', filter: 'all' });
    expect(view.rows).toEqual([]);
    expect(view.counts).toEqual({ all: 0, published: 0, drafts: 0 });
    expect(view.total).toBe(0);
  });
});

describe('templateCountLabel', () => {
  test('reads the whole count when nothing is hidden', () => {
    expect(templateCountLabel(12, 12)).toBe('12 templates');
    expect(templateCountLabel(0, 0)).toBe('0 templates');
  });

  test('reads a part of the whole when a search or filter hides some', () => {
    expect(templateCountLabel(3, 12)).toBe('3 of 12 templates');
    expect(templateCountLabel(0, 12)).toBe('0 of 12 templates');
  });

  test('is singular by the whole, so one template is "1 template" and "0 of 1 template"', () => {
    expect(templateCountLabel(1, 1)).toBe('1 template');
    expect(templateCountLabel(0, 1)).toBe('0 of 1 template');
    expect(templateCountLabel(1, 2)).toBe('1 of 2 templates');
  });
});
