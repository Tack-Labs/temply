'use client';

import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '~/components/theme-toggle';
import { UserMenu } from '~/components/dashboard/user-menu';

/**
 * The editor's page header: where this is, and the way back to the list.
 * The template's own name is edited in the Email details card below, so the
 * trail ends at the page rather than echoing a title that changes under it.
 * It is only drawn from `sm` up — the phone shell has its own header — so
 * the link only has to answer a coarse pointer on a tablet, and the 48px bar
 * has room for the 44px target that gives it.
 */
export function EditorHeader() {
  const pathname = usePathname();
  const section = pathname.endsWith('/variables') ? 'Variables' : pathname.endsWith('/versions') ? 'Versions'
    : pathname.endsWith('/connect') ? 'Connect your app' : pathname.endsWith('/review') ? 'Review & release' : 'Editor';
  return (
    <header className="flex h-12 items-center justify-between border-b border-line bg-raised px-4">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center text-sm">
          <li>
            <Link
              href="/dashboard/templates"
              className="-ml-2 flex h-8 items-center rounded-md px-2 font-medium text-muted transition-colors duration-fast ease-out hover:bg-hover hover:text-ink pointer-coarse:h-11 motion-reduce:transition-none"
            >
              Templates
            </Link>
          </li>
          <li aria-hidden className="mx-0.5 flex">
            <ChevronRightIcon className="size-3.5 text-faint" />
          </li>
          <li>
            <span aria-current="page" className="px-2 font-medium text-ink">
              {section}
            </span>
          </li>
        </ol>
      </nav>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu align="end" showLabel={false} />
      </div>
    </header>
  );
}
