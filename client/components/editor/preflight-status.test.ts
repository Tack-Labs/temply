import { describe, expect, it } from 'bun:test';
import type { PreflightIssue } from '@temply/shared/preflight';
import { summarisePreflight } from './preflight-status';

const error = (id: string): PreflightIssue => ({ id, severity: 'error', message: id });
const warn = (id: string): PreflightIssue => ({ id, severity: 'warn', message: id });

describe('summarisePreflight', () => {
  it('makes no claim before the checks have run, so an empty list is not read as a clear bill', () => {
    expect(summarisePreflight([], false)).toEqual({
      tone: 'checking',
      title: 'Checking',
      errors: 0,
      warnings: 0,
      counts: '',
      spoken: 'Checking',
    });
    // Whatever the list holds, an unchecked result is not a verdict.
    expect(summarisePreflight([error('a'), warn('b')], false).tone).toBe('checking');
  });

  it('is clear, with both counts at zero, when there is nothing to report', () => {
    expect(summarisePreflight([], true)).toEqual({
      tone: 'success',
      title: 'All clear',
      errors: 0,
      warnings: 0,
      counts: '0 errors · 0 warnings',
      spoken: 'All clear, 0 errors, 0 warnings',
    });
  });

  it('is a warning when only warnings are present, and says so in the singular', () => {
    const status = summarisePreflight([warn('a')], true);
    expect(status.tone).toBe('warn');
    expect(status.counts).toBe('0 errors · 1 warning');
    expect(status.spoken).toBe('Worth a look, 0 errors, 1 warning');
  });

  it('pluralises each count on its own', () => {
    expect(summarisePreflight([warn('a'), warn('b')], true).counts).toBe('0 errors · 2 warnings');
    expect(summarisePreflight([error('a'), warn('b'), warn('c')], true).counts).toBe('1 error · 2 warnings');
    expect(summarisePreflight([error('a'), error('b'), warn('c')], true).counts).toBe('2 errors · 1 warning');
  });

  it('counts only what is a warning, so a severity it does not know is not one', () => {
    const unknown = { id: 'x', severity: 'info', message: 'x' } as unknown as PreflightIssue;
    const status = summarisePreflight([unknown], true);
    expect(status.tone).toBe('success');
    expect(status.warnings).toBe(0);
    expect(status.counts).toBe('0 errors · 0 warnings');
    expect(summarisePreflight([error('a'), warn('b'), unknown], true).warnings).toBe(1);
  });

  it('is an error whenever any error is present, however many warnings sit beside it', () => {
    const status = summarisePreflight([warn('a'), warn('b'), error('c')], true);
    expect(status.tone).toBe('danger');
    expect(status.title).toBe('Needs fixing');
    expect(status.errors).toBe(1);
    expect(status.warnings).toBe(2);
    expect(status.spoken).toBe('Needs fixing, 1 error, 2 warnings');
  });
});
