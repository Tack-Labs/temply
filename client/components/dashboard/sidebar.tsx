'use client';

import { OrganizationSwitcher } from '@clerk/nextjs';
import Link from 'next/link';
import { BrandMark } from '~/components/brand-mark';
import { useTheme } from '~/components/theme-provider';
import { NavLinks } from './nav-items';
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
 * The navigation column, on the page's own surface so it follows the theme
 * like everything else in the app. `headerAction` is for the drawer, which
 * borrows this whole column and adds a way to close it.
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
    <aside aria-label="Workspace" className="flex h-full flex-col border-r border-line bg-surface text-ink">
      {/* The brand link's 10px inset plus the nav links' own put the mark on
          the line the nav icons and the workspace avatar sit on. A coarse
          pointer's 44px targets get a 56px strip: the global focus ring
          reaches 4px past a control, and in 48px it would be cut at the top
          edge. The bar beside the sidebar in the dashboard layout grows with
          it, so the line under the two stays one line. */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-line px-2.5 pointer-coarse:h-14">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex h-9 items-center gap-2 rounded-md px-2.5 font-display text-base font-semibold tracking-display text-ink pointer-coarse:h-11"
        >
          <BrandMark className="size-4.5 text-accent-ink" />
          Temply
        </Link>
        {headerAction}
      </div>

      <div className="px-2.5 pt-2.5">
        <WorkspaceSwitcher />
      </div>

      {/* The first and last links sit a full padding inside the scroll box, so
          their focus outlines are not clipped by it. */}
      <div className="flex-1 overflow-y-auto p-2.5">
        <NavLinks onNavigate={onNavigate} platformAdmin={platformAdmin} />
      </div>

      <div className="space-y-2 border-t border-line p-2.5">
        <QuotaWidget />
        <UserMenu align="start" />
      </div>
    </aside>
  );
}
