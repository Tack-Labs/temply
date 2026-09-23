'use client';

import {
  ArrowUpRightIcon,
  BookOpenIcon,
  FileTextIcon,
  HomeIcon,
  ImageIcon,
  LayoutDashboardIcon,
  PaletteIcon,
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

/** Shared by the fixed sidebar and the narrow-viewport drawer, so the two can
 *  never drift apart. */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard">
      {NAV_SECTIONS.map((section, index) => (
        <div key={section.label ?? index}>
          {section.label ? (
            <div className="px-2.5 pt-4 pb-1 text-2xs font-medium tracking-wide text-rail-muted uppercase">
              {section.label}
            </div>
          ) : null}
          <div className="flex flex-col gap-0.5">
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
                  className={cn(
                    'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm',
                    pressable,
                    isActive
                      ? 'bg-rail-active-bg font-medium text-rail-active-ink'
                      : 'text-rail-muted hover:bg-rail-hover hover:text-rail-ink',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                  {item.external ? (
                    <ArrowUpRightIcon className="ml-auto size-3 shrink-0 opacity-60" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
