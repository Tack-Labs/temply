import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../core/editor/test/dom';
import { cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TemplatePageRow } from '~/lib/template-page';

// Bun shares one module registry across test files and `mock.module` outlives
// the file that made it, so each real module is captured first and put back.
const realNavigation = { ...(await import('next/navigation')) };
const realPreview = { ...(await import('~/components/template-version-preview')) };
mock.module('next/navigation', () => ({ ...realNavigation, useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
// The preview fetches and frames a rendered email; what it draws is not under test.
mock.module('~/components/template-version-preview', () => ({ ...realPreview, TemplateVersionPreview: () => <div data-preview /> }));
afterAll(() => {
  mock.module('next/navigation', () => realNavigation);
  mock.module('~/components/template-version-preview', () => realPreview);
});

const { TemplateVersions } = await import('./template-versions');

const template = { id: 'welcome', title: 'Welcome', live_version: 1 } as TemplatePageRow;
const realFetch = globalThis.fetch;
let stamp: string | null;
const zone = process.env.TZ;

beforeEach(() => {
  stamp = '2026-10-03 14:15:00';
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    if (String(input).endsWith('/versions')) {
      return Response.json({ versions: [{ id: 'v1', version_number: 1, title: 'Welcome', tag: null, created_at: stamp }] });
    }
    // The plan the page would add a line about is not under test.
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
      <TemplateVersions template={template} readOnly={false} isAdmin />
    </QueryClientProvider>,
  );

describe('a version in the history list', () => {
  // The API sends `YYYY-MM-DD HH:MM:SS` in UTC with no zone on it, and `new
  // Date` reads that as the reader's local time.
  for (const timeZone of ['America/Los_Angeles', 'Pacific/Auckland']) {
    it(`shows the moment it was saved for a reader in ${timeZone}`, async () => {
      process.env.TZ = timeZone;
      const view = setup();
      const expected = new Date('2026-10-03T14:15:00Z').toLocaleString();
      await waitFor(() => expect(view.getByText(expected)).toBeTruthy());
    });
  }

  it('says the date is unavailable when the row has none', async () => {
    stamp = null;
    const view = setup();
    await waitFor(() => expect(view.getByText('Date unavailable')).toBeTruthy());
  });
});
