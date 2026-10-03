import { afterAll, describe, expect, it, mock } from 'bun:test';
import { isValidElement, type ReactElement, type ReactNode } from 'react';

// The page is an async server component, read here as the element tree it
// returns rather than rendered: what is under test is which of the three
// answers a load can give it draws, and the pieces it draws with have tests of
// their own.
//
// Bun shares one process, and one module registry, across test files, and
// `mock.module` outlives the file that made it. The real modules are captured
// before they are replaced and put back afterwards, or every file that runs
// later would meet the stand-ins, and which files those are depends on the
// run order.
const realClerk = { ...(await import('@clerk/nextjs/server')) };
const realServerFetch = { ...(await import('~/lib/server-fetch')) };

let templatesAnswer: () => Promise<Response> = async () => new Response('{}');
mock.module('@clerk/nextjs/server', () => ({
  ...realClerk,
  auth: async () => ({ userId: 'user_1', orgRole: 'org:admin' }),
}));
mock.module('~/lib/server-fetch', () => ({
  ...realServerFetch,
  serverFetch: (path: string) =>
    path === '/api/v1/templates' ? templatesAnswer() : Promise.resolve(new Response('{}', { status: 500 })),
}));
afterAll(() => {
  mock.module('@clerk/nextjs/server', () => realClerk);
  mock.module('~/lib/server-fetch', () => realServerFetch);
});

const { default: TemplatesPage } = await import('./page');
const { RefreshErrorState } = await import('~/components/dashboard/refresh-error-state');
const { TemplateList } = await import('~/components/dashboard/template-list');
const { EmptyState } = await import('~/components/ui/surfaces');

/** Every element of `type` anywhere in what the page returned. */
function find(node: ReactNode, type: unknown): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap((child) => find(child, type));
  if (!isValidElement(node)) return [];
  const own = node.type === type ? [node] : [];
  return [...own, ...find((node.props as { children?: ReactNode }).children, type)];
}

const load = async (answer: () => Promise<Response>) => {
  templatesAnswer = answer;
  return TemplatesPage();
};
const json = (body: unknown) => async () => new Response(JSON.stringify(body), { status: 200 });

describe('the templates page', () => {
  it('draws the list when there are templates', async () => {
    const page = await load(json({ templates: [{ id: 'a', title: 'Welcome email' }] }));
    expect(find(page, TemplateList)).toHaveLength(1);
    expect(find(page, RefreshErrorState)).toHaveLength(0);
    expect(find(page, EmptyState)).toHaveLength(0);
  });

  it('hands an account with none to the list too, which draws the invitation and keeps focus through a last delete', async () => {
    const page = await load(json({ templates: [] }));
    const [list] = find(page, TemplateList);
    expect(list?.props.templates).toEqual([]);
    expect(list?.props.emptyAction).toBeTruthy();
    expect(find(page, RefreshErrorState)).toHaveLength(0);
    expect(find(page, EmptyState)).toHaveLength(0);
  });

  it('says the load failed, with a retry, when the API answers with an error', async () => {
    const page = await load(async () => new Response('{}', { status: 500 }));
    const [failure] = find(page, RefreshErrorState);
    expect(failure?.props.description).toContain('not a sign that they are gone');
    expect(find(page, EmptyState)).toHaveLength(0);
    expect(find(page, TemplateList)).toHaveLength(0);
  });

  it('treats a request that throws as the same failed load, not an error page', async () => {
    const page = await load(async () => {
      throw new Error('connect ECONNREFUSED');
    });
    expect(find(page, RefreshErrorState)).toHaveLength(1);
    expect(find(page, EmptyState)).toHaveLength(0);
  });
});
