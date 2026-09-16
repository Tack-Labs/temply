'use client';

import { useClerk, useUser } from '@clerk/nextjs';
import { LogOutIcon, ScrollTextIcon, SettingsIcon, ShieldIcon } from 'lucide-react';
import Link from 'next/link';
import { pressable } from '~/components/ui/button';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

type UserMenuProps = {
  align?: 'start' | 'end' | 'center';
  showLabel?: boolean;
  /** Which background the trigger sits on. The dashboard rail is graphite in
   *  both themes, so it needs the rail palette; the marketing header sits on
   *  the page surface and must follow the theme instead — rail colours there
   *  meant a dark hover blotch in light mode. */
  surface?: 'rail' | 'page';
};

export function UserMenu({ align = 'end', showLabel = true, surface = 'rail' }: UserMenuProps) {
  const { user, isSignedIn, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  if (!isLoaded) return null;
  if (!isSignedIn) return null;

  const initials = user?.firstName?.[0]?.toUpperCase() ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* With the label the trigger is a rail row: the avatar sits on the
            same 20px line as the nav icons and the workspace avatar above.
            Without it the trigger is a plain icon button. Either way it is
            named for what it opens: an initial alone is no name, and the
            name and address are whose account, which the menu repeats. */}
        <button
          type="button"
          aria-label="Account"
          className={`flex w-full items-center gap-2 rounded-md text-sm ${showLabel ? 'px-2.5 py-1.5' : 'p-1.5'} ${pressable} ${
            surface === 'rail'
              ? 'text-rail-ink hover:bg-rail-hover'
              : 'text-ink hover:bg-hover'
          }`}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
            {initials}
          </span>
          {showLabel && (
            <span className="flex min-w-0 flex-col items-start text-left">
              <span className="w-full truncate text-sm leading-tight font-medium">
                {user?.fullName ?? 'User'}
              </span>
              <span
                className={`w-full truncate text-xs ${surface === 'rail' ? 'text-rail-muted' : 'text-muted'}`}
              >
                {user?.emailAddresses?.[0]?.emailAddress ?? ''}
              </span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="font-medium text-ink">{user?.fullName ?? 'User'}</span>
            <span className="text-xs font-normal text-muted">
              {user?.emailAddresses?.[0]?.emailAddress ?? ''}
            </span>
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
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
