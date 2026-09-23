import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '@temply/shared/schema';
import { Elysia, type AnyElysia } from 'elysia';
import { initTables } from '../plugins/db';
import { normaliseRole } from '../plugins/auth';
import { errorResponse } from '../lib/errors';

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * An in-memory database using the same DDL the server runs at startup, so the
 * tests drift with `initTables` instead of against it.
 */
export function createTestDb(): TestDb {
  const sqlite = new Database(':memory:');
  sqlite.run('PRAGMA foreign_keys = ON');
  initTables(sqlite);
  return drizzle(sqlite, { schema });
}

/**
 * Wraps a route module with the two things every handler reads off the context:
 * `db` and `userId`. The `x-user-id` header mirrors the trusted-header path of
 * the real auth plugin, so requests without it exercise the signed-out branch.
 *
 * The stubs are registered under the real plugin names ('auth', 'db') so that
 * Elysia's name-based deduplication skips the real plugins the route modules
 * chain via `.use(authPlugin).use(dbPlugin)` — otherwise tests would hit Clerk
 * and open the on-disk database.
 */
export function createTestApp(db: TestDb, routes: AnyElysia) {
  return new Elysia()
    .use(
      new Elysia({ name: 'auth' }).derive({ as: 'global' }, ({ request }) => ({
        userId: request.headers.get('x-user-id'),
        orgId: request.headers.get('x-org-id') || null,
        orgRole: normaliseRole(request.headers.get('x-org-role')),
      })),
    )
    .use(new Elysia({ name: 'db' }).derive({ as: 'global' }, () => ({ db })))
    // The same error mapping index.ts installs — same scope, same position —
    // so the statuses these tests assert are the ones production answers with.
    .onError({ as: 'global' }, ({ error, code }) => errorResponse(code, error))
    .use(routes);
}

/** All the request helpers need from an app — Elysia's full generic type
 *  changes with every route module and buys these helpers nothing. */
type TestApp = { handle: (request: Request) => Promise<Response> };

export function get(app: TestApp, path: string, userId?: string | null, headers: Record<string, string> = {}) {
  return app.handle(new Request(`http://localhost${path}`, { headers: withUser(headers, userId) }));
}

export function post(app: TestApp, path: string, body: unknown, userId?: string | null, headers: Record<string, string> = {}) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: withUser({ 'Content-Type': 'application/json', ...headers }, userId),
      body: JSON.stringify(body),
    }),
  );
}

export function put(app: TestApp, path: string, body: unknown, userId?: string | null, headers: Record<string, string> = {}) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: 'PUT',
      headers: withUser({ 'Content-Type': 'application/json', ...headers }, userId),
      body: JSON.stringify(body),
    }),
  );
}

export function del(app: TestApp, path: string, userId?: string | null, headers: Record<string, string> = {}) {
  return app.handle(
    new Request(`http://localhost${path}`, { method: 'DELETE', headers: withUser(headers, userId) }),
  );
}

/**
 * Each test user is a one-person organization named after them, and its
 * admin, unless a test passes its own x-org-* headers — that is how a test
 * puts two users in one org, makes someone a member, or leaves a user with
 * no workspace at all (`'x-org-id': ''`).
 */
function withUser(headers: Record<string, string>, userId?: string | null): Record<string, string> {
  if (!userId) return headers;
  return { 'x-org-id': userId, 'x-org-role': 'admin', ...headers, 'x-user-id': userId };
}

/** Multipart POST — `fetch` sets the boundary header from the FormData. */
export function postForm(app: TestApp, path: string, form: FormData, userId?: string | null) {
  return app.handle(
    new Request(`http://localhost${path}`, { method: 'POST', headers: withUser({}, userId), body: form }),
  );
}

/** Gives `userId` a paid subscription so plan-gated branches can be reached. */
export async function givePlan(db: TestDb, userId: string, plan: 'free' | 'pro' | 'enterprise', status = 'active') {
  await db.insert(schema.subscriptions).values({
    id: crypto.randomUUID(),
    user_id: userId,
    org_id: userId,
    plan,
    status,
  });
}
