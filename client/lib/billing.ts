import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Plan, WireLimits } from '@temply/shared/plans';
import { httpGet, httpPost, httpPut } from '~/lib/http';

/** What GET /api/v1/billing answers — the one read the plan page, the
 *  banners and the limit checks all share, under one query key. */
export type Billing = {
  plan: Plan;
  /** Stripe's word for a paid plan (`active`, `past_due`…); null otherwise. */
  status: string | null;
  /** When a scheduled cancellation takes effect; null while the plan renews. */
  cancelAt: string | null;
  trialEndsAt: string | null;
  seats: number | null;
  templatePacks: number;
  currentPeriodEnd: string | null;
  usage: { templates: number; apiKeys: number; apiCalls: number; storageBytes: number };
  limits: WireLimits;
  overage: { calls: number; usd: number };
  /** YYYY-MM-DD the month's API count starts again. */
  resetsOn: string;
  /** False on a server with no Stripe prices set, where nothing can be bought. */
  billingConfigured: boolean;
};

/** What GET /api/v1/quota answers: the month's calls, for the sidebar. */
export type Quota = {
  plan: Plan;
  cancelAt: string | null;
  trialEndsAt: string | null;
  /** `limit` is where live calls stop; `included` is what the price covers.
   *  Null is unbounded — Team has an included amount and no limit. */
  api: { used: number; limit: number | null; included: number | null; remaining: number | null };
  overage: { calls: number; usd: number };
  resetsOn: string;
};

export const PLAN_PAGE = '/dashboard/settings/plan';

export function useBilling(options: { refetchInterval?: number | false } = {}) {
  return useQuery({
    queryKey: ['billing'],
    queryFn: () => httpGet<Billing>('/api/v1/billing', {}),
    staleTime: 30_000,
    refetchInterval: options.refetchInterval,
  });
}

export function useQuota() {
  return useQuery({
    queryKey: ['quota'],
    queryFn: () => httpGet<Quota>('/api/v1/quota', {}),
    staleTime: 30_000,
  });
}

/** "9 Oct" — the shape every billing date on screen takes. */
export function shortDate(iso: string): string {
  // A bare YYYY-MM-DD is a UTC day; read in local time it can land on the
  // day before.
  const bare = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return new Date(bare ? `${iso}T00:00:00Z` : iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: bare ? 'UTC' : undefined,
  });
}

/** "12 days left", "1 day left", "Ends today". */
export function daysLeftLabel(days: number): string {
  if (days <= 0) return 'Ends today';
  return `${days} day${days === 1 ? '' : 's'} left`;
}

/** Checkout and the portal both answer with a Stripe URL to leave for. */
function leaveFor(data: { url: string }) {
  window.location.href = data.url;
}

export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templatePacks: number) =>
      httpPost<{ url: string }>('/api/v1/billing/checkout', { templatePacks }),
    onSuccess: leaveFor,
    // A refusal usually means this page is older than the plan: it loaded
    // before the webhook landed. Reading the plan again catches it up.
    onError: (error) => {
      toast.error(error.message || 'Could not start checkout');
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
      void queryClient.invalidateQueries({ queryKey: ['quota'] });
    },
  });
}

export function usePortal() {
  return useMutation({
    mutationFn: () => httpPost<{ url: string }>('/api/v1/billing/portal', {}),
    onSuccess: leaveFor,
    onError: (error) => toast.error(error.message || 'Could not open billing'),
  });
}

export function useSetTemplatePacks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quantity: number) => httpPut<Billing>('/api/v1/billing/template-packs', { quantity }),
    onSuccess: (data) => {
      queryClient.setQueryData(['billing'], data);
      toast.success(
        data.templatePacks === 0
          ? 'Template packs removed'
          : `${data.templatePacks} template pack${data.templatePacks === 1 ? '' : 's'} on your plan`,
      );
    },
    onError: (error) => {
      toast.error(error.message || 'Could not change template packs');
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}
