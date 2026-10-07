import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import * as plans from '@temply/shared/plans';
import { INCLUDED, PLAN_LABELS, PRICES_USD, TEMPLATE_PACK, TRIAL_DAYS } from '@temply/shared/plans';
import { formatBytes } from '@temply/shared/bytes';
import HomeContent from './home-client';

afterEach(cleanup);

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const MB = 1024 * 1024;

/** The rules as the page is rendered against them, each off its real value and
 *  off the others'. The trial's and Team's limits differ from each other on
 *  purpose: a card reading the other plan's would show it. */
const MOVED = {
  trialDays: 21,
  seat: 7,
  overage: 2,
  pack: 9,
  trial: { storage: 250 * MB, keys: 7, brands: 9 },
  team: { storage: 2048 * MB, keys: 8, brands: 6 },
  enterpriseVersions: 240,
};

// Bun shares one module registry across test files and `mock.module` outlives
// the file that made it, so the real rules are captured before the mock and
// put back after each render.
const realPlans = { ...plans };
afterAll(() => {
  mock.module('@temply/shared/plans', () => realPlans);
});

// A figure typed into the page is one that survives the next plan change, so
// the page is rendered with every rule it quotes moved off its real value and
// put back afterwards, which is the only way to tell a figure read from one
// typed. The prices, the included allowance and the template pack are objects
// and are changed in place; the trial length and the limits `limitsFor` returns
// are a constant and a function, so they go through a module mock. The moved
// values are all different from the real ones, so a stale figure left in the
// markup cannot pass for a new one.
function withMovedRules<T>(render: () => T): T {
  const prices = PRICES_USD as Mutable<typeof PRICES_USD>;
  const included = INCLUDED as Mutable<typeof INCLUDED>;
  const pack = TEMPLATE_PACK as Mutable<typeof TEMPLATE_PACK>;
  const before = { prices: { ...prices }, included: { ...included }, pack: { ...pack } };
  Object.assign(prices, { seat: MOVED.seat, overagePer1000Calls: MOVED.overage, templatePack: MOVED.pack });
  Object.assign(included, { apiCalls: 25_000, templates: 12, versionsPerTemplate: 8 });
  Object.assign(pack, { templates: 15, versionsPerTemplate: 60 });
  mock.module('@temply/shared/plans', () => ({
    ...realPlans,
    TRIAL_DAYS: MOVED.trialDays,
    limitsFor: (plan: plans.Plan, templatePacks?: number) => {
      const limits = realPlans.limitsFor(plan, templatePacks);
      if (plan === 'trial') {
        return { ...limits, maxStorageBytes: MOVED.trial.storage, maxApiKeys: MOVED.trial.keys, maxBrands: MOVED.trial.brands };
      }
      if (plan === 'team') {
        return { ...limits, maxStorageBytes: MOVED.team.storage, maxApiKeys: MOVED.team.keys, maxBrands: MOVED.team.brands };
      }
      if (plan === 'enterprise') return { ...limits, maxVersions: MOVED.enterpriseVersions };
      return limits;
    },
  }));
  try {
    return render();
  } finally {
    mock.module('@temply/shared/plans', () => realPlans);
    Object.assign(prices, before.prices);
    Object.assign(included, before.included);
    Object.assign(pack, before.pack);
  }
}

describe('the home page hero', () => {
  it('quotes the trial length and seat price from the plan rules', () => {
    const view = withMovedRules(() => render(<HomeContent />));
    expect(view.getByText(new RegExp(`^${MOVED.trialDays} days free, then \\$${MOVED.seat} per person a month\\.`))).toBeTruthy();
  });
});

