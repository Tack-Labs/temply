'use client';

import { useAuth } from '@clerk/nextjs';
import { SALES_EMAIL } from '~/lib/site';

import { Suspense, useEffect } from 'react';
import { CheckIcon, Loader2Icon, XIcon, LockIcon } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMinimumDisplay } from '~/hooks/use-minimum-display';
import { httpGet, httpPost } from '~/lib/http';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';
import { Button } from '~/components/ui/button';
import { PageLoading } from '~/components/ui/page-loading';
import { Badge, Card, EmptyState, ErrorState, StatTile } from '~/components/ui/surfaces';
import { cn } from '~/lib/classname';

type PlanInfo = {
  plan: string;
  status: string;
  usage: {
    templates: number;
    apiKeys: number;
  };
  /** ISO date a portal cancellation takes effect; null while the plan renews. */
  cancelAt: string | null;
};

type CheckoutResponse = {
  url: string;
};

type Quota = {
  plan: 'free' | 'pro' | 'enterprise';
  api: { used: number; limit: number | null; remaining: number | null };
  resetsOn: string;
};

function formatReset(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** "5 Oct" for a cancellation date — the same shape the reset date uses. */
function formatEnds(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** The month's API consumption with a progress bar — the same numbers the
 *  sidebar widget shows, given room to breathe on the plan page. */
function ApiUsageCard() {
  const { data } = useQuery({
    queryKey: ['quota'],
    queryFn: () => httpGet<Quota>('/api/v1/quota', {}),
    staleTime: 30_000,
  });

  if (!data) return null;

  const { used, limit } = data.api;
  const unlimited = limit === null;
  const pct = unlimited || limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const over = !unlimited && pct >= 100;

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">API usage</p>
        <p className="text-sm text-muted tabular-nums">
          {unlimited
            ? `${used.toLocaleString()} · unlimited`
            : `${used.toLocaleString()} / ${limit!.toLocaleString()}`}
        </p>
      </div>
      {!unlimited ? (
        <div
          className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-hover"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={`${used} of ${limit} monthly API calls used`}
        >
          <div
            className={cn('h-full rounded-full', over ? 'bg-danger' : 'bg-accent')}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>API calls this month</span>
        <span>resets {formatReset(data.resetsOn)}</span>
      </div>
    </Card>
  );
}

/**
 * `included: false` means the plan does not have this. Restrictions used to be
 * listed as `included: true` — "0 API keys" and "No versioning" rendered with
 * the same green tick as a real benefit, which read as three inclusions on a
 * plan that has one.
 */
const plans = [
  {
    id: 'free' as const,
    name: 'Free',
    price: '£0',
    period: '/month',
    features: [
      { text: '2 templates', included: true },
      { text: '1 API key', included: true },
      { text: '10,000 API calls/month', included: true },
      { text: 'Version history', included: false },
      { text: '50 MB of image storage', included: true },
    ],
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: '£12',
    period: '/month',
    features: [
      { text: '10 templates', included: true },
      { text: '5 API keys', included: true },
      { text: '50,000 API calls/month', included: true },
      { text: '10 versions per template', included: true },
      { text: '1 GB of image storage', included: true },
    ],
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise',
    price: "Let's talk",
    period: '',
    features: [
      { text: 'Unlimited templates', included: true },
      { text: 'Unlimited API keys', included: true },
      { text: 'Custom API volume', included: true },
      { text: '25 versions per template', included: true },
      { text: 'Unlimited image storage', included: true },
    ],
  },
];

function PlanContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription updated');
    }
  }, [searchParams]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['billing'],
    queryFn: () => httpGet<PlanInfo>('/api/v1/billing', {}),
  });
  const showLoading = useMinimumDisplay(isLoading);
  const { orgRole } = useAuth();
  const isAdmin = orgRole === 'org:admin';
  const queryClient = useQueryClient();

  const { mutateAsync: createCheckout, isPending: isCheckoutLoading } = useMutation({
    mutationFn: (plan: 'pro') =>
      httpPost<CheckoutResponse>('/api/v1/billing/checkout', { plan }),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    // A refusal usually means this page is older than the plan: it loaded
    // before the webhook landed. Reading the plan again catches it up.
    onError: (error) => {
      toast.error(error.message || 'Could not start checkout');
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      queryClient.invalidateQueries({ queryKey: ['quota'] });
    },
  });

  const { mutateAsync: createPortal, isPending: isPortalLoading } = useMutation({
    mutationFn: () => httpPost<CheckoutResponse>('/api/v1/billing/portal', {}),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error) => toast.error(error.message || 'Could not open the billing portal'),
  });

  if (!isAdmin) {
    return (
      <EmptyState
        icon={LockIcon}
        title="Plan and billing are for admins"
        description="Ask an admin on your team to change the plan or manage billing."
      />
    );
  }

  if (showLoading) {
    return <PageLoading label="Loading your plan…" />;
  }

  // A failed query must not fall through to a default plan: showing a paying
  // customer their account as free is worse than showing them nothing, because
  // it reads as a billing fault rather than a display one.
  if (isError || !data) {
    return (
      <div className="space-y-5">
        <ErrorState
          description="We could not load your plan. Nothing has changed on your account — this is only a display problem."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const plan = data.plan;
  const usage = data.usage;
  const hasSubscription = plan !== 'free';
  // A cancelled-but-not-yet-ended plan is still the current plan; the card
  // says when it stops and offers the way back, which is the portal.
  const endsOn = hasSubscription && data.cancelAt ? formatEnds(data.cancelAt) : null;

  return (
    <div className="space-y-5">
      {/* The layout's header carries the title now, so the one action the page
          owns sits on its own row rather than being dropped with it. */}
      {hasSubscription ? (
        <div className="flex justify-end">
          <Button onClick={() => createPortal()} disabled={isPortalLoading}>
            {isPortalLoading ? <Loader2Icon className="animate-spin" /> : null}
            Manage subscription
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile label="Templates" value={usage.templates} />
        <StatTile label="API keys" value={usage.apiKeys} />
      </div>

      <ApiUsageCard />

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-ink">Plans</h2>

        <div className="grid gap-3 lg:grid-cols-3">
          {plans.map((p) => {
            const isCurrentPlan = plan === p.id;
            const isDowngrade = p.id === 'free' && plan !== 'free';
            const isAnotherPaidPlan = p.id !== plan && p.id !== 'free' && plan !== 'free';

            return (
              <Card
                key={p.id}
                inset={false}
                className={cn('p-4', isCurrentPlan && 'border-accent')}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">{p.name}</h3>
                  {isCurrentPlan ? (
                    endsOn ? <Badge tone="warn">Ends {endsOn}</Badge> : <Badge tone="accent">Current plan</Badge>
                  ) : null}
                </div>

                <p className="mt-1.5 flex items-baseline gap-0.5">
                  <span className="text-2xl font-semibold tabular-nums text-ink">{p.price}</span>
                  <span className="text-sm text-muted">{p.period}</span>
                </p>

                <ul className="mt-4 space-y-1.5">
                  {p.features.map((feature) => (
                    <li key={feature.text} className="flex items-center gap-2 text-sm">
                      {feature.included ? (
                        <CheckIcon className="size-4 shrink-0 text-success-ink" aria-hidden />
                      ) : (
                        <XIcon className="size-4 shrink-0 text-faint" aria-hidden />
                      )}
                      <span className={feature.included ? 'text-ink' : 'text-muted line-through'}>
                        {feature.text}
                      </span>
                      <span className="sr-only">{feature.included ? 'included' : 'not included'}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5">
                  {isCurrentPlan && endsOn ? (
                    <Button variant="primary" className="w-full" onClick={() => createPortal()} disabled={isPortalLoading}>
                      {isPortalLoading ? <Loader2Icon className="animate-spin" /> : null}
                      Resume plan
                    </Button>
                  ) : isCurrentPlan ? (
                    <Button disabled className="w-full">
                      Current plan
                    </Button>
                  ) : p.id === 'enterprise' ? (
                    // Enterprise is arranged by hand, never through the portal —
                    // whatever plan the reader is on, the way in is a conversation.
                    <Button variant="primary" className="w-full" asChild>
                      <a href={`mailto:${SALES_EMAIL}?subject=Temply%20Enterprise`}>Contact sales</a>
                    </Button>
                  ) : isDowngrade || isAnotherPaidPlan ? (
                    // Both changes happen in the billing portal. The downgrade
                    // control used to render with no handler at all, so every
                    // path that increased spend worked and this one did nothing.
                    <Button
                      className="w-full"
                      onClick={() => createPortal()}
                      disabled={isPortalLoading}
                    >
                      {isPortalLoading ? <Loader2Icon className="animate-spin" /> : null}
                      {isDowngrade ? 'Downgrade' : 'Switch plan'}
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={() => createCheckout(p.id as 'pro')}
                      disabled={isCheckoutLoading}
                    >
                      {isCheckoutLoading ? <Loader2Icon className="animate-spin" /> : null}
                      Upgrade
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function PlanPage() {
  return (
    <Suspense>
      <PlanContent />
    </Suspense>
  );
}
