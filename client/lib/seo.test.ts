import { expect, test } from 'bun:test';

for (const environment of ['production', 'preview', 'development']) {
  test(`${environment} uses the public canonical host and the correct indexing policy`, () => {
    const probe = Bun.spawnSync({
      cmd: ['bun', '--eval', `
        import { publicPageMetadata } from './lib/seo';
        import config from './next.config.mjs';
        const metadata = publicPageMetadata('/docs');
        const headers = await config.headers();
        console.log(JSON.stringify({
          canonical: metadata.alternates.canonical,
          robots: metadata.robots,
          noindexAll: headers.some(rule => rule.source === '/(.*)' &&
            rule.headers.some(header => header.key === 'X-Robots-Tag')),
        }));
      `],
      cwd: new URL('..', import.meta.url).pathname,
      env: { ...process.env, VERCEL_ENV: environment, SITE_NOINDEX: '0', NEXT_PUBLIC_APP_URL: 'https://staging.example.test' },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(probe.exitCode).toBe(0);
    const result = JSON.parse(new TextDecoder().decode(probe.stdout));
    expect(result.canonical).toBe('https://temply.tacklabs.co.uk/docs');
    expect(result.robots).toEqual({ index: environment === 'production', follow: environment === 'production' });
    expect(result.noindexAll).toBe(environment !== 'production');
  });
}

test('SITE_NOINDEX protects a staging build without Vercel environment metadata', () => {
  const probe = Bun.spawnSync({
    cmd: ['bun', '--eval', `
      import { publicPageMetadata } from './lib/seo';
      import config from './next.config.mjs';
      console.log(JSON.stringify({
        robots: publicPageMetadata('/').robots,
        noindexAll: (await config.headers()).some(rule => rule.source === '/(.*)' &&
          rule.headers.some(header => header.key === 'X-Robots-Tag' && header.value === 'noindex, nofollow')),
      }));
    `],
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, VERCEL_ENV: '', SITE_NOINDEX: '1' },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  expect(probe.exitCode).toBe(0);
  expect(JSON.parse(new TextDecoder().decode(probe.stdout))).toEqual({
    robots: { index: false, follow: false },
    noindexAll: true,
  });
});
