import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../../../../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';

// The page is an async server component, so it is awaited for the element tree
// it returns and that tree is rendered: what is under test is the frame a
// failed load lands in. Bun shares one module registry across test files and
// `mock.module` outlives the file that made it, so the real modules are
// captured first and put back afterwards.
const realClerk = { ...(await import('@clerk/nextjs/server')) };
const realServerFetch = { ...(await import('~/lib/server-fetch')) };
const realNavigation = { ...(await import('next/navigation')) };

type Answer = () => Promise<Response>;
let template: Answer = async () => new Response('{}', { status: 500 });

mock.module('@clerk/nextjs/server', () => ({ ...realClerk, auth: async () => ({ userId: 'user_1', orgRole: 'org:admin' }) }));
mock.module('~/lib/server-fetch', () => ({
  ...realServerFetch,
  serverFetch: (path: string) => (path === '/api/v1/billing' ? Promise.resolve(new Response('{}')) : template()),
}));
mock.module('next/navigation', () => ({
  ...realNavigation,
  usePathname: () => '/templates/abc/review',
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
afterAll(() => {
  mock.module('@clerk/nextjs/server', () => realClerk);
  mock.module('~/lib/server-fetch', () => realServerFetch);
  mock.module('next/navigation', () => realNavigation);
});

const { default: ReviewPage } = await import('./page');

afterEach(cleanup);
beforeEach(() => {
  template = async () => new Response('{}', { status: 500 });
});

const open = async () => render(await ReviewPage({ params: Promise.resolve({ id: 'abc' }) }));

describe('the sign-off page when the template cannot be loaded', () => {
  // The route's layout is a bare full-height column, so the header, the skip
  // link's target and the scroller all come from what the page returns. The
  // error card alone left a reader with nothing to click but the retry.
  it('keeps a way back and a main landmark around the error', async () => {
    const view = await open();
    const main = view.getByRole('main');
    expect(main.id).toBe('main-content');
    expect(main.textContent).toContain('We could not load this template for sign-off.');
    expect(view.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(main.contains(view.getByRole('button', { name: 'Try again' }))).toBe(true);
    expect(view.getByRole('link', { name: 'Back to templates' }).getAttribute('href')).toBe('/dashboard/templates');
  });

  it('keeps the tab row, with this page marked as the current one', async () => {
    const view = await open();
    const tabs = view.getByRole('navigation', { name: 'Template' });
    expect(tabs.querySelector('[aria-current="page"]')?.textContent).toBe('Review & release');
    expect(tabs.querySelectorAll('a')).toHaveLength(5);
  });

  it('names the page in the header, since the template is what failed to load', async () => {
    const view = await open();
    expect(view.getByRole('heading', { level: 1 }).textContent).toBe('Sign-off');
  });

  it('does the same when the request never reaches the server', async () => {
    template = async () => {
      throw new Error('connect ECONNREFUSED');
    };
    const view = await open();
    expect(view.getByRole('main').textContent).toContain('We could not load this template for sign-off.');
    expect(view.getByRole('link', { name: 'Back to templates' })).toBeTruthy();
  });
});
