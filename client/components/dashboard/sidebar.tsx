'use client';

import { OrganizationSwitcher } from '@clerk/nextjs';
import Link from 'next/link';
import { BrandMark } from '~/components/brand-mark';
import { useTheme } from '~/components/theme-provider';
import { NavLinks } from './nav-items';
import { QuotaWidget } from './quota-widget';
import { UserMenu } from './user-menu';

/** Clerk's switcher on the rail. A person can belong to several
 *  organizations — a client's, say — and the active one is the scope of
 *  everything below it. Personal accounts are hidden: every account is an
 *  organization here. */
export function WorkspaceSwitcher() {
  const { clerkAppearance } = useTheme();
  return (
    <OrganizationSwitcher
      hidePersonal
      afterCreateOrganizationUrl="/onboarding/invite"
      afterSelectOrganizationUrl="/dashboard"
      afterLeaveOrganizationUrl="/onboarding"
      organizationProfileMode="navigation"
      organizationProfileUrl="/dashboard/settings/team"
      appearance={{
        ...clerkAppearance,
        elements: {
          ...(clerkAppearance.elements as Record<string, string>),
          rootBox: 'w-full',
          // Layout only. The trigger's colours and its padding are pinned to
          // the rail in globals.css, where they can outrank Clerk's own
          // stylesheet; a padding class here loses to it.
          organizationSwitcherTrigger:
            'w-full justify-between rounded-md hover:bg-rail-hover focus-visible:ring-[3px] focus-visible:ring-accent/25',
        },
      }}
    />
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="flex h-full flex-col bg-rail-bg text-rail-ink">
      {/* 20px gutter: the same line the nav icons and the workspace avatar
          sit on, so the mark, the avatar and the icons share one left edge. */}
      <div className="flex h-12 items-center gap-2 border-b border-rail-line px-5">
        <BrandMark className="size-4.5 text-rail-active-ink" />
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="font-display text-base font-semibold tracking-tight text-rail-ink"
        >
          Temply
        </Link>
      </div>

      <div className="border-b border-rail-line p-2.5">
        <WorkspaceSwitcher />
      </div>

      <div className="flex-1 overflow-y-auto p-2.5">
        <NavLinks onNavigate={onNavigate} />
      </div>

      <div className="space-y-2 border-t border-rail-line p-2.5">
        <QuotaWidget />
        <UserMenu align="start" />
      </div>
    </aside>
  );
}
