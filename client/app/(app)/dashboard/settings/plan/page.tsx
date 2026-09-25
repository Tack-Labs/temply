'use client';

import { useAuth, useOrganization } from '@clerk/nextjs';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2Icon, MinusIcon, PlusIcon, ZapIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatBytes } from '@temply/shared/bytes';
import {
  INCLUDED,
  MAX_TEMPLATE_PACKS,
  PLAN_LABELS,
  PRICES_USD,
  TEMPLATE_PACK,
  TRIAL_WARNING_DAYS,
  formatUsd,
  monthlyUsd,
  trialDaysLeft,
} from '@temply/shared/plans';
import { Button } from '~/components/ui/button';
import { ConfirmDialog } from '~/components/ui/confirm-dialog';
import { PageLoading } from '~/components/ui/page-loading';
import { Badge, Card, ErrorState, Reveal } from '~/components/ui/surfaces';
import { useMinimumDisplay } from '~/hooks/use-minimum-display';
import {
  type Billing,
  PLAN_PAGE,
  daysLeftLabel,
  shortDate,
  useBilling,
  useCheckout,
  usePortal,
  useSetTemplatePacks,
} from '~/lib/billing';
import { cn } from '~/lib/classname';
import { SALES_EMAIL } from '~/lib/site';

/**
 * Stripe sends someone back from checkout before its webhook has necessarily
 * changed the plan, so the page asks again until it has — for long enough to
 * cover a slow webhook, not so long that a lost one keeps it spinning.
 */
const CONFIRM_POLL_MS = 2_000;
const CONFIRM_TIMEOUT_MS = 40_000;

const count = (n: number) => n.toLocaleString();
const plural = (n: number, one: string) => `${count(n)} ${one}${n === 1 ? '' : 's'}`;
/** Overage is billed a tenth of a cent at a time, which rounds to nothing. */
const approxUsd = (usd: number) => (usd > 0 && usd < 0.01 ? 'under $0.01' : formatUsd(Math.round(usd * 100) / 100));

const ADMIN_ONLY = 'Ask an admin to change the plan.';

type Tone = 'accent' | 'warn' | 'danger';
const FILLS: Record<Tone, string> = { accent: 'bg-accent', warn: 'bg-warn', danger: 'bg-danger' };

function PortalButton({ label, variant = 'secondary' }: { label: string; variant?: 'primary' | 'secondary' }) {
  const portal = usePortal();
  return (
    <Button variant={variant} onClick={() => portal.mutate()} disabled={portal.isPending}>
      {portal.isPending ? <Loader2Icon className="animate-spin" /> : null}
      {label}
    </Button>
  );
}

