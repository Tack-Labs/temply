import type { Plan } from './plans';

export const ADMIN_PAGE_SIZE = 25;

export type AdminOrganization = {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
  readonly members: number | null;
  readonly usage: {
    readonly liveCalls: number;
    readonly testCalls: number;
    readonly templates: number;
    readonly storageBytes: number;
  };
  readonly subscription: {
    readonly plan: Plan | 'not-started';
    readonly status: string | null;
    readonly seats: number | null;
    readonly templatePacks: number;
    readonly trialEndsAt: string | null;
    readonly currentPeriodEnd: string | null;
    readonly cancelAt: string | null;
  };
};

export type AdminOrganizations = {
  readonly organizations: readonly AdminOrganization[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  /** Live and test calls use this Europe/London calendar month. */
  readonly period: string;
};
