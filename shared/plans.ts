/**
 * The single source of truth for plans, prices and limits.
 *
 * They live in `shared/` because both sides need the same numbers: the server
 * enforces a limit, and the client has to state it before the request is made.
 * A limit written down on either side separately is one that drifts, and the
 * two disagreeing means telling a customer they may do something the API then
 * refuses.
 *
 * The prices here are what the pages say. What a customer is charged is the
 * prices configured in Stripe (see README, "Billing"); the two must be
 * changed together.
 */

/**
 * `trial` is every new workspace for its first TRIAL_DAYS, with no card.
 * `lapsed` is a workspace whose trial or subscription has ended unpaid: it
 * keeps everything and can read it, but cannot edit, and its live keys stop
 * answering, until someone subscribes. `team` is the priced plan;
 * `enterprise` is sold by hand.
 */
export type Plan = 'trial' | 'team' | 'enterprise' | 'lapsed';
export type PaidPlan = 'team' | 'enterprise';

export const PLAN_LABELS: Record<Plan, string> = {
  trial: 'Free trial',
  team: 'Team',
  enterprise: 'Enterprise',
  lapsed: 'Read-only',
};

export const TRIAL_DAYS = 14;
/** The dashboard starts warning this many days before a trial ends. */
export const TRIAL_WARNING_DAYS = 3;

/** US dollars a month, before tax. */
export const PRICES_USD = {
  /** Per member of the organization. */
  seat: 5,
  /** Per thousand live calls past the included ones, charged by the call. */
  overagePer1000Calls: 1,
  templatePack: 5,
} as const;

/** What every workspace gets, on trial or paid. */
export const INCLUDED = { apiCalls: 10_000, templates: 10, versionsPerTemplate: 10 } as const;

/**
 * One pack adds ten templates. Holding any pack at all lifts the history of
 * every template to fifty versions — a second pack adds templates, not
 * history.
 */
export const TEMPLATE_PACK = { templates: 10, versionsPerTemplate: 50 } as const;
export const MAX_TEMPLATE_PACKS = 50;

export interface PlanLimits {
  maxTemplates: number;
  maxApiKeys: number;
  /** Versions kept per template; the oldest goes when a publish passes it. */
  maxVersions: number;
  /** Live calls a month the price covers. */
  includedApiCalls: number;
  /** Live calls a month after which the API refuses. Infinity where calls
   *  past the included ones are served and billed instead. */
  maxApiCalls: number;
  maxBrands: number;
  /** Total bytes of uploaded images a workspace may keep. */
  maxStorageBytes: number;
}

const MB = 1024 * 1024;

/**
 * A trial is the Team plan with the API capped at what is included: there
 * is no card to bill the rest to. Its storage is smaller because a lapsed
 * workspace's images stay hosted for the emails already sent with them.
 * A read-only workspace keeps its trial's numbers so its pages still read
 * sensibly; what stops it is the write guard, not a limit.
 */
export function limitsFor(plan: Plan, templatePacks = 0): PlanLimits {
  const packs = plan === 'team' ? Math.max(0, templatePacks) : 0;
  switch (plan) {
    case 'enterprise':
      return {
        maxTemplates: Infinity,
        maxApiKeys: Infinity,
        maxVersions: 100,
        includedApiCalls: Infinity,
        maxApiCalls: Infinity,
        maxBrands: Infinity,
        maxStorageBytes: Infinity,
      };
    case 'team':
      return {
        maxTemplates: INCLUDED.templates + packs * TEMPLATE_PACK.templates,
        maxApiKeys: 5,
        maxVersions: packs > 0 ? TEMPLATE_PACK.versionsPerTemplate : INCLUDED.versionsPerTemplate,
        includedApiCalls: INCLUDED.apiCalls,
        maxApiCalls: Infinity,
        maxBrands: 5,
        maxStorageBytes: 1024 * MB,
      };
    case 'trial':
    case 'lapsed':
      return {
        maxTemplates: INCLUDED.templates,
        maxApiKeys: 5,
        maxVersions: INCLUDED.versionsPerTemplate,
        includedApiCalls: INCLUDED.apiCalls,
        maxApiCalls: INCLUDED.apiCalls,
        maxBrands: 5,
        maxStorageBytes: 100 * MB,
      };
  }
}

/** Live calls past the included ones on a plan that bills them; 0 on a
 *  plan that caps instead, or that includes everything. */
export function overageCalls(used: number, limits: Pick<PlanLimits, 'includedApiCalls' | 'maxApiCalls'>): number {
  if (!Number.isFinite(limits.includedApiCalls) || Number.isFinite(limits.maxApiCalls)) return 0;
  return Math.max(0, used - limits.includedApiCalls);
}

export function overageUsd(calls: number): number {
  return (calls / 1000) * PRICES_USD.overagePer1000Calls;
}

/** The fixed part of a Team bill: seats and packs, before any overage. */
export function monthlyUsd(seats: number, templatePacks: number): number {
  return seats * PRICES_USD.seat + templatePacks * PRICES_USD.templatePack;
}

/** "$5", "$1.50" — whole dollars lose their cents, anything else keeps two. */
export function formatUsd(amount: number): string {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
}

/** Whole days left in a trial, counting a part day as one; 0 once it ends. */
export function trialDaysLeft(trialEndsAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((Date.parse(trialEndsAt) - now.getTime()) / 86_400_000));
}

/** JSON turns Infinity into null, so send null over the wire and read it back
 *  as "no limit" on the client. */
export type WireLimits = {
  maxTemplates: number | null;
  maxApiKeys: number | null;
  maxVersions: number | null;
  includedApiCalls: number | null;
  maxApiCalls: number | null;
  maxStorageBytes: number | null;
};

export function serialiseLimits(limits: PlanLimits): WireLimits {
  const wire = (n: number) => (Number.isFinite(n) ? n : null);
  return {
    maxTemplates: wire(limits.maxTemplates),
    maxApiKeys: wire(limits.maxApiKeys),
    maxVersions: wire(limits.maxVersions),
    includedApiCalls: wire(limits.includedApiCalls),
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
