import { describe, expect, test } from 'bun:test';
import { filterTemplates, type TemplateListItem } from './template-search';

const item = (overrides: Partial<TemplateListItem> & { id: string }): TemplateListItem => ({
  title: 'Untitled',
  preview_text: null,
  short_code: null,
  updated_at: null,
  ...overrides,
});

const templates: TemplateListItem[] = [
  item({ id: 'tpl_1', title: 'Welcome email', preview_text: 'Glad you are here', short_code: 'WELC01' }),
  item({ id: 'tpl_2', title: 'Receipt', preview_text: 'Your order shipped', short_code: 'RCPT02' }),
  item({ id: 'tpl_3', title: 'Newsletter' }),
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
