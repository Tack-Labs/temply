import { afterEach, describe, expect, it } from 'bun:test';
import { apiBase, planForVariant, portalUrl, verifySignature } from './lemonsqueezy';

const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

describe('apiBase', () => {
  it('talks to Lemon Squeezy unless told otherwise', () => {
    delete process.env.LEMONSQUEEZY_API_BASE;
    expect(apiBase()).toBe('https://api.lemonsqueezy.com');
  });

  it('talks to the base LEMONSQUEEZY_API_BASE names, so a test can stand a fake in', () => {
    process.env.LEMONSQUEEZY_API_BASE = 'http://127.0.0.1:3999/lemonsqueezy/';
    expect(apiBase()).toBe('http://127.0.0.1:3999/lemonsqueezy');
  });
});

describe('planForVariant', () => {
  it('reads the plan off the variant it is sold as, whether the id comes as a number or a string', () => {
    process.env.LEMONSQUEEZY_VARIANT_PRO = '101';
    process.env.LEMONSQUEEZY_VARIANT_ENTERPRISE = '202';
    expect(planForVariant(101)).toBe('pro');
    expect(planForVariant('202')).toBe('enterprise');
    expect(planForVariant(999)).toBeNull();
  });

  it('matches nothing to a plan whose variant is not configured', () => {
    delete process.env.LEMONSQUEEZY_VARIANT_PRO;
    delete process.env.LEMONSQUEEZY_VARIANT_ENTERPRISE;
    expect(planForVariant(101)).toBeNull();
    expect(planForVariant(undefined)).toBeNull();
    expect(planForVariant('')).toBeNull();
  });
});

describe('a refused request', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  it('says so in words an admin can read, and keeps what Lemon Squeezy said for the log', async () => {
    process.env.LEMONSQUEEZY_API_KEY = 'ls_test_key';
    process.env.LEMONSQUEEZY_API_BASE = 'https://ls.test';
    globalThis.fetch = (async () => Response.json({ errors: [{ detail: 'The variant is archived.' }] }, { status: 422 })) as unknown as typeof fetch;
    const error = await portalUrl('sub_1').catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Lemon Squeezy could not complete the request. Try again in a minute.');
    expect(String(((error as Error).cause as Error).message)).toContain('422 {"errors":[{"detail":"The variant is archived."}]}');
  });
});

describe('verifySignature', () => {
  it('refuses a signature that is not hex of the right length rather than throwing', () => {
    expect(verifySignature('{}', 'zz', 'secret')).toBe(false);
    expect(verifySignature('{}', null, 'secret')).toBe(false);
  });
});
