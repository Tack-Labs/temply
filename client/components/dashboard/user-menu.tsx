'use client';

import { useClerk, useOrganization, useUser } from '@clerk/nextjs';
import { LogOutIcon, ScrollTextIcon, SettingsIcon, ShieldIcon } from 'lucide-react';
import Link from 'next/link';
import { pressable } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Skeleton } from '~/components/ui/skeleton';
import { cn } from '~/lib/classname';

/** The user block's shape while Clerk answers: the avatar and two lines. */
function UserMenuSkeleton() {
  return (
    <div aria-hidden className="flex items-center gap-3 px-2 py-1.5">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

type UserMenuProps = {
  align?: 'start' | 'end' | 'center';
  showLabel?: boolean;
};

export function UserMenu({ align = 'end', showLabel = true }: UserMenuProps) {
  const { user, isSignedIn, isLoaded } = useUser();
  const { organization } = useOrganization();
  const { signOut } = useClerk();

  // The labelled block is the sidebar's foot and holds its place while Clerk
  // answers, so the column does not jump when the account arrives. The icon
  // button sits in a header with room to spare and simply waits.
  if (!isLoaded) return showLabel ? <UserMenuSkeleton /> : null;
  if (!isSignedIn) return null;

  const initials = user?.firstName?.[0]?.toUpperCase() ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? 'U';
  const email = user?.emailAddresses?.[0]?.emailAddress ?? '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* With the label the trigger is the sidebar's user block: the avatar,
            the name, and under it the workspace the person is acting in (the
            address when there is none). Without it the trigger is a plain
            icon button. Either way it is named for what it opens, and with
            the label also for whom: the visible name has to be in the
            accessible name (WCAG 2.5.3), and a reader of the sidebar learns
            who is signed in without opening the menu. An initial alone is no
            name; the second line stays out of the name in both, which the
            menu repeats. */}
        <button
          type="button"
          aria-label={showLabel ? `Account: ${user?.fullName ?? 'User'}` : 'Account'}
          className={cn(
            'flex w-full items-center gap-3 text-ui text-ink hover:bg-hover pointer-coarse:min-h-11',
            showLabel ? 'rounded-field px-2 py-1.5' : 'rounded-full p-1.5 pointer-coarse:min-w-11',
            pressable,
          )}
        >
          {/* Peach is the avatar's pair in both themes: the wash is a tint of
              the hue and the ink sits on it at the gated contrast. */}
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-full bg-peach-wash font-bold text-peach-ink',
              showLabel ? 'size-10 text-ui' : 'size-7 text-xs',
            )}
          >
            {initials}
          </span>
          {showLabel && (
            <span className="flex min-w-0 flex-col items-start text-left leading-tight">
              <span className="w-full truncate text-ui font-bold">{user?.fullName ?? 'User'}</span>
              <span className="w-full truncate text-base font-normal text-muted">{organization?.name ?? email}</span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="font-medium text-ink">{user?.fullName ?? 'User'}</span>
            <span className="text-xs font-normal text-muted">{email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Navigation lives in the sidebar; this menu is about the account. */}
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings" className="flex cursor-pointer items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        {/* The one place inside the app the legal pages are reachable from:
            two quiet items, not a footer on every page. Consent itself is
            taken at sign-up; these are for reading it again, in a new tab so
            the work on screen stays where it is. */}
        <DropdownMenuItem asChild>
          <Link href="/terms" target="_blank" rel="noreferrer" className="flex cursor-pointer items-center gap-2 text-muted">
            <ScrollTextIcon className="h-4 w-4" />
            Terms
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/privacy" target="_blank" rel="noreferrer" className="flex cursor-pointer items-center gap-2 text-muted">
            <ShieldIcon className="h-4 w-4" />
            Privacy
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ redirectUrl: '/' })}>
          <LogOutIcon className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