function PlanSummary({ billing, isAdmin }: { billing: Billing; isAdmin: boolean }) {
  const { plan } = billing;
  const seats = billing.seats ?? 1;
  const packs = billing.templatePacks;

  let badge: React.ReactNode;
  let detail: React.ReactNode;
  let action: React.ReactNode = null;

  switch (plan) {
    case 'trial': {
      const days = billing.trialEndsAt ? trialDaysLeft(billing.trialEndsAt) : 0;
      badge = <Badge tone={days <= TRIAL_WARNING_DAYS ? 'warn' : 'accent'}>{daysLeftLabel(days)}</Badge>;
      detail = (
        <>
          Everything on Team, with live API calls capped at {count(INCLUDED.apiCalls)} a month and no card
          needed.{billing.trialEndsAt ? ` The trial ends on ${shortDate(billing.trialEndsAt)}; ` : ' When it ends, '}
          after that the workspace is read-only until someone subscribes.
        </>
      );
      break;
    }
    case 'lapsed':
      badge = <Badge tone="danger">Editing paused</Badge>;
      detail =
        'This workspace has no plan. Templates, images and keys are all kept and still open, but editing and live API calls are paused until someone subscribes.';
      break;
    case 'team': {
      const pastDue = billing.status === 'past_due';
      badge = pastDue ? (
        <Badge tone="warn">Payment failed</Badge>
      ) : billing.cancelAt ? (
        <Badge tone="warn">Ends {shortDate(billing.cancelAt)}</Badge>
      ) : (
        <Badge tone="success">Active</Badge>
      );
      detail = pastDue
        ? 'Stripe couldn’t take the last payment and will try again. Update the card so the plan doesn’t end.'
        : billing.cancelAt
          ? `The plan ends on ${shortDate(billing.cancelAt)}, and the workspace turns read-only. Resume it any time before then.`
          : `${billing.currentPeriodEnd ? `Renews on ${shortDate(billing.currentPeriodEnd)}. ` : ''}Seats follow your members: someone who joins is billed from that day, prorated.`;
      action = isAdmin ? (
        pastDue ? (
          <PortalButton label="Update card" variant="primary" />
        ) : billing.cancelAt ? (
          <PortalButton label="Resume plan" variant="primary" />
        ) : (
          <PortalButton label="Manage billing" />
        )
      ) : null;
      break;
    }
    case 'enterprise':
      badge = <Badge tone="success">Active</Badge>;
      detail = `Arranged with our team; limits follow your agreement. For changes, email ${SALES_EMAIL}.`;
      action = isAdmin ? <PortalButton label="Manage billing" /> : null;
      break;
  }

  const paid = plan === 'team' || plan === 'enterprise';

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold text-ink">{PLAN_LABELS[plan]}</h2>
            {badge}
          </div>
          {plan === 'team' ? (
            <div>
              <p className="flex items-baseline gap-1">
                <span className="font-display text-2xl font-semibold tabular-nums text-ink">
                  {formatUsd(monthlyUsd(seats, packs))}
                </span>
                <span className="text-sm text-muted">a month</span>
              </p>
              <p className="text-xs tabular-nums text-muted">
                {plural(seats, 'member')} × {formatUsd(PRICES_USD.seat)}
                {packs > 0 ? ` + ${plural(packs, 'template pack')} × ${formatUsd(PRICES_USD.templatePack)}` : ''}
                , plus {formatUsd(PRICES_USD.overagePer1000Calls)} per 1,000 API calls past {count(INCLUDED.apiCalls)}
              </p>
            </div>
          ) : null}
          <p className="max-w-prose text-sm text-muted">{detail}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {paid && !isAdmin ? <p className="mt-3 text-xs text-muted">{ADMIN_ONLY}</p> : null}
    </Card>
  );
}

function PackStepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label="Template packs" className="inline-flex items-center gap-0.5 rounded-md border border-line bg-raised p-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Remove a pack"
        disabled={disabled || value <= 0}
        onClick={() => onChange(value - 1)}
      >
        <MinusIcon />
      </Button>
      <output aria-live="polite" className="w-7 text-center text-sm font-medium tabular-nums text-ink">
        {value}
      </output>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Add a pack"
        disabled={disabled || value >= MAX_TEMPLATE_PACKS}
        onClick={() => onChange(value + 1)}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}

function LineItem({ label, detail, children }: { label: string; detail: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0">
      <div className="min-w-0 flex-1 basis-56">
        <dt className="text-sm font-medium text-ink">{label}</dt>
        <p className="text-xs text-muted">{detail}</p>
      </div>
      <dd className="text-sm tabular-nums text-ink">{children}</dd>
    </div>
  );
}

