import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { Billing } from '~/lib/billing';

// The page is an async server component, read here as the element tree it
// returns rather than rendered: what is under test is what it asks for and
// when, and what it hands the pieces when an answer fails. The pieces have
// tests of their own.
//
// Bun shares one process, and one module registry, across test files, and
// `mock.module` outlives the file that made it. The real modules are captured
// before they are replaced and put back afterwards, or every file that runs
// later would meet the stand-ins, and which files those are depends on the
// run order.
const realClerk = { ...(await import('@clerk/nextjs/server')) };
const realServerFetch = { ...(await import('~/lib/server-fetch')) };

type Answer = () => Promise<Response>;
type Person = { firstName: string | null } | null;

let signedIn = true;
let role: string | null = 'org:admin';
let user: () => Promise<Person> = async () => ({ firstName: 'Ada' });
let templates: Answer = async () => new Response('{}');
let billing: Answer = async () => new Response('{}');
/** What was asked for, in the order it was asked. */
let asked: string[] = [];

mock.module('@clerk/nextjs/server', () => ({
  ...realClerk,
  auth: async () => ({ userId: signedIn ? 'user_1' : null, orgRole: role }),
  currentUser: () => {
    asked.push('user');
    return user();
  },
}));
mock.module('~/lib/server-fetch', () => ({
  ...realServerFetch,
  serverFetch: (path: string) => {
    asked.push(path);
    return path === '/api/v1/templates' ? templates() : billing();
  },
}));
afterAll(() => {
  mock.module('@clerk/nextjs/server', () => realClerk);
  mock.module('~/lib/server-fetch', () => realServerFetch);
});

const { default: DashboardPage } = await import('./page');
const { NewTemplateButton } = await import('~/components/dashboard/new-template-button');
const { NextStepBanner } = await import('~/components/dashboard/next-step-banner');
const { RecentTemplates } = await import('~/components/dashboard/recent-templates');
const { StarterChips } = await import('~/components/dashboard/starter-chips');
const { UsageSection } = await import('~/components/dashboard/usage-section');
const { PageHeader } = await import('~/components/ui/surfaces');

/** Every element of `type` anywhere in what the page returned. */
function find(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child) => find(child, type));
  if (!isValidElement(node)) return [];
  const own = node.type === type ? [node as ReactElement<Record<string, unknown>>] : [];
  return [...own, ...find((node.props as { children?: ReactNode }).children, type)];
}

const json = (body: unknown): Answer => async () => new Response(JSON.stringify(body), { status: 200 });
const refused: Answer = async () => new Response('{}', { status: 500 });
const unreachable: Answer = async () => {
  throw new Error('connect ECONNREFUSED');
};

const TEAM: Billing = {
  plan: 'team',
  status: 'active',
  cancelAt: null,
  trialEndsAt: null,
  seats: 3,
  templatePacks: 0,
  currentPeriodEnd: '2026-11-01T00:00:00Z',
  usage: { templates: 4, apiKeys: 1, apiCalls: 4_200, storageBytes: 0 },
  limits: {
    maxTemplates: 10,
    maxApiKeys: null,
    maxVersions: 10,
    includedApiCalls: 10_000,
    maxApiCalls: null,
    maxStorageBytes: null,
  },
  overage: { calls: 0, usd: 0 },
  resetsOn: '2026-11-01',
  billingConfigured: true,
};

const STAMP = '2026-10-05T09:00:00.000Z';
/** Live: publishing writes one stamp to both columns, so equal stamps are "nothing ahead of what is live". */
const live = (id: string, patch: Record<string, unknown> = {}) => ({
  id, title: `Title ${id}`, updated_at: STAMP, published_at: STAMP, has_unpublished_changes: false, ...patch,
});
const waiting = (id: string) =>
  live(id, { staged_at: '2026-10-05T11:00:00.000Z', review_requested_at: '2026-10-05T12:00:00.000Z' });

beforeEach(() => {
  signedIn = true;
  role = 'org:admin';
  asked = [];
  user = async () => ({ firstName: 'Ada' });
  templates = json({ templates: [{ id: 'a', title: 'Welcome email' }] });
  billing = json(TEAM);
});

const title = (page: ReactNode) => find(page, PageHeader)[0]?.props.title;
const usageBilling = (page: ReactNode) => find(page, UsageSection)[0]?.props.billing;
const banner = (page: ReactNode) => find(page, NextStepBanner)[0];
const chips = (page: ReactNode) => find(page, StarterChips)[0];
const newButton = (page: ReactNode) => find(find(page, PageHeader)[0]?.props.actions as ReactNode, NewTemplateButton)[0];

