import { lt, sql } from 'drizzle-orm';
import { API_BURST_PER_MINUTE } from '@temply/shared/plans';
import { rateWindows } from '@temply/shared/schema';
import type { Db } from '../plugins/db';
import type { ApiKeyMode } from './codes';

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;

/** Comfortably longer than any window, so a sweep never removes one that is
 *  still counting. */
const KEEP_WINDOWS_MS = 24 * HOUR_MS;

/** The share of calls that also sweep finished windows, which keeps the
 *  table small without a scheduled job of its own. */
const SWEEP_CHANCE = 0.01;

export type BurstVerdict = { allowed: true } | { allowed: false; limit: number; retryAfterSeconds: number };

/**
 * A fixed window per bucket, counted in the database so that every process
 * serving the API draws on one count. Held in memory, each of N processes
 * would allow the full limit and the fuse would be N times looser. It exists
 * to stop a runaway loop, not to meter use; the monthly quota does the
 * metering.
 *
 * One statement counts and decides. The upsert increments only while the
 * count is under the limit, so a refused call is not counted, and no other
 * process can act between a read and a write. No row back means the window
 * is full.
 *
 * The bucket names what is being counted: a key, an address. Two callers
 * counting the same thing under different names would each see half the
 * traffic, so the name carries its kind. A bucket keeps one window length:
 * windows of two lengths can start at the same instant and would share a row.
 */
export async function checkWindow(
  db: Db,
  bucket: string,
  limit: number,
  windowMs: number,
  now: Date = new Date(),
): Promise<BurstVerdict> {
  const start = Math.floor(now.getTime() / windowMs) * windowMs;
  const counted = await db
    .insert(rateWindows)
    .values({ bucket, window_start: new Date(start).toISOString(), count: 1 })
    .onConflictDoUpdate({
      target: [rateWindows.bucket, rateWindows.window_start],
      set: { count: sql`${rateWindows.count} + 1` },
      setWhere: sql`${rateWindows.count} < ${limit}`,
    })
    .returning({ count: rateWindows.count });
  if (Math.random() < SWEEP_CHANCE) {
    const cutoff = new Date(now.getTime() - KEEP_WINDOWS_MS).toISOString();
    await db.delete(rateWindows).where(lt(rateWindows.window_start, cutoff));
  }
  if (counted.length) return { allowed: true };
  return { allowed: false, limit, retryAfterSeconds: Math.ceil((start + windowMs - now.getTime()) / 1000) };
}

export function checkPerMinute(db: Db, bucket: string, limit: number, now: Date = new Date()): Promise<BurstVerdict> {
  return checkWindow(db, bucket, limit, MINUTE_MS, now);
}

/** The per-key fuse on the public API, by the key's mode. */
export function checkBurst(db: Db, keyId: string, mode: ApiKeyMode, now: Date = new Date()): Promise<BurstVerdict> {
  return checkPerMinute(db, `key:${keyId}`, API_BURST_PER_MINUTE[mode], now);
}

/**
 * Renders a signed-out caller may ask for in a minute: the playground's
 * visitors, counted by address. Sixty is a visitor trying things out with
 * headroom, and far short of what a loop against a public URL would want.
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
 * the last was written by the hop nearest us — the edge or the Next proxy —
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
