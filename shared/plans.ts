/**
 * The single source of truth for plan limits.
 *
 * They live in `shared/` because both sides need the same numbers: the server
 * enforces a limit, and the client has to state it before the request is made.
 * A limit written down on either side separately is one that drifts, and the
 * two disagreeing means telling a customer they may do something the API then
 * refuses.
 */

export type Plan = 'free' | 'pro' | 'enterprise';

export interface PlanLimits {
  maxTemplates: number;
  maxApiKeys: number;
  maxVersions: number;
  maxApiCalls: number;
  maxBrands: number;
  /** Total bytes of uploaded images a user may keep. */
  maxStorageBytes: number;
}

/** `Infinity` means unlimited. It does not survive JSON, so anything sending
 *  limits over the wire must map it — see `serialiseLimits`. */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { maxTemplates: 2, maxApiKeys: 1, maxVersions: 0, maxApiCalls: 10_000, maxBrands: 1, maxStorageBytes: 50 * 1024 * 1024 },
  pro: { maxTemplates: 10, maxApiKeys: 5, maxVersions: 10, maxApiCalls: 50_000, maxBrands: 5, maxStorageBytes: 1024 * 1024 * 1024 },
  enterprise: { maxTemplates: Infinity, maxApiKeys: Infinity, maxVersions: 25, maxApiCalls: Infinity, maxBrands: Infinity, maxStorageBytes: Infinity },
};

/** JSON turns Infinity into null, so send null over the wire and read it back
 *  as "no limit" on the client. */
export type WireLimits = {
  maxTemplates: number | null;
  maxApiKeys: number | null;
  maxVersions: number | null;
  maxApiCalls: number | null;
  maxStorageBytes: number | null;
};

export function serialiseLimits(limits: PlanLimits): WireLimits {
  const wire = (n: number) => (Number.isFinite(n) ? n : null);
  return {
    maxTemplates: wire(limits.maxTemplates),
    maxApiKeys: wire(limits.maxApiKeys),
    maxVersions: wire(limits.maxVersions),
    maxApiCalls: wire(limits.maxApiCalls),
    maxStorageBytes: wire(limits.maxStorageBytes),
  };
}

/**
 * Test keys are outside the plans: any account may hold them, and their
 * calls never touch the plan's quota. This cap is what stops a test key from
 * quietly becoming a free production key.
 */
export const TEST_API_CALLS_PER_MONTH = 1_000;

/** null (or a non-finite) limit means unlimited, so nothing is ever "reached". */
export function isLimitReached(used: number, limit: number | null): boolean {
  if (limit === null || !Number.isFinite(limit)) return false;
  return used >= limit;
}

/**
 * Calls a single key may make in one minute, whatever the plan. The monthly
 * quota above is the budget; this is the fuse for a loop that got away —
 * a client retrying in a tight loop would otherwise burn a month's quota,
 * and the server's render time with it, in minutes. Test keys sit lower:
 * they are for wiring up, not for load.
 */
export const API_BURST_PER_MINUTE: Record<'live' | 'test', number> = { live: 120, test: 30 };

/**
 * The most a template's document may run to, as the JSON the editor stores,
 * in characters — the measure a string's length and a schema's maxLength
 * share. On disk that is a megabyte of Latin text and up to three of CJK;
 * the bound is on what nobody wrote by hand either way. The largest starter
 * is under 20 thousand, and every save, render and version copy carries the
 * whole document. The request limit above this is 8 MB, sized for an image
 * upload — it is not a bound on a document.
 */
export const TEMPLATE_CONTENT_MAX_LENGTH = 1_000_000;
