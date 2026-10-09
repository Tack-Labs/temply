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

      {/* The same tab row as a template's sections: a bold tab on a 3px
          violet underline, over a 1.5px rule. */}
      <nav className="-mx-2 flex max-w-full gap-1.5 overflow-x-auto border-b-[1.5px] border-line px-2" aria-label="Settings">
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
                'relative inline-flex h-12 shrink-0 items-center rounded-field px-3.5 text-lg',
                pressable,
                isActive ? 'font-bold text-ink' : 'font-semibold text-muted hover:text-ink',
              )}
            >
              {tab.label}
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="fade-in-mount absolute inset-x-3.5 bottom-0 h-[3px] rounded-t-[3px] bg-accent motion-reduce:transition-none"
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
