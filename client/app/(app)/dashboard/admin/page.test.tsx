import { afterAll, beforeEach, expect, mock, test } from 'bun:test';
import { isValidElement, type ReactNode } from 'react';

const realClerk = { ...(await import('@clerk/nextjs/server')) };
const realFetch = { ...(await import('~/lib/server-fetch')) };
let identity = { userId: 'user_owner' as string | null, orgId: 'org_temply' as string | null, orgRole: 'org:admin' };
let answer: () => Promise<Response>;
let paths: string[];

mock.module('@clerk/nextjs/server', () => ({ ...realClerk, auth: async () => identity }));
mock.module('~/lib/server-fetch', () => ({
  ...realFetch,
  serverFetch: (path: string) => { paths.push(path); return answer(); },
}));
afterAll(() => {
  mock.module('@clerk/nextjs/server', () => realClerk);
  mock.module('~/lib/server-fetch', () => realFetch);
});

const { default: AdminPage } = await import('./page');
const { OrganizationDirectory } = await import('~/components/admin/organization-directory');
const { RefreshErrorState } = await import('~/components/dashboard/refresh-error-state');

function contains(node: ReactNode, type: unknown): boolean {
  if (Array.isArray(node)) return node.some((child) => contains(child, type));
  if (!isValidElement<{ children?: ReactNode }>(node)) return false;
  return node.type === type || contains(node.props.children, type);
}

beforeEach(() => {
  identity = { userId: 'user_owner', orgId: 'org_temply', orgRole: 'org:admin' };
  paths = [];
  answer = async () => Response.json({ organizations: [], totalCount: 0, page: 1, pageSize: 25, period: '2026-10' });
});
const page = (params: { page?: string; q?: string } = {}) => AdminPage({ searchParams: Promise.resolve(params) });

test('requires a signed-in workspace admin before requesting customer data', async () => {
  identity.userId = null;
  await expect(page()).rejects.toThrow('NEXT_REDIRECT');
  identity.userId = 'user_owner';
  identity.orgRole = 'org:member';
  await expect(page()).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  identity.orgRole = 'org:admin';
  identity.orgId = null;
  await expect(page()).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  expect(paths).toEqual([]);
});

test('uses backend authorization even when the session says admin', async () => {
  answer = async () => Response.json({}, { status: 403 });
  await expect(page()).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
});

test('shows an error with retry for a failed directory, never an empty signup count', async () => {
  for (const failure of [
    async () => Response.json({}, { status: 500 }),
    async () => { throw new Error('Unavailable'); },
    async () => new Response('broken JSON'),
  ]) {
    answer = failure;
    const rendered = await page();
    expect(contains(rendered, RefreshErrorState)).toBe(true);
    expect(contains(rendered, OrganizationDirectory)).toBe(false);
  }
});

test('passes successful data to the directory and encodes search input', async () => {
  const rendered = await page({ page: '2', q: ' Acme & Co ' });
  expect(contains(rendered, OrganizationDirectory)).toBe(true);
  expect(paths).toEqual(['/api/v1/admin/organizations?page=2&q=Acme+%26+Co']);
});

test('bounds page and search input before it reaches the API', async () => {
  await page({ page: '-2', q: 'a'.repeat(120) });
  const url = new URL(paths[0], 'http://localhost');
  expect(url.searchParams.get('page')).toBe('1');
  expect(url.searchParams.get('q')).toHaveLength(100);
});
