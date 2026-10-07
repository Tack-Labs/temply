'use client';

import {
  ArrowUpRightIcon,
  BookOpenIcon,
  FileTextIcon,
  HomeIcon,
  ImageIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  PlugIcon,
  SettingsIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { pressable } from '~/components/ui/button';
import { cn } from '~/lib/classname';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Overview would otherwise light up for every page beneath /dashboard. */
  exact?: boolean;
  /** Leaves the dashboard, so it opens in a new tab rather than risk
   *  discarding unsaved editor work. */
  external?: boolean;
};

type NavSection = {
  label?: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboardIcon, exact: true },
      { href: '/dashboard/templates', label: 'Templates', icon: FileTextIcon },
      { href: '/dashboard/brands', label: 'Brands', icon: PaletteIcon },
      { href: '/dashboard/assets', label: 'Assets', icon: ImageIcon },
      { href: '/dashboard/connect', label: 'Connect your app', icon: PlugIcon },
    ],
  },
  {
    label: 'Resources',
    items: [
      { href: '/', label: 'Landing', icon: HomeIcon, external: true },
      { href: '/docs', label: 'Documentation', icon: BookOpenIcon, external: true },
    ],
  },
];

/**
 * The shape of one row in the sidebar, for the nav and for the Settings row in
 * its foot, so a row is the same row wherever it sits. It is 44px tall for
 * every pointer, which is also the touch target, so there is no coarse step to
 * keep in line.
 */
export function navRow(active: boolean) {
  return cn(
    'flex h-11 items-center gap-3 rounded-field px-3.5 text-ui',
    pressable,
    active ? 'bg-accent-wash font-bold text-accent-ink' : 'font-semibold text-muted hover:bg-hover hover:text-ink',
  );
}

/** Settings is the account's, not a section of the workspace, so it lives in
 *  the sidebar's foot beside the theme toggle rather than in the nav list.
 *  Every page under /dashboard/settings lights it, as Templates lights for a
 *  single template. */
export function SettingsLink({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const pathname = usePathname();
  const isActive = pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/');
  return (
    <Link
      href="/dashboard/settings"
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(navRow(isActive), className)}
    >
      <SettingsIcon aria-hidden className="size-5 shrink-0" />
      Settings
    </Link>
  );
}

/** Shared by the fixed sidebar and the narrow-viewport drawer, so the two can
 *  never drift apart. */
export function NavLinks({ onNavigate, platformAdmin = false }: { onNavigate?: () => void; platformAdmin?: boolean }) {
  const pathname = usePathname();
  const sections: NavSection[] = platformAdmin
    ? [...NAV_SECTIONS, { label: 'Temply', items: [{ href: '/dashboard/admin', label: 'Admin', icon: ShieldCheckIcon }] }]
    : NAV_SECTIONS;

  return (
    <nav aria-label="Dashboard">
      {sections.map((section, index) => (
        <div key={section.label ?? index}>
          {section.label ? (
            <div className="px-3.5 pt-6 pb-1.5 text-sm font-semibold text-muted">{section.label}</div>
          ) : null}
          <div className="flex flex-col gap-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.external
                ? false
                : item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                  className={navRow(isActive)}
                >
                  <Icon aria-hidden className="size-5 shrink-0" />
                  {item.label}
                  {item.external ? <ArrowUpRightIcon aria-hidden className="ml-auto size-4 shrink-0" /> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
