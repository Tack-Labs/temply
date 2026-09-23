import { describe, expect, it } from 'bun:test';
import { PLAN_LIMITS, serialiseLimits } from './plans';

describe('maxStorageBytes', () => {
  it('is 50 MB on free, 1 GB on pro, unlimited on enterprise', () => {
    expect(PLAN_LIMITS.free.maxStorageBytes).toBe(50 * 1024 * 1024);
    expect(PLAN_LIMITS.pro.maxStorageBytes).toBe(1024 * 1024 * 1024);
    expect(PLAN_LIMITS.enterprise.maxStorageBytes).toBe(Infinity);
  });

  it('serialises Infinity to null over the wire', () => {
    expect(serialiseLimits(PLAN_LIMITS.enterprise).maxStorageBytes).toBeNull();
    expect(serialiseLimits(PLAN_LIMITS.free).maxStorageBytes).toBe(50 * 1024 * 1024);
  });
});
