'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PageHeader } from '~/components/ui/surfaces';
import { pressable } from '~/components/ui/button';
import { cn } from '~/lib/classname';

/** Plan and API keys are leaves; Account owns the section root and every
 *  path under it that is not one of theirs — Clerk's own Security tab and
 *  its sub-pages live there. */

/** A path is the tab's own, or one of the pages Clerk routes beneath it. */
const isUnder = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);
const TABS = [
  { href: '/dashboard/settings', label: 'Account', adminOnly: false },
  { href: '/dashboard/settings/team', label: 'Team', adminOnly: false },
  { href: '/dashboard/settings/plan', label: 'Plan', adminOnly: true },
  { href: '/dashboard/settings/api-keys', label: 'API keys', adminOnly: true },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Admin manages the account: plan and keys are theirs. A member still has
  // an Account and a Team to look at.
  const { orgRole } = useAuth();
  const isAdmin = orgRole === 'org:admin';
  const tabs = TABS.filter((tab) => isAdmin || !tab.adminOnly);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description={isAdmin ? 'Your account, team, plan and API access.' : 'Your account and your team.'}
      />

      <nav className="flex gap-5 border-b border-line" aria-label="Settings">
        {tabs.map((tab) => {
          // Clerk routes its own pages as sub-paths of the tab that embeds
          // it — Members and Invitations under Team, Security under Account
          // — so a tab owns its path and everything below it. Matching Team
          // exactly left every Clerk page under it with no current tab at
          // all, since Account's catch-all rule stands down there too.
          const isActive =
            tab.href === '/dashboard/settings'
              ? pathname === tab.href ||
                (pathname.startsWith('/dashboard/settings/') &&
                  !TABS.some((other) => other.href !== tab.href && isUnder(pathname, other.href)))
              : isUnder(pathname, tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                // The active line is a pseudo-element, not a bottom border:
                // a border follows the tab's corners and the press scale, and
                // it sat a pixel above the rail. This one is square and lies
                // on the rail itself.
                'relative flex h-9 items-center px-1 text-sm',
                pressable,
                isActive
                  ? 'font-medium text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-accent'
                  : 'text-muted hover:text-ink',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