describe('the dashboard home asking for what it shows', () => {
  it('starts the user, billing and templates lookups together, not one behind another', async () => {
    const release: Array<() => void> = [];
    const held = (answer: () => Response | Person): Promise<never> =>
      new Promise((resolve) => release.push(() => resolve(answer() as never)));
    user = () => held(() => ({ firstName: 'Ada' }));
    templates = () => held(() => new Response(JSON.stringify({ templates: [] })));
    billing = () => held(() => new Response(JSON.stringify(TEAM)));

    const page = DashboardPage();
    // Nothing has answered, so anything asked now was asked without waiting for another.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect([...asked].sort()).toEqual(['/api/v1/billing', '/api/v1/templates', 'user']);

    for (const answer of release) answer();
    expect(title(await page)).toBe('Welcome back, Ada');
  });

  it('asks for nothing when no one is signed in', async () => {
    signedIn = false;
    await expect(DashboardPage()).rejects.toBeDefined();
    expect(asked).toEqual([]);
  });
});

describe('the dashboard home heading', () => {
  it('greets by first name', async () => {
    expect(title(await DashboardPage())).toBe('Welcome back, Ada');
  });

  it('is plain "Welcome back" when there is no first name to put in it', async () => {
    user = async () => ({ firstName: null });
    expect(title(await DashboardPage())).toBe('Welcome back');
    user = async () => null;
    expect(title(await DashboardPage())).toBe('Welcome back');
  });
});

describe('the dashboard home when one answer fails', () => {
  it('hands the usage section the billing it was given, and the templates their list', async () => {
    const page = await DashboardPage();
    expect(usageBilling(page)).toEqual(TEAM);
    expect(find(page, RecentTemplates)[0]?.props.failed).toBe(false);
    expect(find(page, RecentTemplates)[0]?.props.templates).toHaveLength(1);
  });

  it('says billing could not be read when it is refused, or never answers, and still lists the templates', async () => {
    for (const answer of [refused, unreachable]) {
      billing = answer;
      const page = await DashboardPage();
      expect(usageBilling(page)).toBeNull();
      expect(find(page, RecentTemplates)[0]?.props.failed).toBe(false);
      expect(find(page, RecentTemplates)[0]?.props.templates).toHaveLength(1);
    }
  });

  it('treats an ok billing body without its usage as a failed load, not an error page', async () => {
    for (const body of [{}, { plan: 'team' }, { ...TEAM, usage: undefined }, { ...TEAM, limits: undefined }, { ...TEAM, overage: undefined }]) {
      billing = json(body);
      const page = await DashboardPage();
      expect(usageBilling(page)).toBeNull();
      // The failure stays in the section: the rest of the page is drawn.
      expect(find(page, RecentTemplates)[0]?.props.failed).toBe(false);
      expect(newButton(page)?.props.disabled).toBe(false);
    }
  });

  it('treats a billing body that is not JSON the same way', async () => {
    billing = async () => new Response('<html>bad gateway</html>', { status: 200 });
    expect(usageBilling(await DashboardPage())).toBeNull();
  });

  it('says the templates could not be read, whatever the cause, and keeps the usage', async () => {
    for (const answer of [refused, unreachable, async () => new Response('not json', { status: 200 })]) {
      templates = answer;
      const page = await DashboardPage();
      const [recent] = find(page, RecentTemplates);
      expect(recent?.props.failed).toBe(true);
      expect(recent?.props.templates).toEqual([]);
      expect(usageBilling(page)).toEqual(TEAM);
    }
  });

  it('says the templates could not be read when an ok answer is not a list of them, rather than an account with none', async () => {
    const wrong = [
      {},
      { error: 'upstream' },
      { templates: null },
      { templates: 'none' },
      { templates: { id: 'a' } },
      { templates: [null] },
      { templates: [{ title: 'No id' }] },
      [],
    ];
    for (const body of wrong) {
      templates = json(body);
      const page = await DashboardPage();
      const [recent] = find(page, RecentTemplates);
      expect(recent?.props.failed, JSON.stringify(body)).toBe(true);
      expect(recent?.props.templates).toEqual([]);
      // A failed list is not a clean account, so the banner says nothing either way.
      expect(banner(page)?.props.template).toBeNull();
      expect(usageBilling(page)).toEqual(TEAM);
    }
  });

  it('still reads an empty list as an account with no templates', async () => {
    templates = json({ templates: [] });
    const [recent] = find(await DashboardPage(), RecentTemplates);
    expect(recent?.props.failed).toBe(false);
    expect(recent?.props.templates).toEqual([]);
  });

  it('shows the five most recent, and only what a card draws', async () => {
    templates = json({
      templates: Array.from({ length: 7 }, (_, index) => ({ id: `t${index}`, title: `T${index}`, content: 'x', theme: 'y' })),
    });
    const [recent] = find(await DashboardPage(), RecentTemplates);
    const shown = recent?.props.templates as Array<Record<string, unknown>>;
    expect(shown.map((row) => row.id)).toEqual(['t0', 't1', 't2', 't3', 't4']);
    expect(shown[0]).not.toHaveProperty('content');
    expect(shown[0]).not.toHaveProperty('theme');
  });

  it('carries the stage a card’s pill is read from, and leaves a missing one empty rather than undefined', async () => {
    templates = json({ templates: [waiting('w'), { id: 'bare', title: 'Bare' }] });
    const [recent] = find(await DashboardPage(), RecentTemplates);
    const [first, second] = (recent?.props.templates ?? []) as Array<Record<string, unknown>>;
    expect(first).toMatchObject({
      staged_at: '2026-10-05T11:00:00.000Z',
      review_requested_at: '2026-10-05T12:00:00.000Z',
      returned_at: null,
    });
    expect(second).toMatchObject({ staged_at: null, review_requested_at: null, returned_at: null });
  });
});

