import { app } from '@temply/server/app';

/** Longer than any render, and no longer than the route's maxDuration. */
const API_TIMEOUT_MS = 60_000;

/**
 * Where the Next.js side reaches the API. Server-only: the proxy route and
 * serverFetch call it, the browser never does. The API runs in this
 * process, so a call is `app.handle` with no network in between. Setting
 * API_URL sends calls to a standalone API instead (`bun run dev:server`),
 * for debugging it apart from Next.js; that API binds to IPv4 loopback, so
 * address it as 127.0.0.1, not `localhost`, which resolves to ::1 first on
 * macOS.
 */
export function callApi(path: string, init: RequestInit): Promise<Response> {
  const target = process.env.API_URL?.replace(/\/$/, '');
  if (target) return fetch(`${target}${path}`, { ...init, signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  // The origin is never read: the API routes on the path alone.
  return app.handle(new Request(`http://api.internal${path}`, init));
}
