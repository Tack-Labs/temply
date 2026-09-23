import { describe, expect, it } from 'bun:test';
import type { TemplateDataKeys } from '@temply/shared/template-data';
import { initialPreviewData, toPayload } from './preview-data-panel';

const keys: TemplateDataKeys = {
  conditions: ['isMember'],
  variables: ['firstName', 'name'],
  placeholders: { firstName: 'there' },
  where: {},
  urlVariables: [],
  lists: ['items'],
  inList: { name: 'items' },
};

describe('preview data for lists', () => {
  it('seeds every list with two items, enough to see the repetition', () => {
    expect(initialPreviewData(keys).lists).toEqual({ items: 2 });
  });

  it('sends a list as that many empty items, so each row reads the top-level values', () => {
    const data = initialPreviewData(keys);
    expect(toPayload(data).items).toEqual([{}, {}]);
    expect(toPayload({ ...data, lists: { items: 0 } }).items).toEqual([]);
  });
});
