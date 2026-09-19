import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { Elysia } from 'elysia';

// The plugin reads the proxy secret at load, so it is set before the import.
process.env.INTERNAL_API_SECRET = 'proxy-secret';
process.env.CLERK_SECRET_KEY = 'sk_test_x';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_x';

// Clerk answers whatever the case below says it should; nothing reaches
// the network.
let verify: (token: string) => Promise<Record<string, unknown>>;
let authenticate: (request: Request) => Promise<Record<string, unknown>>;
mock.module('@clerk/backend', () => ({
  verifyToken: (token: string) => verify(token),
  createClerkClient: () => ({ authenticateRequest: (request: Request) => authenticate(request) }),
}));

const { authPlugin } = await import('./auth');

/** A route that reports who the plugin decided the caller is. */
const app = new Elysia().use(authPlugin).get('/who', ({ userId, orgId, orgRole }) => ({ userId, orgId, orgRole }));

const who = async (headers: Record<string, string>) =>
  (await app.handle(new Request('http://localhost/who', { headers }))).json();

const nobody = { userId: null, orgId: null, orgRole: null };

beforeEach(() => {
  verify = async () => {
    throw new Error('no token');
  };
  authenticate = async () => ({ status: 'signed-out', isSignedIn: false, reason: 'no session' });
});

describe('authPlugin', () => {
  it('trusts the forwarded identity only with the proxy secret', async () => {
    expect(await who({ 'x-user-id': 'user_1', 'x-org-id': 'org_1', 'x-org-role': 'org:admin', 'x-internal-token': 'proxy-secret' }))
      .toEqual({ userId: 'user_1', orgId: 'org_1', orgRole: 'admin' });
    // A forged header with the wrong secret, or none, is an unauthenticated string.
    expect(await who({ 'x-user-id': 'user_1', 'x-internal-token': 'guess' })).toEqual(nobody);
    expect(await who({ 'x-user-id': 'user_1' })).toEqual(nobody);
  });

  it('a forwarded user with no organization yet is a user with no workspace', async () => {
    expect(await who({ 'x-user-id': 'user_1', 'x-org-id': '', 'x-org-role': '', 'x-internal-token': 'proxy-secret' }))
      .toEqual({ userId: 'user_1', orgId: null, orgRole: null });
  });

  it('verifies a __session cookie itself, reading the organization from either claim shape', async () => {
    verify = async (token) => (token === 'v2.token' ? { sub: 'user_2', o: { id: 'org_2', rol: 'member' } } : { sub: 'user_1', org_id: 'org_1', org_role: 'org:admin' });
    expect(await who({ cookie: '__session=v2.token; other=1' })).toEqual({ userId: 'user_2', orgId: 'org_2', orgRole: 'member' });
    expect(await who({ cookie: '__session=v1.token' })).toEqual({ userId: 'user_1', orgId: 'org_1', orgRole: 'admin' });
  });

  it('falls back to Clerk’s own request check when the token does not verify', async () => {
    authenticate = async () => ({
      status: 'signed-in',
      isSignedIn: true,
      toAuth: () => ({ userId: 'user_3', orgId: 'org_3', orgRole: 'org:member' }),
    });
    expect(await who({ cookie: '__session=stale.token' })).toEqual({ userId: 'user_3', orgId: 'org_3', orgRole: 'member' });
    expect(await who({ cookie: '__clerk_db_jwt=dev' })).toEqual({ userId: 'user_3', orgId: 'org_3', orgRole: 'member' });
  });

  it('is nobody with no cookie, a cookie Clerk rejects, or a check that throws', async () => {
    expect(await who({})).toEqual(nobody);
    expect(await who({ cookie: '__session=stale.token' })).toEqual(nobody);
    authenticate = async () => {
      throw new Error('clerk down');
    };
    expect(await who({ cookie: '__session=stale.token' })).toEqual(nobody);
  });
});
