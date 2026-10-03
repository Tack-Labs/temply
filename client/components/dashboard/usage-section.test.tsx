import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import type { Billing } from '~/lib/billing';
import { PLAN_PAGE } from '~/lib/billing';

// Bun shares one process, and one module registry, across test files, and
// `mock.module` outlives the file that made it. The real module is captured
// before it is replaced and put back afterwards, or every file that runs later
// would meet the stand-in, and which files those are depends on the run order.
// The error state reads the router, which has no app to ask here.
const realNavigation = { ...(await import('next/navigation')) };
mock.module('next/navigation', () => ({ ...realNavigation, useRouter: () => ({ refresh: () => {} }) }));
afterAll(() => {
  mock.module('next/navigation', () => realNavigation);
});

const { UsageSection } = await import('./usage-section');

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

type Overrides = {
  plan?: Billing['plan'];
  seats?: number | null;
  usage?: Partial<Billing['usage']>;
  limits?: Partial<Billing['limits']>;
  overage?: Billing['overage'];
};

/** A Team workspace with room to spare: 4,200 of the 10,000 included calls and 4 of its 10 templates. */
function billing({ plan = 'team', seats = 3, usage, limits, overage }: Overrides = {}): Billing {
  return {
    plan,
    status: 'active',
    cancelAt: null,
    trialEndsAt: null,
    seats,
    templatePacks: 0,
    currentPeriodEnd: '2026-11-01T00:00:00Z',
    usage: { templates: 4, apiKeys: 1, apiCalls: 4_200, storageBytes: 0, ...usage },
    limits: {
      maxTemplates: 10,
      maxApiKeys: null,
      maxVersions: 10,
      includedApiCalls: 10_000,
      maxApiCalls: null,
      maxStorageBytes: null,
      ...limits,
    },
    overage: overage ?? { calls: 0, usd: 0 },
    resetsOn: '2026-11-01',
    billingConfigured: true,
  };
}

/** A trial's calls stop at 10,000, where Team's carry on and are billed. */
const trial = (apiCalls: number, templates = 4) =>
  billing({
    plan: 'trial',
    seats: null,
    usage: { apiCalls, templates },
    limits: { maxApiCalls: 10_000 },
  });

const unlimited = {
  maxTemplates: null,
  maxApiKeys: null,
  maxVersions: null,
  includedApiCalls: null,
  maxApiCalls: null,
  maxStorageBytes: null,
};

type View = ReturnType<typeof render>;
const setup = (data: Billing | null, isAdmin = false) => render(<UsageSection billing={data} isAdmin={isAdmin} />);
const calls = (view: View) => view.getByRole('progressbar', { name: 'Live API calls this month' });
const templatesBar = (view: View) => view.getByRole('progressbar', { name: 'Templates' });
const fill = (bar: HTMLElement) => bar.firstElementChild as HTMLElement;

describe('UsageSection API calls', () => {
  it('is accent while there is room, and gives the exact counts a screen reader can read', () => {
    const view = setup(billing());
    const bar = calls(view);
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('10000');
    expect(bar.getAttribute('aria-valuenow')).toBe('4200');
    expect(bar.getAttribute('aria-valuetext')).toBe('4,200 of 10,000 included');
    expect(fill(bar).className).toContain('bg-accent-ink');
    expect(fill(bar).style.width).toBe('42%');
    expect(view.getByText('4,200')).toBeTruthy();
    expect(view.getByText('of 10,000 included')).toBeTruthy();
    expect(view.getByText('5,800 left').className).not.toContain('text-warn-ink');
  });

  it('turns warn near the limit, in the bar and in the words under it', () => {
    const view = setup(billing({ usage: { apiCalls: 8_500 } }));
    expect(fill(calls(view)).className).toContain('bg-warn-ink');
    expect(view.getByText('1,500 left').className).toContain('text-warn-ink');
  });

  it('turns warn at the same count the sidebar does: 79.6% is still 79, so not yet', () => {
    expect(fill(calls(setup(billing({ usage: { apiCalls: 7_960 } })))).className).toContain('bg-accent-ink');
    cleanup();
    expect(fill(calls(setup(billing({ usage: { apiCalls: 8_000 } })))).className).toContain('bg-warn-ink');
  });

  it('draws the bar from the percentage the tone reads, so 79.9% is not a bar at 80 in the accent colour', () => {
    const bar = calls(setup(billing({ usage: { apiCalls: 7_990 } })));
    expect(fill(bar).style.width).toBe('79%');
    expect(fill(bar).className).toContain('bg-accent-ink');
    cleanup();
    const full = calls(setup(billing({ usage: { apiCalls: 9_999 } })));
    expect(fill(full).style.width).toBe('99%');
    expect(fill(full).className).toContain('bg-warn-ink');
  });

  it('keeps warn for billed overage, which carries on rather than stops', () => {
    const view = setup(billing({ usage: { apiCalls: 11_200 }, overage: { calls: 1_200, usd: 1.2 } }));
    const bar = calls(view);
    expect(bar.getAttribute('aria-valuenow')).toBe('10000');
    expect(bar.getAttribute('aria-valuetext')).toBe('11,200 of 10,000 included');
    expect(fill(bar).style.width).toBe('100%');
    expect(fill(bar).className).toContain('bg-warn-ink');
    expect(view.getByText('1,200 over · ~$1.20').className).toContain('text-warn-ink');
  });

  it('is danger at a limit that blocks, and does not call a trial’s ceiling "included"', () => {
    const view = setup(trial(10_000));
    const bar = calls(view);
    expect(bar.getAttribute('aria-valuetext')).toBe('10,000 of 10,000');
    expect(fill(bar).className).toContain('bg-danger-ink');
    expect(view.getByText('Limit reached').className).toContain('text-danger-ink');
  });

  it('gives the figures tabular numerals, and says when the count starts again', () => {
    const view = setup(billing());
    expect(view.getByText('4,200').className).toContain('tabular-nums');
    // The day and month come in the reader's locale order, so only the lead is fixed.
    expect(view.getByText(/^Resets \S/).className).toContain('tabular-nums');
  });
});

