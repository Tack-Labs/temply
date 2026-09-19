'use client';

import { Clerk } from '~/components/clerk';
import { UserMenu } from '~/components/dashboard/user-menu';

/**
 * The marketing header's account menu, with the Clerk it needs brought
 * along. The header decides from a cookie whether anyone is signed in and
 * loads this only then, so a visitor who is not never fetches Clerk to be
 * shown a Sign in button.
 */
export default function HeaderUserMenu() {
  return (
    <Clerk>
      <UserMenu align="end" showLabel={false} surface="page" />
    </Clerk>
  );
}