describe('the pricing section', () => {
  it('states every price and limit from the plan rules', () => {
    const view = withMovedRules(() => render(<HomeContent />));
    const pricing = view.container.querySelector<HTMLElement>('#pricing')!;
    const card = (name: string) => within(pricing).getByRole('group', { name, exact: true }).textContent!;

    const lead = pricing.querySelector('h2')!.parentElement!.textContent!;
    expect(lead).toContain(`${MOVED.trialDays} days free`);

    const trialText = card(PLAN_LABELS.trial);
    for (const figure of [
      '$0',
      `for ${MOVED.trialDays} days`,
      'Every new workspace starts here. No card needed.',
      // Capped at the included calls, which is the trial's own limit.
      '25,000 live API calls',
      '12 templates, 8 versions of each',
      `${formatBytes(MOVED.trial.storage)} of storage`,
      `${MOVED.trial.keys} live keys and ${MOVED.trial.brands} brands`,
      'When it ends, the workspace turns read-only until someone subscribes. Nothing is deleted.',
    ]) {
      expect(trialText, figure).toContain(figure);
    }
    // It offers no link of its own: the page's three trial calls to action are
    // the hero, the Team card and the closing band.
    expect(within(pricing).getByRole('group', { name: PLAN_LABELS.trial, exact: true }).querySelectorAll('a')).toHaveLength(0);
    // Nor does it read the Team plan's limits.
    expect(trialText).not.toContain(formatBytes(MOVED.team.storage));
    expect(trialText).not.toContain(`${MOVED.team.keys} live keys`);

    const teamText = card(PLAN_LABELS.team);
    for (const figure of [
      '$7',
      'per user a month',
      '3 users × $7',
      '$21 a month',
      '25,000 live API calls a month',
      'Then $2 per 1,000 calls, pro rata, on the next invoice',
      '12 templates, 8 versions of each',
      `${formatBytes(MOVED.team.storage)} of storage`,
      `${MOVED.team.keys} live keys and ${MOVED.team.brands} brands`,
    ]) {
      expect(teamText, figure).toContain(figure);
    }
    expect(teamText).not.toContain(formatBytes(MOVED.trial.storage));

    expect(card(PLAN_LABELS.enterprise)).toContain(`${MOVED.enterpriseVersions} versions of each`);

    const packText = card('Template pack');
    for (const figure of ['+15 templates for each pack', 'last 60 versions instead of 8', '$9', 'per pack a month']) {
      expect(packText, figure).toContain(figure);
    }

    // The real figures are all gone: nothing in the section is a typed copy.
    for (const stale of ['$5', '10,000', '+10 templates', '50 versions', 'of 10', '14 days', '100 MB', '1 GB', '5 live keys', '5 brands', '100 versions']) {
      expect(pricing.textContent, `a typed "${stale}"`).not.toContain(stale);
    }
  });

  it('claims for Enterprise only what the plan rules give it', () => {
    // The card types these three lines, as there is no figure in them to
    // format. They hold while the rules leave every one of these limits
    // unbounded, and this fails the day one of them gets a number, so the
    // card is changed with the rule and not after a customer reads it.
    const view = render(<HomeContent />);
    const pricing = view.container.querySelector<HTMLElement>('#pricing')!;
    const text = within(pricing).getByRole('group', { name: PLAN_LABELS.enterprise, exact: true }).textContent!;
    const limits = realPlans.limitsFor('enterprise');
    const claims: Array<[string, Array<keyof plans.PlanLimits>]> = [
      ['Unlimited templates', ['maxTemplates']],
      ['Unlimited keys, brands and storage', ['maxApiKeys', 'maxBrands', 'maxStorageBytes']],
      ['API volume agreed with you', ['includedApiCalls', 'maxApiCalls']],
    ];
    for (const [claim, fields] of claims) {
      expect(text, claim).toContain(claim);
      for (const field of fields) expect(limits[field], `"${claim}" needs ${field} unbounded`).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it('leads with the trial, then Team, then Enterprise, the order a workspace meets them in', () => {
    const view = render(<HomeContent />);
    const pricing = view.container.querySelector<HTMLElement>('#pricing')!;
    const names = within(pricing)
      .getAllByRole('group')
      .map((group) => group.getAttribute('aria-labelledby'))
      .filter((id) => id?.startsWith('tier-'));
    expect(names).toEqual(['tier-free-trial', 'tier-team', 'tier-enterprise', 'tier-template-pack']);
  });

  it('renders the stepper at three users in the markup a server sends', () => {
    const html = renderToString(<HomeContent />);
    expect(html).toContain('3 users × $5');
    expect(html).toContain('<span class="sr-only">3 users</span>');
  });

  it('keeps the caching advice and its link in the footnote, after the broadcast sentence', () => {
    const view = render(<HomeContent />);
    const pricing = view.container.querySelector<HTMLElement>('#pricing')!;
    const link = within(pricing).getByRole('link', { name: 'How to cache' });
    expect(link.getAttribute('href')).toBe('/docs#caching');
    const note = link.closest('p')!.textContent!;
    expect(note.indexOf('Render a broadcast once and send the same HTML to everyone')).toBeGreaterThan(-1);
    expect(note.indexOf('updatedAt')).toBeGreaterThan(note.indexOf('Render a broadcast once'));
    expect(note.indexOf('How to cache')).toBeGreaterThan(note.indexOf('updatedAt'));
    expect(note).toContain('Prices are in US dollars, before tax. Payments are processed by Stripe.');
  });
});

describe('the closing band', () => {
  it('is a region named by its heading, with the trial length and one call to action', () => {
    const view = render(<HomeContent />);
    const band = view.getByRole('region', { name: 'Ready when you are' });
    expect(within(band).getByRole('heading', { level: 2 }).textContent).toBe('Ready when you are');
    expect(band.textContent).toContain(`${TRIAL_DAYS} days free, no card needed.`);
    expect(within(band).getAllByRole('link')).toHaveLength(1);
  });

  it('hides its decorative shapes from assistive technology', () => {
    const view = render(<HomeContent />);
    const band = view.getByRole('region', { name: 'Ready when you are' });
    const shapes = band.querySelectorAll('[aria-hidden="true"]');
    // The arrow in the button is one; the two shapes are the others.
    expect(shapes.length).toBeGreaterThanOrEqual(3);
    for (const shape of shapes) expect(shape.textContent).toBe('');
  });
});

describe('the trial calls to action', () => {
  it('all go to the sign-up route the hero uses', () => {
    const view = render(<HomeContent />);
    const links = view.getAllByRole('link', { name: 'Start your free trial' });
    // The hero, the Team card and the closing band.
    expect(links).toHaveLength(3);
    for (const link of links) expect(link.getAttribute('href')).toBe('/sign-up');
  });
});
