import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { rateWindows } from '@temply/shared/schema';
import { createTestDb, type TestDb } from '../test/helpers';
import { HOUR_MS, checkBurst, checkPerMinute, checkWindow, clientAddress } from './rate-limit';

let db: TestDb;

beforeEach(() => {
  db = createTestDb();
});

describe('checkPerMinute', () => {
  it('allows up to the limit in a minute, then refuses with the seconds left in it', async () => {
    const at = new Date('2026-09-19T10:00:15Z');
    for (let i = 0; i < 3; i++) expect((await checkPerMinute(db, 'address:1.2.3.4', 3, at)).allowed).toBe(true);
    const refused = await checkPerMinute(db, 'address:1.2.3.4', 3, at);
    expect(refused).toEqual({ allowed: false, limit: 3, retryAfterSeconds: 45 });
  });

  it('starts a fresh window on the next minute', async () => {
    const at = new Date('2026-09-19T10:00:59Z');
    for (let i = 0; i < 3; i++) await checkPerMinute(db, 'address:1.2.3.4', 3, at);
    expect((await checkPerMinute(db, 'address:1.2.3.4', 3, at)).allowed).toBe(false);
    expect((await checkPerMinute(db, 'address:1.2.3.4', 3, new Date('2026-09-19T10:01:00Z'))).allowed).toBe(true);
  });

  it('counts buckets apart, so a key and an address with the same id never share a window', async () => {
    for (let i = 0; i < 3; i++) await checkPerMinute(db, 'address:abc', 3);
    expect((await checkPerMinute(db, 'address:abc', 3)).allowed).toBe(false);
    expect((await checkPerMinute(db, 'key:abc', 3)).allowed).toBe(true);
    expect((await checkBurst(db, 'abc', 'test')).allowed).toBe(true);
  });

  it('does not count a refused call, so callers with a higher limit on the same bucket still get theirs', async () => {
    const at = new Date('2026-09-19T10:00:15Z');
    for (let i = 0; i < 10; i++) await checkPerMinute(db, 'address:1.2.3.4', 3, at);
    expect(await db.select({ count: rateWindows.count }).from(rateWindows)).toEqual([{ count: 3 }]);
    expect((await checkPerMinute(db, 'address:1.2.3.4', 4, at)).allowed).toBe(true);
  });
});

describe('checkWindow', () => {
  let random: ReturnType<typeof spyOn> | undefined;
  afterEach(() => random?.mockRestore());

  it('refuses until the hour turns over, with the seconds left in it', async () => {
    const at = new Date('2026-09-19T10:59:00Z');
    for (let i = 0; i < 2; i++) await checkWindow(db, 'sends:u1', 2, HOUR_MS, at);
    expect(await checkWindow(db, 'sends:u1', 2, HOUR_MS, at)).toEqual({ allowed: false, limit: 2, retryAfterSeconds: 60 });
    expect((await checkWindow(db, 'sends:u1', 2, HOUR_MS, new Date('2026-09-19T11:00:00Z'))).allowed).toBe(true);
  });

  it('sweeps windows older than a day and keeps the ones still counting', async () => {
    await checkPerMinute(db, 'address:old', 3, new Date('2026-09-17T10:00:00Z'));
    await checkPerMinute(db, 'address:recent', 3, new Date('2026-09-19T09:00:00Z'));
    random = spyOn(Math, 'random').mockReturnValue(0);
    await checkPerMinute(db, 'address:now', 3, new Date('2026-09-19T10:00:00Z'));
    const left = await db.select({ bucket: rateWindows.bucket }).from(rateWindows);
    expect(left.map((row) => row.bucket).sort()).toEqual(['address:now', 'address:recent']);
  });
});

describe('clientAddress', () => {
  const request = (forwardedFor?: string) =>
    new Request('http://localhost/x', { headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {} });

  it('reads the last hop of x-forwarded-for, which is the one our own proxy wrote', () => {
    expect(clientAddress(request('9.9.9.9, 203.0.113.7'))).toBe('203.0.113.7');
    expect(clientAddress(request('203.0.113.7'))).toBe('203.0.113.7');
  });

  it('falls back to the socket, and then to a name that still counts', () => {
    const server = { requestIP: () => ({ address: '127.0.0.1' }) };
    expect(clientAddress(request(), server)).toBe('127.0.0.1');
    expect(clientAddress(request(''), server)).toBe('127.0.0.1');
    expect(clientAddress(request())).toBe('unknown');
  });
});
