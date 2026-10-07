import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../core/editor/test/dom';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

const { VersionHistoryDialog } = await import('./version-history-dialog');

const realFetch = globalThis.fetch;
let stamp: string | null;
const zone = process.env.TZ;

beforeEach(() => {
  stamp = '2026-10-03 14:15:00';
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    if (String(input).endsWith('/versions')) {
      return Response.json({ versions: [{ id: 'v1', version_number: 1, title: 'Welcome', created_at: stamp }] });
    }
    return new Response('{}', { status: 404 });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

const open = () => {
  const view = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <VersionHistoryDialog templateId="welcome" trigger={<button type="button">Version history</button>} />
    </QueryClientProvider>,
  );
  fireEvent.click(view.getByRole('button', { name: 'Version history' }));
  return view;
};

describe('a version in the history dialog', () => {
  // The API sends `YYYY-MM-DD HH:MM:SS` in UTC with no zone on it, and `new
  // Date` reads that as the reader's local time.
  for (const timeZone of ['America/Los_Angeles', 'Pacific/Auckland']) {
    it(`shows the moment it was saved for a reader in ${timeZone}`, async () => {
      process.env.TZ = timeZone;
      const view = open();
      const expected = new Date('2026-10-03T14:15:00Z').toLocaleString();
      await waitFor(() => expect(view.baseElement.textContent).toContain(expected));
    });
  }

  it('says the date is unknown when the row has none', async () => {
    stamp = null;
    const view = open();
    await waitFor(() => expect(view.baseElement.textContent).toContain('Unknown date'));
  });
});
