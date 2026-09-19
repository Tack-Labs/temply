import { API_BURST_PER_MINUTE } from '@temply/shared/plans';
import type { ApiKeyMode } from './codes';

type Window = { minute: number; count: number };
const windows = new Map<string, Window>();

/** Past this many buckets in the map the stale windows are swept on insert. */
const SWEEP_ABOVE = 5_000;

export type BurstVerdict = { allowed: true } | { allowed: false; limit: number; retryAfterSeconds: number };

/**
 * A fixed one-minute window per bucket, held in process. This is a single-
 * instance service — SQLite already says so — and a shared store would be
 * more machinery than the guard is worth. A restart forgives everyone, which
 * is fine for a limit that exists to stop a runaway loop, not to meter use;
 * the monthly quota does the metering.
 *
 * The bucket names what is being counted: a key, an address. Two callers
 * counting the same thing under different names would each see half the
 * traffic, so the name carries its kind.
 */
export function checkPerMinute(bucket: string, limit: number, now: Date = new Date()): BurstVerdict {
  const minute = Math.floor(now.getTime() / 60_000);
  const entry = windows.get(bucket);
  if (!entry || entry.minute !== minute) {
    if (windows.size > SWEEP_ABOVE) {
      for (const [id, w] of windows) if (w.minute !== minute) windows.delete(id);
    }
    windows.set(bucket, { minute, count: 1 });
    return { allowed: true };
  }
  if (entry.count >= limit) {
    return { allowed: false, limit, retryAfterSeconds: 60 - Math.floor((now.getTime() % 60_000) / 1000) };
  }
  entry.count += 1;
  return { allowed: true };
}

/** The per-key fuse on the public API, by the key's mode. */
export function checkBurst(keyId: string, mode: ApiKeyMode, now: Date = new Date()): BurstVerdict {
  return checkPerMinute(`key:${keyId}`, API_BURST_PER_MINUTE[mode], now);
}

/**
 * Renders a signed-out caller may ask for in a minute. The playground and
 * the editor's own preview post to the same endpoint, and the editor posts
 * on every pause in typing — sixty is a fast typist with headroom, and far
 * short of what a loop against a public URL would want.
 */
export const ANONYMOUS_RENDERS_PER_MINUTE = 60;

/** Messages one address may leave through the contact form in a minute. */
export const CONTACT_MESSAGES_PER_MINUTE = 5;

/**
 * Who is calling, for the limits that have no key to count by.
 *
 * The API listens on loopback behind our own proxy, so the socket's address
 * is always the proxy's. The client's rides in `x-forwarded-for`, and the
 * *last* entry is the one to read: each hop appends the address it saw, so
 * the last was written by the hop nearest us — Caddy, or the Next proxy —
 * and anything before it is whatever the client chose to send.
 */
export function clientAddress(request: Request, server?: { requestIP: (request: Request) => { address: string } | null } | null): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded.split(',').map((hop) => hop.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return server?.requestIP(request)?.address ?? 'unknown';
}

/** Tests share the module-level map; this is how one test stops leaking into the next. */
export function resetBurstWindows() {
  windows.clear();
}
