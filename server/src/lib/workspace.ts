import type { OrgRole } from '../plugins/auth';
import { json } from './errors';

type Identity = { userId: string | null; orgId: string | null; orgRole: OrgRole | null };

/**
 * A signed-in user with no active organization — fresh from sign-up, or
 * switched to none. The client answers this by sending them to onboarding,
 * so the code is stable and named.
 */
export function noWorkspace() {
  return json(
    { status: 403, code: 'no-workspace', message: 'No workspace selected', errors: ['No workspace selected'] },
    403,
  );
}

/** Admin manages the account; a member asking for an account action is
 *  told who can. */
export function askAnAdmin(what: string) {
  const message = `Only an admin can ${what}. Ask an admin on your team.`;
  return json({ status: 403, code: 'admin-only', message, errors: [message] }, 403);
}

export function isAdmin(ctx: Identity): boolean {
  return ctx.orgRole === 'admin';
}
