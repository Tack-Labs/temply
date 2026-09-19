import { beforeEach, describe, expect, it } from 'bun:test';
import { checkBurst, checkPerMinute, clientAddress, resetBurstWindows } from './rate-limit';

beforeEach(() => resetBurstWindows());

describe('checkPerMinute', () => {
  it('allows up to the limit in a minute, then refuses with the seconds left in it', () => {
    const at = new Date('2026-09-19T10:00:15Z');
    for (let i = 0; i < 3; i++) expect(checkPerMinute('address:1.2.3.4', 3, at).allowed).toBe(true);
    const refused = checkPerMinute('address:1.2.3.4', 3, at);
    expect(refused).toEqual({ allowed: false, limit: 3, retryAfterSeconds: 45 });
  });

  it('starts a fresh window on the next minute', () => {
    const at = new Date('2026-09-19T10:00:59Z');
    for (let i = 0; i < 3; i++) checkPerMinute('address:1.2.3.4', 3, at);
    expect(checkPerMinute('address:1.2.3.4', 3, at).allowed).toBe(false);
    expect(checkPerMinute('address:1.2.3.4', 3, new Date('2026-09-19T10:01:00Z')).allowed).toBe(true);
  });

  it('counts buckets apart, so a key and an address with the same id never share a window', () => {
    for (let i = 0; i < 3; i++) checkPerMinute('address:abc', 3);
    expect(checkPerMinute('address:abc', 3).allowed).toBe(false);
    expect(checkPerMinute('key:abc', 3).allowed).toBe(true);
    expect(checkBurst('abc', 'test').allowed).toBe(true);
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