/** What a trial or read-only workspace sees: Team priced for its own size. */
function SubscribePanel({ billing, isAdmin }: { billing: Billing; isAdmin: boolean }) {
  const { organization } = useOrganization();
  // Checkout bills every member the organization has, which Clerk knows
  // before the server has ever counted.
  const seats = Math.max(1, organization?.membersCount ?? billing.seats ?? 1);
  const [packs, setPacks] = useState(0);
  const checkout = useCheckout();
  const total = monthlyUsd(seats, packs);

  return (
    <Card>
      <h2 className="text-sm font-semibold text-ink">Subscribe to Team</h2>
      <p className="mt-1 text-sm text-muted">
        {billing.plan === 'lapsed'
          ? 'Subscribing makes the workspace editable again straight away, with everything as you left it.'
          : 'Subscribing ends the trial now; your templates, keys and history carry straight over.'}
      </p>

      <dl className="mt-4 divide-y divide-line">
        <LineItem label="Members" detail="Follows your team: someone who joins is billed from that day.">
          {plural(seats, 'member')} × {formatUsd(PRICES_USD.seat)}
        </LineItem>
        <LineItem
          label="Template packs"
          detail={`${TEMPLATE_PACK.templates} more templates each, ${formatUsd(PRICES_USD.templatePack)} a month. Any pack keeps ${TEMPLATE_PACK.versionsPerTemplate} versions of every template instead of ${INCLUDED.versionsPerTemplate}.`}
        >
          {isAdmin ? <PackStepper value={packs} onChange={setPacks} disabled={checkout.isPending} /> : 'Optional'}
        </LineItem>
        <LineItem
          label="API calls"
          detail={`${count(INCLUDED.apiCalls)} a month included. Past that, ${formatUsd(PRICES_USD.overagePer1000Calls)} per 1,000, billed after the month.`}
        >
          Included
        </LineItem>
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div>
          <p className="flex items-baseline gap-1">
            <span className="font-display text-2xl font-semibold tabular-nums text-ink">{formatUsd(total)}</span>
            <span className="text-sm text-muted">a month</span>
          </p>
          <p className="text-xs text-muted">Charged today for the rest of the month, then on the 1st.</p>
        </div>
        {isAdmin ? (
          <Button
            variant="primary"
            onClick={() => checkout.mutate(packs)}
            disabled={checkout.isPending || !billing.billingConfigured}
          >
            {checkout.isPending ? <Loader2Icon className="animate-spin" /> : null}
            Subscribe · {formatUsd(total)}/month
          </Button>
        ) : (
          <p className="text-sm text-muted">Ask an admin to subscribe.</p>
        )}
      </div>
      {isAdmin && !billing.billingConfigured ? (
        <p className="mt-2 text-xs text-muted">Billing isn’t set up on this server, so nothing can be bought here.</p>
      ) : null}
    </Card>
  );
}

