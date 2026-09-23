import { describe, expect, it } from 'bun:test';
import { createHash } from 'crypto';
import { generateApiKey, generateShortCode, hashApiKey } from './codes';

describe('generateShortCode', () => {
  it('produces a tpl_ prefix followed by 8 base62 characters', () => {
    expect(generateShortCode()).toMatch(/^tpl_[0-9A-Za-z]{8}$/);
  });

  it('does not repeat across a large batch', () => {
    const codes = new Set(Array.from({ length: 500 }, generateShortCode));
    expect(codes.size).toBe(500);
  });
});

describe('generateApiKey', () => {
  it('produces a tply_live_ key with a 32 character secret', () => {
    const { fullKey } = generateApiKey();
    expect(fullKey).toMatch(/^tply_live_[0-9A-Za-z]{32}$/);
  });

  it('returns a prefix that is the first 14 characters of the key', () => {
    const { fullKey, prefix } = generateApiKey();
    expect(prefix).toBe(fullKey.slice(0, 14));
    expect(prefix.startsWith('tply_live_')).toBe(true);
  });

  it('returns the sha256 of the full key, never the key itself', () => {
    const { fullKey, hash } = generateApiKey();
    expect(hash).toBe(createHash('sha256').update(fullKey).digest('hex'));
    expect(hash).not.toContain(fullKey);
    expect(hash).toHaveLength(64);
  });

  it('hashes so that lookup by hashApiKey finds the same key', () => {
    const { fullKey, hash } = generateApiKey();
    expect(hashApiKey(fullKey)).toBe(hash);
  });
});

describe('hashApiKey', () => {
  it('is deterministic', () => {
    expect(hashApiKey('tply_live_abc')).toBe(hashApiKey('tply_live_abc'));
  });

  it('differs for keys that differ by one character', () => {
    expect(hashApiKey('tply_live_abc')).not.toBe(hashApiKey('tply_live_abd'));
  });
});
