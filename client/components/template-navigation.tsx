'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeftIcon, BracesIcon, HistoryIcon, PencilLineIcon, PlugIcon, ShieldCheckIcon } from 'lucide-react';
import { cn } from '~/lib/classname';

const sections = [
  { path: '', label: 'Edit email', icon: PencilLineIcon },
  { path: '/variables', label: 'Variables', icon: BracesIcon },
  { path: '/versions', label: 'Versions', icon: HistoryIcon },
  { path: '/review', label: 'Review & release', icon: ShieldCheckIcon },
  { path: '/connect', label: 'Connect your app', icon: PlugIcon },
];

export function TemplateNavigation({ id, title, beforeNavigate }: {
  id: string; title: string; beforeNavigate?: () => Promise<boolean>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const go = async (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!beforeNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (await beforeNavigate()) router.push(href);
  };
  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/dashboard/templates" onClick={(event) => void go(event, '/dashboard/templates')}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeftIcon className="size-4" /> All templates
        </Link>
        <span aria-hidden className="text-muted">/</span>
        <h1 className="min-w-0 break-words font-display text-xl font-semibold text-ink">{title || 'Your email'}</h1>
      </div>
      <nav aria-label="Template" className="flex gap-1 overflow-x-auto border-b border-line pb-2">
        {sections.map(({ path, label, icon: Icon }) => {
          const href = `/templates/${id}${path}`;
          return <Link key={path} href={href} onClick={(event) => void go(event, href)}
            aria-current={pathname === href ? 'page' : undefined}
            className={cn('flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition-colors motion-reduce:transition-none',
              pathname === href ? 'bg-accent-wash font-medium text-accent-ink' : 'text-muted hover:bg-hover hover:text-ink')}>
            <Icon className="size-4" />{label}
          </Link>;
        })}
      </nav>
    </header>
  );
}