describe('the dashboard home next step', () => {
  it('is the template in sign-off, and hands the banner only that one', async () => {
    templates = json({ templates: [live('a'), waiting('w'), live('b')] });
    const picked = banner(await DashboardPage())?.props.template as Record<string, unknown>;
    expect(picked.id).toBe('w');
    expect(picked).not.toHaveProperty('content');
  });

  it('looks past the five a card shows, since a template waiting for sign-off is not to be missed', async () => {
    templates = json({ templates: [...Array.from({ length: 8 }, (_, index) => live(`l${index}`)), waiting('buried')] });
    const page = await DashboardPage();
    expect((banner(page)?.props.template as { id: string } | null)?.id).toBe('buried');
    const shown = find(page, RecentTemplates)[0]?.props.templates as Array<{ id: string }>;
    expect(shown.map((row) => row.id)).not.toContain('buried');
  });

  it('knows whether the reader can sign off', async () => {
    templates = json({ templates: [waiting('w')] });
    expect(banner(await DashboardPage())?.props.isAdmin).toBe(true);
    role = 'org:member';
    expect(banner(await DashboardPage())?.props.isAdmin).toBe(false);
    role = null;
    expect(banner(await DashboardPage())?.props.isAdmin).toBe(false);
  });

  it('has nothing to say when every template is live, or there are none', async () => {
    templates = json({ templates: [live('a'), live('b')] });
    expect(banner(await DashboardPage())?.props.template).toBeNull();
    templates = json({ templates: [] });
    expect(banner(await DashboardPage())?.props.template).toBeNull();
  });

  it('has nothing to say when the list could not be read, since a failure is not a clean account', async () => {
    templates = refused;
    expect(banner(await DashboardPage())?.props.template).toBeNull();
  });

  it('is kept in the tree with nothing to show, so it is there to grow in when a refresh finds something', async () => {
    templates = json({ templates: [live('a')] });
    const kept = banner(await DashboardPage());
    expect(kept).toBeDefined();
    expect(kept?.props.template).toBeNull();
  });
});

describe('the dashboard home order', () => {
  it('runs the next step, the starters, the recent templates and then usage', async () => {
    const sections: unknown[] = [PageHeader, NextStepBanner, StarterChips, RecentTemplates, UsageSection];
    const inOrder = (node: ReactNode): unknown[] => {
      if (Array.isArray(node)) return node.flatMap(inOrder);
      if (!isValidElement(node)) return [];
      const own = sections.includes(node.type) ? [node.type] : [];
      return [...own, ...inOrder((node.props as { children?: ReactNode }).children)];
    };
    expect(inOrder(await DashboardPage())).toEqual(sections);
  });
});

describe('the dashboard home starters', () => {
  it('are offered on an account with no templates, which is where they matter most', async () => {
    templates = json({ templates: [] });
    expect(chips(await DashboardPage())?.props.disabled).toBe(false);
  });

  it('are still offered when the list could not be read, since making a template does not need it', async () => {
    templates = refused;
    expect(chips(await DashboardPage())?.props.disabled).toBe(false);
  });

  it('are held at the template limit and when the workspace is read-only, and only then', async () => {
    expect(chips(await DashboardPage())?.props.disabled).toBe(false);

    billing = json({ ...TEAM, usage: { ...TEAM.usage, templates: 10 } });
    expect(chips(await DashboardPage())?.props.disabled).toBe(true);

    billing = json({ ...TEAM, plan: 'lapsed' });
    expect(chips(await DashboardPage())?.props.disabled).toBe(true);
  });

  it('are offered when billing could not be read, rather than blocking on a guess', async () => {
    billing = refused;
    expect(chips(await DashboardPage())?.props.disabled).toBe(false);
  });
});

describe('the dashboard home controls', () => {
  it('takes away "New template" at the template limit and when the workspace is read-only, and only then', async () => {
    expect(newButton(await DashboardPage())?.props.disabled).toBe(false);

    billing = json({ ...TEAM, usage: { ...TEAM.usage, templates: 10 } });
    expect(newButton(await DashboardPage())?.props.disabled).toBe(true);

    billing = json({ ...TEAM, plan: 'lapsed' });
    expect(newButton(await DashboardPage())?.props.disabled).toBe(true);
  });

  it('tells the empty state whether anything can be made, so it points at the starters only when they work', async () => {
    templates = json({ templates: [] });
    expect(find(await DashboardPage(), RecentTemplates)[0]?.props.canCreate).toBe(true);

    billing = json({ ...TEAM, usage: { ...TEAM.usage, templates: 10 } });
    expect(find(await DashboardPage(), RecentTemplates)[0]?.props.canCreate).toBe(false);

    billing = json({ ...TEAM, plan: 'lapsed' });
    expect(find(await DashboardPage(), RecentTemplates)[0]?.props.canCreate).toBe(false);
  });
});