describe('UsageSection templates', () => {
  it('measures the count against the plan’s allowance', () => {
    const view = setup(billing());
    const bar = templatesBar(view);
    expect(bar.getAttribute('aria-valuenow')).toBe('4');
    expect(bar.getAttribute('aria-valuemax')).toBe('10');
    expect(bar.getAttribute('aria-valuetext')).toBe('4 of 10');
    expect(fill(bar).className).toContain('bg-accent-ink');
    expect(view.getByText('6 left')).toBeTruthy();
  });

  it('turns warn when the allowance is nearly used', () => {
    const view = setup(billing({ usage: { templates: 9 } }));
    expect(fill(templatesBar(view)).className).toContain('bg-warn-ink');
    expect(view.getByText('1 left').className).toContain('text-warn-ink');
  });

  it('is danger once no more can be made', () => {
    const view = setup(billing({ usage: { templates: 10 } }));
    expect(fill(templatesBar(view)).className).toContain('bg-danger-ink');
    expect(view.getByText('Limit reached').className).toContain('text-danger-ink');
  });
});

describe('UsageSection plans without a bar to fill', () => {
  it('shows counts and no bar when there is no ceiling to measure against', () => {
    const view = setup(billing({ plan: 'enterprise', seats: null, limits: unlimited }));
    expect(view.queryByRole('progressbar')).toBeNull();
    expect(view.getAllByText('no limit')).toHaveLength(2);
    expect(view.getByText('4,200')).toBeTruthy();
  });

  it('is read-only when lapsed: no bars, and the cause in danger', () => {
    const view = setup(billing({ plan: 'lapsed', seats: null, limits: { maxApiCalls: 10_000 }, usage: { apiCalls: 3_000 } }));
    expect(view.queryByRole('progressbar')).toBeNull();
    expect(view.getByText('Live calls paused').className).toContain('text-danger-ink');
    expect(view.getByText('Read-only').className).toContain('text-danger-ink');
    // Nothing is counting down toward a reset while live calls are off.
    expect(view.queryByText(/^Resets/)).toBeNull();
    expect(view.getByText('3,000')).toBeTruthy();
  });
});

describe('UsageSection members', () => {
  it('counts the seats on a Team subscription, and names the price to an admin', () => {
    const view = setup(billing({ seats: 3 }), true);
    expect(view.getByText('Members')).toBeTruthy();
    expect(view.getByText('3')).toBeTruthy();
    expect(view.getByText('$5 each a month')).toBeTruthy();
  });

  it('leaves the price to the page that is for admins', () => {
    const view = setup(billing({ seats: 3 }), false);
    expect(view.getByText('Members')).toBeTruthy();
    expect(view.queryByText(/each a month/)).toBeNull();
  });

  it('has no members tile where seats are not counted, rather than inventing a number', () => {
    expect(setup(trial(100)).queryByText('Members')).toBeNull();
  });
});

describe('UsageSection geometry', () => {
  const headerRow = (view: View) => view.getByRole('heading', { name: 'Usage' }).parentElement;

  it('holds the header row at the height the admin’s button makes it, for a member too', () => {
    // The loading skeleton is h-7, h-11 on a coarse pointer, and cannot know the role.
    for (const isAdmin of [true, false]) {
      const row = headerRow(setup(billing(), isAdmin));
      expect(row?.className).toContain('min-h-7');
      expect(row?.className).toContain('pointer-coarse:min-h-11');
      cleanup();
    }
  });

  it('holds the note line on a plan with no limit, where the date it carries is empty until hydration', () => {
    const view = setup(billing({ plan: 'enterprise', seats: null, limits: unlimited }));
    const note = view.getByText('Live API calls this month').parentElement?.querySelector('.min-h-4\\.5');
    expect(note).not.toBeNull();
  });
});

describe('UsageSection plan link', () => {
  it('sends an admin to the plan page, with a target that grows on a touch screen', () => {
    const link = setup(billing(), true).getByRole('link', { name: 'Manage plan' });
    expect(link.getAttribute('href')).toBe(PLAN_PAGE);
    expect(link.className).toContain('pointer-coarse:h-11');
  });

  it('does not send a member to a page they cannot open', () => {
    expect(setup(billing(), false).queryByRole('link', { name: 'Manage plan' })).toBeNull();
  });
});

describe('UsageSection when billing could not be read', () => {
  it('says so, apart from the rest of the page, instead of drawing a free plan’s zeroes', () => {
    const view = setup(null, true);
    expect(view.getByRole('region', { name: 'Usage' })).toBeTruthy();
    expect(view.getByText('Usage could not be loaded').className).toContain('text-danger-ink');
    expect(view.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(view.queryByRole('progressbar')).toBeNull();
    expect(view.queryByText('0')).toBeNull();
  });
});

describe('UsageSection theming', () => {
  it('is on the theme tokens: no rail palette, and the bar’s width the only inline style', () => {
    for (const data of [billing(), trial(10_000), billing({ plan: 'lapsed' }), billing({ plan: 'enterprise', limits: unlimited }), null]) {
      const view = setup(data, true);
      const html = view.container.innerHTML;
      expect(html).not.toContain('rail-');
      for (const style of html.matchAll(/style="([^"]*)"/g)) expect(style[1]).toMatch(/^width: [\d.]+%;?$/);
      cleanup();
    }
  });
});