function UsageTile({
  label,
  value,
  className,
  children,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className={cn('p-3.5', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm tabular-nums text-ink">{value}</p>
      </div>
      {children}
    </Card>
  );
}

function Meter({
  label,
  used,
  limit,
  format = count,
  limitSuffix = '',
  tone,
  hint,
  className,
}: {
  label: string;
  used: number;
  /** null is no limit: the number shows, the bar does not. */
  limit: number | null;
  format?: (n: number) => string;
  limitSuffix?: string;
  /** Defaults to danger once the limit is reached, accent before it. */
  tone?: Tone;
  hint?: React.ReactNode;
  className?: string;
}) {
  const fill = tone ?? (limit !== null && used >= limit ? 'danger' : 'accent');
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const of = limit === null ? '· no limit' : `of ${format(limit)}${limitSuffix}`;

  return (
    <UsageTile
      label={label}
      className={className}
      value={
        <>
          {format(used)} <span className="text-muted">{of}</span>
        </>
      }
    >
      {limit !== null ? (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          aria-valuetext={`${format(used)} ${of}`}
          className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-hover"
        >
          <div
            className={cn('h-full rounded-full transition-[width] duration-slow ease-out motion-reduce:transition-none', FILLS[fill])}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </UsageTile>
  );
}

function Usage({ billing }: { billing: Billing }) {
  const { plan, usage, limits, overage } = billing;
  const resets = shortDate(billing.resetsOn);
  const included = count(INCLUDED.apiCalls);

  // Team is measured against what the price covers, since nothing stops it
  // there; a trial against where live calls stop.
  const apiLimit = plan === 'team' ? limits.includedApiCalls : limits.maxApiCalls;
  const capped = limits.maxApiCalls !== null && usage.apiCalls >= limits.maxApiCalls;
  let apiTone: Tone = 'accent';
  let apiHint: string;
  switch (plan) {
    case 'lapsed':
      apiTone = capped ? 'danger' : 'accent';
      apiHint = 'Live calls are paused while the workspace is read-only. Test keys still work.';
      break;
    case 'trial':
      apiTone = capped ? 'danger' : usage.apiCalls >= INCLUDED.apiCalls * 0.8 ? 'warn' : 'accent';
      apiHint = capped
        ? `Live calls are paused until ${resets}. On Team, calls past ${included} are billed instead of refused.`
        : `A trial stops live calls at ${included}. Resets ${resets}.`;
      break;
    case 'team':
      apiTone = overage.calls > 0 ? 'warn' : 'accent';
      apiHint =
        overage.calls > 0
          ? `${plural(overage.calls, 'call')} over · about ${approxUsd(overage.usd)} so far, billed on your next invoice. Resets ${resets}.`
          : `Past ${included}, calls cost ${formatUsd(PRICES_USD.overagePer1000Calls)} per 1,000. Resets ${resets}.`;
      break;
    case 'enterprise':
      apiHint = `Resets ${resets}.`;
      break;
  }

  const packs = billing.templatePacks;
  const templatesHint =
    plan === 'team'
      ? packs > 0
        ? `${INCLUDED.templates} included + ${packs * TEMPLATE_PACK.templates} from ${plural(packs, 'pack')}.`
        : `Add a template pack for ${TEMPLATE_PACK.templates} more.`
      : plan === 'enterprise'
        ? undefined
        : `Subscribe to add packs of ${TEMPLATE_PACK.templates} more.`;

  const storageLimit = limits.maxStorageBytes;
  const storageTone: Tone | undefined =
    storageLimit !== null && usage.storageBytes < storageLimit && usage.storageBytes >= storageLimit * 0.9 ? 'warn' : undefined;

  return (
    <section aria-labelledby="usage-heading" className="space-y-2.5">
      <h2 id="usage-heading" className="text-sm font-semibold text-ink">
        Usage
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Meter
          className="sm:col-span-2"
          label="Live API calls this month"
          used={usage.apiCalls}
          limit={apiLimit}
          limitSuffix={plan === 'team' ? ' included' : ''}
          tone={apiTone}
          hint={apiHint}
        />
        <Meter label="Templates" used={usage.templates} limit={limits.maxTemplates} hint={templatesHint} />
        <UsageTile
          label="Versions kept"
          value={limits.maxVersions === null ? 'No limit' : `${count(limits.maxVersions)} per template`}
        >
          <p className="mt-2 text-xs text-muted">
            The oldest goes when a publish passes it.
            {plan !== 'enterprise' && limits.maxVersions !== TEMPLATE_PACK.versionsPerTemplate
              ? ` ${TEMPLATE_PACK.versionsPerTemplate} with any template pack.`
              : ''}
          </p>
        </UsageTile>
        <Meter label="Live API keys" used={usage.apiKeys} limit={limits.maxApiKeys} hint="Test keys don’t count." />
        <Meter
          label="Image storage"
          used={usage.storageBytes}
          limit={storageLimit}
          format={formatBytes}
          tone={storageTone}
          hint={plan === 'trial' || plan === 'lapsed' ? 'Team has 1 GB.' : undefined}
        />
      </div>
    </section>
  );
}

/** Team's packs, changed in place: Stripe prorates from today. */
function TemplatePacks({ billing, isAdmin }: { billing: Billing; isAdmin: boolean }) {
  const current = billing.templatePacks;
  const [draft, setDraft] = useState(current);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const setPacks = useSetTemplatePacks();

  // The server's answer is the truth; a saved or refused change resets the draft to it.
  useEffect(() => setDraft(current), [current]);

  const allows = INCLUDED.templates + draft * TEMPLATE_PACK.templates;
  const toDelete = billing.usage.templates - allows;
  const seats = billing.seats ?? 1;
  const save = () => setPacks.mutate(draft);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="text-sm font-semibold text-ink">Template packs</h2>
          <p className="mt-1 text-sm text-muted">
            Each pack adds {TEMPLATE_PACK.templates} templates for {formatUsd(PRICES_USD.templatePack)} a month. Any
            pack keeps {TEMPLATE_PACK.versionsPerTemplate} versions of every template instead of{' '}
            {INCLUDED.versionsPerTemplate}.
          </p>
        </div>
        {isAdmin ? (
          <PackStepper value={draft} onChange={setDraft} disabled={setPacks.isPending} />
        ) : (
          <p className="text-sm tabular-nums text-ink">{plural(current, 'pack')}</p>
        )}
      </div>

      <Reveal open={isAdmin && draft !== current}>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          {toDelete > 0 ? (
            <p className="text-sm text-danger-ink">
              You have {plural(billing.usage.templates, 'template')} and {plural(draft, 'pack')} allow {allows}.
              Delete {plural(toDelete, 'template')} first.
            </p>
          ) : (
            <p className="text-sm text-muted">
              {allows} templates ·{' '}
              <span className="tabular-nums text-ink">
                {formatUsd(monthlyUsd(seats, current))} → {formatUsd(monthlyUsd(seats, draft))}
              </span>{' '}
              a month, prorated from today.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(current)} disabled={setPacks.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={toDelete > 0 || setPacks.isPending}
              onClick={() => (current > 0 && draft === 0 ? setConfirmOpen(true) : save())}
            >
              {setPacks.isPending ? <Loader2Icon className="animate-spin" /> : null}
              Update packs
            </Button>
          </div>
        </div>
      </Reveal>

      {!isAdmin ? <p className="mt-3 text-xs text-muted">{ADMIN_ONLY}</p> : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove all template packs?"
        description={`Templates go back to ${INCLUDED.templates}, and each keeps its latest ${INCLUDED.versionsPerTemplate} versions — older ones are deleted the next time it’s published.`}
        confirmLabel="Remove packs"
        confirmVariant="danger"
        onConfirm={save}
      />
    </Card>
  );
}

function CachingTip() {
  return (
    <Card className="flex gap-3">
      <ZapIcon className="mt-0.5 size-4 shrink-0 text-accent-ink" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-ink">Cache renders to make fewer calls</p>
        <p className="text-sm text-muted">
          Every live call counts, repeats included. Render a broadcast once and send the same HTML to everyone, and
          keep renders under the template’s <code className="font-mono text-xs">updatedAt</code> — it only moves when
          someone publishes.
        </p>
        <Link
          href="/docs#caching"
          className="inline-block text-sm font-medium text-accent-ink underline-offset-4 hover:underline"
        >
          How to cache renders
        </Link>
      </div>
    </Card>
  );
}

function EnterpriseCard() {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-sm font-medium text-ink">Enterprise</p>
        <p className="mt-0.5 text-sm text-muted">
          Unlimited templates, keys and API calls, with 100 versions per template. Priced with you.
        </p>
      </div>
      {/* Enterprise is arranged by hand, never through checkout — whatever
          plan the reader is on, the way in is a conversation. */}
      <Button asChild>
        <a href={`mailto:${SALES_EMAIL}?subject=Temply%20Enterprise`}>Contact sales</a>
      </Button>
    </Card>
  );
}

function PlanContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(() => searchParams.get('success') === 'true');

  const { data, isLoading, isError, refetch } = useBilling({
    refetchInterval: confirming ? CONFIRM_POLL_MS : false,
  });
  const showLoading = useMinimumDisplay(isLoading);
  const { orgRole } = useAuth();
  const isAdmin = orgRole === 'org:admin';
  const plan = data?.plan;

  useEffect(() => {
    if (!confirming || !plan) return;
    if (plan === 'team' || plan === 'enterprise') {
      setConfirming(false);
      toast.success(`You’re on ${PLAN_LABELS[plan]}`);
      void queryClient.invalidateQueries({ queryKey: ['quota'] });
      router.replace(PLAN_PAGE, { scroll: false });
      return;
    }
    const timer = setTimeout(() => {
      setConfirming(false);
      toast('Checkout is complete', {
        description: 'Stripe hasn’t confirmed it to us yet. Your plan will change here within a few minutes.',
      });
      router.replace(PLAN_PAGE, { scroll: false });
    }, CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [confirming, plan, queryClient, router]);

  if (showLoading) {
    return <PageLoading label="Loading your plan…" />;
  }

  // A failed query must not fall through to a default plan: showing a paying
  // customer their account as a trial is worse than showing them nothing,
  // because it reads as a billing fault rather than a display one.
  if (isError || !data) {
    return (
      <ErrorState
        description="We could not load your plan. Nothing has changed on your account — this is only a display problem."
        onRetry={() => refetch()}
      />
    );
  }

  const needsPlan = data.plan === 'trial' || data.plan === 'lapsed';

  return (
    <div className="space-y-5">
      <div>
        <Reveal open={confirming}>
          <div className="pb-5">
            <Card className="flex items-center gap-3" role="status">
              <Loader2Icon className="size-4 shrink-0 animate-spin text-accent-ink" aria-hidden />
              <p className="text-sm text-ink">Confirming your subscription with Stripe…</p>
            </Card>
          </div>
        </Reveal>
        <PlanSummary billing={data} isAdmin={isAdmin} />
        <Reveal open={needsPlan && !confirming}>
          <div className="pt-5">
            <SubscribePanel billing={data} isAdmin={isAdmin} />
          </div>
        </Reveal>
      </div>

      <Usage billing={data} />

      {data.plan === 'team' ? <TemplatePacks billing={data} isAdmin={isAdmin} /> : null}
      {data.plan !== 'enterprise' ? <CachingTip /> : null}
      {data.plan !== 'enterprise' ? <EnterpriseCard /> : null}
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
