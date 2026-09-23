import { afterEach, describe, expect, it } from 'bun:test';
import { getImageKit, resetImageKitForTests } from './imagekit';

describe('getImageKit', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; resetImageKitForTests(); });

  it('is null until the keys are set', () => {
    delete process.env.IMAGEKIT_PUBLIC_KEY;
    expect(getImageKit()).toBeNull();
  });

  it('deletes through IMAGEKIT_API_BASE when it is set, with the SDK’s own auth', async () => {
    process.env.IMAGEKIT_PUBLIC_KEY = 'pub';
    process.env.IMAGEKIT_PRIVATE_KEY = 'priv';
    process.env.IMAGEKIT_URL_ENDPOINT = 'http://127.0.0.1:1/cdn';
    process.env.IMAGEKIT_API_BASE = 'http://127.0.0.1:1/api';
    const seen: Array<{ url: string; method: string; auth: string | null }> = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), method: init?.method ?? 'GET', auth: new Headers(init?.headers).get('authorization') });
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    try {
      await getImageKit()!.deleteFile('file_1');
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(seen).toEqual([{ url: 'http://127.0.0.1:1/api/v1/files/file_1', method: 'DELETE', auth: `Basic ${Buffer.from('priv:').toString('base64')}` }]);
  });

  it('turns a non-2xx delete into an error carrying the status, as the SDK does', async () => {
    process.env.IMAGEKIT_PUBLIC_KEY = 'pub';
    process.env.IMAGEKIT_PRIVATE_KEY = 'priv';
    process.env.IMAGEKIT_URL_ENDPOINT = 'http://127.0.0.1:1/cdn';
    process.env.IMAGEKIT_API_BASE = 'http://127.0.0.1:1/api';
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('{"message":"gone"}', { status: 404 })) as typeof fetch;
    try {
      await expect(getImageKit()!.deleteFile('file_1')).rejects.toMatchObject({ $ResponseMetadata: { statusCode: 404 } });
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
