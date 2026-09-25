import { describe, expect, it } from 'bun:test';
import { formatUsd, limitsFor, monthlyUsd, overageCalls, overageUsd, serialiseLimits, trialDaysLeft } from './plans';

const MB = 1024 * 1024;

describe('limitsFor', () => {
  it('gives a trial the included numbers with live calls capped at them', () => {
    expect(limitsFor('trial')).toMatchObject({ maxTemplates: 10, maxVersions: 10, includedApiCalls: 10_000, maxApiCalls: 10_000, maxStorageBytes: 100 * MB });
  });

  it('keeps a read-only workspace on the trial’s numbers', () => {
    expect(limitsFor('lapsed')).toEqual(limitsFor('trial'));
  });

  it('bills Team’s calls past the included ones rather than stopping them', () => {
    expect(limitsFor('team')).toMatchObject({ includedApiCalls: 10_000, maxApiCalls: Infinity, maxStorageBytes: 1024 * MB });
  });

  it('adds 10 templates a pack and keeps 50 versions with any pack', () => {
    expect(limitsFor('team', 0)).toMatchObject({ maxTemplates: 10, maxVersions: 10 });
    expect(limitsFor('team', 1)).toMatchObject({ maxTemplates: 20, maxVersions: 50 });
    expect(limitsFor('team', 3)).toMatchObject({ maxTemplates: 40, maxVersions: 50 });
  });

  it('ignores packs outside Team', () => {
    expect(limitsFor('trial', 5)).toEqual(limitsFor('trial'));
  });

  it('leaves enterprise unbounded but for versions', () => {
    expect(limitsFor('enterprise')).toMatchObject({ maxTemplates: Infinity, maxApiCalls: Infinity, maxStorageBytes: Infinity, maxVersions: 100 });
  });
});

describe('overage', () => {
  it('counts only Team’s calls past the included ones', () => {
    expect(overageCalls(9_000, limitsFor('team'))).toBe(0);
    expect(overageCalls(12_345, limitsFor('team'))).toBe(2_345);
    expect(overageCalls(50_000, limitsFor('trial'))).toBe(0);
    expect(overageCalls(50_000, limitsFor('enterprise'))).toBe(0);
  });

  it('costs $1 per 1,000 calls, pro rata', () => {
    expect(overageUsd(2_500)).toBe(2.5);
    expect(overageUsd(0)).toBe(0);
  });
});

describe('monthlyUsd', () => {
  it('is $5 a member and $5 a pack', () => {
    expect(monthlyUsd(3, 0)).toBe(15);
    expect(monthlyUsd(3, 2)).toBe(25);
  });
});

describe('formatUsd', () => {
  it('drops cents from whole dollars and keeps two otherwise', () => {
    expect(formatUsd(5)).toBe('$5');
    expect(formatUsd(2.5)).toBe('$2.50');
    expect(formatUsd(1234)).toBe('$1,234');
  });
});

describe('trialDaysLeft', () => {
  const now = new Date('2026-09-10T12:00:00.000Z');
  it('rounds a part day up and stops at zero', () => {
    expect(trialDaysLeft('2026-09-13T12:00:00.000Z', now)).toBe(3);
    expect(trialDaysLeft('2026-09-10T13:00:00.000Z', now)).toBe(1);
    expect(trialDaysLeft('2026-09-01T00:00:00.000Z', now)).toBe(0);
  });
});

describe('serialiseLimits', () => {
  it('sends Infinity as null over the wire', () => {
    expect(serialiseLimits(limitsFor('enterprise')).maxStorageBytes).toBeNull();
    expect(serialiseLimits(limitsFor('team')).maxApiCalls).toBeNull();
    expect(serialiseLimits(limitsFor('trial')).maxStorageBytes).toBe(100 * MB);
  });
});
