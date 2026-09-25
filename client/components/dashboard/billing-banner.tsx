'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClockIcon, Loader2Icon, LockIcon, XIcon } from 'lucide-react';
import { TRIAL_WARNING_DAYS, trialDaysLeft } from '@temply/shared/plans';
import { Button } from '~/components/ui/button';
import { Reveal } from '~/components/ui/surfaces';
import { PLAN_PAGE, shortDate, useBilling, usePortal } from '~/lib/billing';
import { cn } from '~/lib/classname';

/**
 * A billing state worth knowing from anywhere. Danger is for what already
 * blocks work (read-only); warn is for what will unless someone acts. The
 * colour is a stripe and an icon, never the text: warn is a fill.
 */
export function BillingNotice({
  tone,
  title,
  detail,
  action,
  onDismiss,
}: {
  tone: 'warn' | 'danger';
  title: string;
  detail: string;
  action?: React.ReactNode;
  onDismiss?: () => void;
}) {
  const Icon = tone === 'danger' ? LockIcon : ClockIcon;
  return (
    <div
      role="status"
      className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-lg border border-line bg-raised py-3 pl-4 pr-3 shadow-sm"
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', tone === 'danger' ? 'bg-danger' : 'bg-warn')} />
      <div className="flex min-w-0 flex-1 basis-64 items-start gap-2.5">
        <Icon
          aria-hidden
          className={cn('mt-0.5 size-4 shrink-0', tone === 'danger' ? 'text-danger-ink' : 'text-warn-ink')}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{title}</p>
          <p className="mt-0.5 text-sm text-muted">{detail}</p>
        </div>
      </div>
      {action || onDismiss ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {action}
          {onDismiss ? (
            <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={onDismiss}>
              <XIcon />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SubscribeLink() {
  return (
    <Button variant="primary" size="sm" asChild>
      <Link href={PLAN_PAGE}>Subscribe</Link>
    </Button>
  );
}

/** What a workspace without a plan says, on the dashboard and in the editor
 *  alike. Only rendered inside the app, where Clerk is mounted — the editor
 *  layout it sits in also serves the signed-out playground, which has none. */
export function ReadOnlyNotice() {
  const isAdmin = useAuth().orgRole === 'org:admin';
  return (
    <BillingNotice
      tone="danger"
      title="This workspace is read-only"
      detail={`Everything is kept and still opens, but editing and live API calls are paused until ${
        isAdmin ? 'you subscribe' : 'an admin subscribes on the Plan page'
      }.`}
      action={isAdmin ? <SubscribeLink /> : null}
    />
  );
}

function UpdateCardButton() {
  const portal = usePortal();
  return (
    <Button variant="primary" size="sm" onClick={() => portal.mutate()} disabled={portal.isPending}>
      {portal.isPending ? <Loader2Icon className="animate-spin" /> : null}
      Update card
    </Button>
  );
}

const dismissalKey = (orgId: string, stage: string) => `temply:trial-banner:${orgId}:${stage}`;

// Storage can be missing or refuse (private windows, blocked site data); a
// banner that can't remember being dismissed just shows again.
function readDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function writeDismissed(key: string) {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // Dismissed for this visit only.
  }
}

/**
 * The dashboard-wide banner: read-only, a failed payment, or a trial about
 * to end. The plan page says all of this at length, so the banner stays off
 * it. A trial's warning can be dismissed once at three days and once more at
 * the last day; the other two stay until they are resolved.
 */
export function BillingBanner() {
  const pathname = usePathname();
  const { orgRole, orgId } = useAuth();
  const isAdmin = orgRole === 'org:admin';
  const { data } = useBilling();
  // Which dismissible key has been checked against storage, and its answer.
  // Until the check runs the warning isn't drawn, so a dismissed one never
  // flashes open on load.
  const [dismissal, setDismissal] = useState<{ key: string; dismissed: boolean } | null>(null);

  const days = data?.plan === 'trial' && data.trialEndsAt ? trialDaysLeft(data.trialEndsAt) : null;
  const trialKey =
    days !== null && days <= TRIAL_WARNING_DAYS && orgId ? dismissalKey(orgId, days <= 1 ? '1' : '3') : null;

  useEffect(() => {
    if (trialKey) setDismissal({ key: trialKey, dismissed: readDismissed(trialKey) });
  }, [trialKey]);

  let notice: React.ReactNode = null;
  // A dismissed warning stays drawn while it closes, so it slides away
  // rather than vanishing.
  let dismissed = false;
  if (data?.plan === 'lapsed') {
    notice = <ReadOnlyNotice />;
  } else if (data?.plan === 'team' && data.status === 'past_due' && isAdmin) {
    notice = (
      <BillingNotice
        tone="warn"
        title="The last payment failed"
        detail="Stripe will try the card again. Update it so the plan doesn’t end and the workspace stays editable."
        action={<UpdateCardButton />}
      />
    );
  } else if (trialKey && days !== null && data?.trialEndsAt && dismissal?.key === trialKey) {
    dismissed = dismissal.dismissed;
    notice = (
      <BillingNotice
        tone="warn"
        title={days === 0 ? 'Your trial ends today' : `Your trial ends in ${days} day${days === 1 ? '' : 's'}`}
        detail={`From ${shortDate(data.trialEndsAt)} the workspace is read-only until someone subscribes. Nothing is deleted.${
          isAdmin ? '' : ' Ask an admin to subscribe.'
        }`}
        action={isAdmin ? <SubscribeLink /> : null}
        onDismiss={() => {
          writeDismissed(trialKey);
          setDismissal({ key: trialKey, dismissed: true });
        }}
      />
    );
  }

  const open = notice !== null && !dismissed && pathname !== PLAN_PAGE;

  return (
    <Reveal open={open}>
      <div className="pb-5">{notice}</div>
    </Reveal>
  );
}
