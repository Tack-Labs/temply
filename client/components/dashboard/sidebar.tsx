'use client';

import { OrganizationSwitcher } from '@clerk/nextjs';
import Link from 'next/link';
import { BrandMark } from '~/components/brand-mark';
import { useTheme } from '~/components/theme-provider';
import { ThemeToggle } from '~/components/theme-toggle';
import { pressable } from '~/components/ui/button';
import { cn } from '~/lib/classname';
import { NavLinks, SettingsLink } from './nav-items';
import { QuotaWidget } from './quota-widget';
import { UserMenu } from './user-menu';

/** Clerk's switcher at the head of the sidebar. A person can belong to
 *  several organizations — a client's, say — and the active one is the scope
 *  of everything below it. Personal accounts are hidden: every account is an
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
          ...(clerkAppearance.elements as Record<string, unknown>),
          rootBox: 'w-full',
          // Layout only. The trigger's colours, its card, its padding and its
          // focus outline are pinned in globals.css, where they can outrank
          // Clerk's own stylesheet; a class here loses to it.
          organizationSwitcherTrigger: 'w-full justify-between',
        },
      }}
    />
  );
}

/**
 * The navigation column: white, so it reads as a surface laid on the page
 * rather than a part of it, and 248px wide wherever it is (the layout's rail
 * and the drawer both give it that). `headerAction` is for the drawer, which
 * borrows this whole column and adds a way to close it.
 *
 * Height is shared out so the foot is always whole: the nav scrolls on its
 * own down to 160px, and below that, a phone on its side, the column scrolls
 * as one rather than cut the user block off the bottom.
 */
export function Sidebar({
  onNavigate,
  headerAction,
  platformAdmin = false,
}: {
  onNavigate?: () => void;
  headerAction?: React.ReactNode;
  platformAdmin?: boolean;
}) {
  return (
    <aside
      aria-label="Workspace"
      className="flex h-full flex-col gap-7 overflow-y-auto border-r-[1.5px] border-line bg-raised px-4 py-6 text-ink"
    >
      <div className="flex shrink-0 flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          {/* 8px in from the column's padding puts the mark on the line the
              user block's avatar sits on, and the 44px row is the target. */}
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className={cn(
              'flex h-11 items-center gap-2.5 rounded-field px-2 font-display text-2xl font-bold tracking-display text-ink',
              pressable,
            )}
          >
            <BrandMark className="size-6.5 shrink-0 text-accent" />
            Temply
          </Link>
          {headerAction}
        </div>
        <WorkspaceSwitcher />
      </div>

      {/* The scroll box reaches 8px past the nav on each side and pads itself
          back, so the rows' focus outlines, which stand 5px off the edge,
          are not clipped by it. */}
      <div className="-mx-2 -my-1.5 min-h-40 flex-1 overflow-y-auto px-2 py-1.5">
        <NavLinks onNavigate={onNavigate} platformAdmin={platformAdmin} />
      </div>

      <div className="flex shrink-0 flex-col gap-3">
        <QuotaWidget />
        <div className="flex items-center gap-1">
          <SettingsLink onNavigate={onNavigate} className="min-w-0 flex-1" />
          <ThemeToggle />
        </div>
        <div className="border-t-[1.5px] border-line pt-4">
          <UserMenu align="start" />
        </div>
      </div>
    </aside>
  );
}
