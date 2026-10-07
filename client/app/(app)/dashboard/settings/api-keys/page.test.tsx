import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../../../../../core/editor/test/dom';
import { cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Bun shares one module registry across test files and `mock.module` outlives
// the file that made it, so the real module is captured first and put back.
const realClerk = { ...(await import('@clerk/nextjs')) };
mock.module('@clerk/nextjs', () => ({ ...realClerk, useAuth: () => ({ orgRole: 'org:admin' }) }));
afterAll(() => {
  mock.module('@clerk/nextjs', () => realClerk);
});

const { default: ApiKeysPage } = await import('./page');

const realFetch = globalThis.fetch;
const zone = process.env.TZ;
let keys: { created_at: string | null; last_used_at: string | null; revoked_at: string | null }[];

beforeEach(() => {
  keys = [{ created_at: '2026-10-03 03:00:00', last_used_at: null, revoked_at: null }];
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    if (String(input).endsWith('/api-keys')) {
      return Response.json({
        keys: keys.map((key, index) => ({ id: `k${index}`, name: `Key ${index}`, key_prefix: 'tk_live_ab', mode: 'live', ...key })),
      });
    }
    // The plan the page would count the keys against is not under test.
    return new Response('{}', { status: 404 });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ApiKeysPage />
    </QueryClientProvider>,
  );

const day = (instant: string) =>
  new Date(instant).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

describe('the dates in the key table', () => {
  // `created_at` is written by the database in `YYYY-MM-DD HH:MM:SS`, UTC with
  // no zone on it, and `new Date` reads that as the reader's local time. The
  // date is a day, so a stamp is only wrong where the local reading lands on
  // the other side of midnight: 03:00 UTC is still the day before in Los
  // Angeles, and 23:30 UTC is already the next day in Auckland.
  const cases = [
    { zone: 'America/Los_Angeles', stamp: '2026-10-03 03:00:00', instant: '2026-10-03T03:00:00Z' },
    { zone: 'Pacific/Auckland', stamp: '2026-10-03 23:30:00', instant: '2026-10-03T23:30:00Z' },
  ];

  for (const { zone: timeZone, stamp, instant } of cases) {
    it(`shows the day a key was created for a reader in ${timeZone}`, async () => {
      process.env.TZ = timeZone;
      keys = [{ created_at: stamp, last_used_at: null, revoked_at: null }];
      const view = setup();
      await waitFor(() => expect(view.getByText(day(instant))).toBeTruthy());
    });
  }

  it('reads the ISO stamp the API writes for last use as the instant it names', async () => {
    process.env.TZ = 'Pacific/Auckland';
    keys = [{ created_at: '2026-10-01 12:00:00', last_used_at: '2026-10-03T03:00:00.000Z', revoked_at: null }];
    const view = setup();
    await waitFor(() => expect(view.getByText(day('2026-10-03T03:00:00Z'))).toBeTruthy());
  });

  it('says when a key has no creation date and has never been used', async () => {
    keys = [{ created_at: null, last_used_at: null, revoked_at: null }];
    const view = setup();
    await waitFor(() => expect(view.getByText('Unknown')).toBeTruthy());
    expect(view.getByText('Never')).toBeTruthy();
  });
});
