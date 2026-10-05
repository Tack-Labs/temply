import { describe, expect, it } from 'bun:test';
import { candidateFindings, changesForReview } from './template-review';
import type { WorkflowTemplate } from './template-stage';

const doc = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] });
const template = { title: 'Welcome', content: 'bad draft', staged_at: 'now', staged_content: doc, staged_theme: null,
  staged_preview_text: 'Preview', published_content: doc, published_theme: null, published_preview_text: 'Old preview' } as WorkflowTemplate;

describe('sign-off checks', () => {
  it('checks the candidate, even if the draft is unreadable', () => {
    expect(candidateFindings(template, '<p>Hello</p>').filter((issue) => issue.severity === 'error')).toEqual([]);
  });
  it('blocks corrupt candidate content or brand settings', () => {
    expect(candidateFindings({ ...template, staged_content: '{}' }).some((issue) => issue.id === 'unreadable-content')).toBe(true);
    expect(candidateFindings({ ...template, staged_theme: 'broken' }).some((issue) => issue.id === 'unreadable-theme')).toBe(true);
  });
  it('grades the rendered staged email size and checks links in the source', () => {
    const findings = candidateFindings({ ...template, staged_content: JSON.stringify({ type: 'doc', content: [{ type: 'button', attrs: { text: 'Go', url: '' } }] }) }, 'x'.repeat(103 * 1024));
    expect(findings.some((issue) => issue.severity === 'error')).toBe(true);
    expect(findings.length).toBeGreaterThan(1);
  });
  it('compares only the live and candidate copies', () => {
    expect(changesForReview(template).map(({ label, changed }) => [label, changed])).toEqual([
      ['Email content', false], ['Brand settings', false], ['Preview text', true],
    ]);
  });
});
