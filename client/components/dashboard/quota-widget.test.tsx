import { afterEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import type { Quota } from '~/lib/billing';
import { PLAN_PAGE } from '~/lib/billing';
import { QuotaCard, QuotaPanel, usagePct } from './quota-widget';

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

const DAY = 86_400_000;

function quota(overrides: Partial<Quota> & { api?: Partial<Quota['api']> } = {}): Quota {
  const { api, ...rest } = overrides;
  return {
    plan: 'team',
    cancelAt: null,
    trialEndsAt: null,
    api: { used: 1_200, limit: null, included: 10_000, remaining: null, ...api },
    overage: { calls: 0, usd: 0 },
    resetsOn: '2026-11-01',
    ...rest,
  };
}

// The trial's end is half a day past the Nth midnight, so the day count does
// not wobble with the minute the suite runs in.
const trial = (days: number, used: number): Quota =>
  quota({
    plan: 'trial',
    trialEndsAt: new Date(Date.now() + (days - 0.5) * DAY).toISOString(),
    api: { used, limit: 10_000, included: 10_000, remaining: Math.max(0, 10_000 - used) },
  });

const bar = (view: ReturnType<typeof render>) => view.getByRole('progressbar');
const fill = (view: ReturnType<typeof render>) => bar(view).firstElementChild as HTMLElement;

describe('QuotaCard severity', () => {
  it('is accent while there is room, and says how far along it is', () => {
    const view = render(<QuotaCard data={quota({ api: { used: 4_200 } })} isAdmin={false} />);
    expect(bar(view).getAttribute('aria-valuenow')).toBe('42');
    expect(bar(view).getAttribute('aria-label')).toBe('4,200 of 10,000 included monthly API calls used');
    expect(fill(view).className).toContain('bg-accent-ink');
    expect(fill(view).style.width).toBe('42%');
    expect(view.getByText('42% used').className).not.toContain('text-warn-ink');
  });

  it('turns warn near the limit, in the bar and in the words under it', () => {
    const view = render(<QuotaCard data={quota({ api: { used: 8_500 } })} isAdmin={false} />);
    expect(fill(view).className).toContain('bg-warn-ink');
    expect(view.getByText('85% used').className).toContain('text-warn-ink');
  });

  it('keeps warn for billed overage, which carries on rather than stops', () => {
    const view = render(
      <QuotaCard data={quota({ api: { used: 11_200 }, overage: { calls: 1_200, usd: 1.2 } })} isAdmin={false} />,
    );
    expect(bar(view).getAttribute('aria-valuenow')).toBe('100');
    expect(fill(view).style.width).toBe('100%');
    expect(fill(view).className).toContain('bg-warn-ink');
    const note = view.getByText('1,200 over · ~$1.20');
    expect(note.className).toContain('text-warn-ink');
    expect(note.className).toContain('tabular-nums');
  });

  it('is danger at a limit that blocks', () => {
    const view = render(<QuotaCard data={trial(5, 10_000)} isAdmin={false} />);
    expect(fill(view).className).toContain('bg-danger-ink');
    expect(view.getByText('Limit reached').className).toContain('text-danger-ink');
  });
});

describe('usagePct', () => {
  it('rounds down, so 100 means at or past the cap and not nearly', () => {
    expect(usagePct(9_950, 10_000)).toBe(99);
    expect(usagePct(9_999, 10_000)).toBe(99);
    expect(usagePct(10_000, 10_000)).toBe(100);
  });

  it('is not thrown by floating point: 29 of 100 is 29, not 28.999…', () => {
    expect(usagePct(29, 100)).toBe(29);
    expect(usagePct(57, 100)).toBe(57);
  });

  it('holds to 0-100 whatever the count', () => {
    expect(usagePct(0, 10_000)).toBe(0);
    expect(usagePct(-5, 10_000)).toBe(0);
    expect(usagePct(11_200, 10_000)).toBe(100);
  });

  it('is 0 with nothing to measure against', () => {
    expect(usagePct(50, 0)).toBe(0);
  });
});

describe('QuotaCard at the edges of its scale', () => {
  it('reads 99% just under the cap, in warn and not yet in danger', () => {
    const view = render(<QuotaCard data={trial(5, 9_999)} isAdmin={false} />);
    expect(bar(view).getAttribute('aria-valuenow')).toBe('99');
    expect(fill(view).style.width).toBe('99%');
    expect(fill(view).className).toContain('bg-warn-ink');
    expect(view.getByText('99% used').className).toContain('text-warn-ink');
    expect(view.queryByText('Limit reached')).toBeNull();
  });

  it('shows 99% for 9,999 of the included calls on a plan with no limit', () => {
    const view = render(<QuotaCard data={quota({ api: { used: 9_999 } })} isAdmin={false} />);
    expect(bar(view).getAttribute('aria-valuenow')).toBe('99');
    expect(view.getByText('99% used')).toBeTruthy();
  });

  it('sits empty at zero, with the bar still named', () => {
    const view = render(<QuotaCard data={quota({ api: { used: 0 } })} isAdmin={false} />);
    expect(bar(view).getAttribute('aria-valuenow')).toBe('0');
    expect(bar(view).getAttribute('aria-label')).toBe('0 of 10,000 included monthly API calls used');
    expect(fill(view).style.width).toBe('0%');
    expect(view.getByText('0% used')).toBeTruthy();
  });

  it('does not run the bar backwards for a count below zero', () => {
    const view = render(<QuotaCard data={quota({ api: { used: -40 } })} isAdmin={false} />);
    expect(bar(view).getAttribute('aria-valuenow')).toBe('0');
    expect(fill(view).style.width).toBe('0%');
  });

  it('stops the bar at the end of its track past a limit that blocks', () => {
    const view = render(<QuotaCard data={trial(5, 12_000)} isAdmin={false} />);
    expect(bar(view).getAttribute('aria-valuenow')).toBe('100');
    expect(fill(view).style.width).toBe('100%');
    expect(fill(view).className).toContain('bg-danger-ink');
    expect(view.getByText('Limit reached')).toBeTruthy();
  });
});

describe('QuotaCard trial', () => {
  it('names the days left as an accent badge, and offers a subscribe to an admin', () => {
    const view = render(<QuotaCard data={trial(9, 4_200)} isAdmin />);
    expect(view.getByText('Free trial')).toBeTruthy();
    expect(view.getByText('9 days left').className).toContain('text-accent-ink');
    const subscribe = view.getByRole('link', { name: 'Subscribe' });
    expect(subscribe.getAttribute('href')).toBe(PLAN_PAGE);
    expect(subscribe.className).toContain('pointer-coarse:h-11');
  });

  it('turns the badge warn once the end is close', () => {
    const view = render(<QuotaCard data={trial(2, 100)} isAdmin />);
    expect(view.getByText('2 days left').className).toContain('text-warn-ink');
  });

  it('leaves the subscribe to whoever can act on it', () => {
    const view = render(<QuotaCard data={trial(9, 4_200)} isAdmin={false} />);
    expect(view.queryByRole('link', { name: 'Subscribe' })).toBeNull();
  });
});

describe('QuotaCard plans without a bar to fill', () => {
  it('is read-only when lapsed: no bar, the cause in danger, and the way out for an admin', () => {
    const lapsed = quota({ plan: 'lapsed', api: { used: 3_000, limit: 10_000, included: 10_000, remaining: 7_000 } });
    const view = render(<QuotaCard data={lapsed} isAdmin />);
    expect(view.queryByRole('progressbar')).toBeNull();
    expect(view.getByText('Read-only')).toBeTruthy();
    expect(view.getByText('Live keys paused').className).toContain('text-danger-ink');
    expect(view.getByRole('link', { name: 'Subscribe' }).getAttribute('href')).toBe(PLAN_PAGE);
  });

  it('tells a member of a lapsed workspace who can fix it, and offers no button they cannot use', () => {
    const lapsed = quota({ plan: 'lapsed', api: { used: 0, limit: 10_000, included: 10_000, remaining: 10_000 } });
    const view = render(<QuotaCard data={lapsed} isAdmin={false} />);
    expect(view.getByText('Ask an admin to subscribe')).toBeTruthy();
    expect(view.queryByRole('link', { name: 'Subscribe' })).toBeNull();
  });

  it('shows a count and no bar when there is no ceiling to measure against', () => {
    const view = render(
      <QuotaCard data={quota({ plan: 'enterprise', api: { used: 123_456, included: null } })} isAdmin />,
    );
    expect(view.queryByRole('progressbar')).toBeNull();
    expect(view.getByText('123,456 calls')).toBeTruthy();
    expect(view.queryByRole('link', { name: 'Subscribe' })).toBeNull();
  });
});

describe('QuotaCard', () => {
  it('shows a scheduled cancellation beside the plan name', () => {
    const view = render(<QuotaCard data={quota({ cancelAt: '2026-11-09T00:00:00Z' })} isAdmin={false} />);
    expect(view.getByText('Team')).toBeTruthy();
    // The day and month come in the reader's locale order, so only the lead
    // is fixed.
    expect(view.getByText(/^Ends \S/)).toBeTruthy();
  });

  it('is on the theme tokens: no rail palette, no faint text', () => {
    for (const data of [quota(), trial(9, 9_000), trial(1, 10_000), quota({ plan: 'lapsed' })]) {
      const html = render(<QuotaCard data={data} isAdmin />).container.innerHTML;
      expect(html).not.toContain('rail-');
      expect(html).not.toContain('text-faint');
      cleanup();
    }
  });

  it('gives the percentage and the date tabular figures, so they do not jitter as they change', () => {
    const view = render(<QuotaCard data={quota({ api: { used: 4_200 } })} isAdmin={false} />);
    expect(view.getByText('42% used').className).toContain('tabular-nums');
    expect(view.getByText(/^resets /).className).toContain('tabular-nums');
  });

  it('fades in once there is data, and settles without motion for a reduced-motion reader', () => {
    const card = render(<QuotaCard data={quota()} isAdmin={false} />).container.firstElementChild as HTMLElement;
    expect(card.className).toContain('fade-in-mount');
    expect(card.className).toContain('motion-reduce:transition-none');
  });
});

describe('QuotaPanel', () => {
  const status = (view: ReturnType<typeof render>) => view.getByRole('status');

  it('holds the card\'s place with placeholders while the numbers load, and says so once', () => {
    const view = render(<QuotaPanel isError={false} isAdmin />);
    expect(status(view).textContent).toBe('Loading usage');
    expect(view.queryByRole('progressbar')).toBeNull();
    expect(view.queryByRole('link', { name: 'Subscribe' })).toBeNull();
    // Decoration, every block of it: the region's one label does the telling.
    const blocks = Array.from(view.container.querySelectorAll('.animate-pulse'));
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) expect(block.getAttribute('aria-hidden')).toBe('true');
    expect(view.container.querySelector('.rounded-lg.border')).toBeTruthy();
  });

  it('says the numbers are unavailable, quietly, when the request failed', () => {
    const view = render(<QuotaPanel isError isAdmin />);
    const line = view.getByText('Usage unavailable');
    expect(line.className).toContain('text-muted');
    expect(line.className).not.toMatch(/text-(danger|warn)/);
    expect(line.className).toContain('fade-in-mount');
    expect(line.className).toContain('motion-reduce:transition-none');
    // Inside the status region, so it is announced as it appears.
    expect(status(view).contains(line)).toBe(true);
    expect(view.container.querySelector('.animate-pulse')).toBeNull();
    expect(view.queryByRole('progressbar')).toBeNull();
    expect(view.queryByRole('link', { name: 'Subscribe' })).toBeNull();
  });

  it('draws the card once the answer is in, with its bar and its subscribe unchanged', () => {
    const view = render(<QuotaPanel data={trial(9, 4_200)} isError={false} isAdmin />);
    expect(bar(view).getAttribute('aria-valuenow')).toBe('42');
    expect(view.getByRole('link', { name: 'Subscribe' }).getAttribute('href')).toBe(PLAN_PAGE);
    expect(view.container.querySelector('.animate-pulse')).toBeNull();
    expect(view.queryByText('Usage unavailable')).toBeNull();
  });

  it('keeps the card on the numbers it has when a refetch fails', () => {
    const view = render(<QuotaPanel data={quota()} isError isAdmin={false} />);
    expect(bar(view)).toBeTruthy();
    expect(view.queryByText('Usage unavailable')).toBeNull();
  });

  it('keeps one status region from loading to the answer, so the result is announced', () => {
    const view = render(<QuotaPanel isError={false} isAdmin={false} />);
    const region = status(view);
    expect(region.textContent).toBe('Loading usage');

    view.rerender(<QuotaPanel data={quota()} isError={false} isAdmin={false} />);
    expect(status(view)).toBe(region);
    expect(region.textContent).toBe('Usage loaded');
    // The card is beside the region, not in it: a count that ticks over must
    // not be read out again as the whole card.
    expect(region.contains(bar(view))).toBe(false);
  });

  it('is on the theme tokens in every state: no rail palette, no faint text', () => {
    for (const props of [
      { isError: false },
      { isError: true },
      { isError: false, data: quota() },
      { isError: false, data: quota({ plan: 'lapsed' }) },
    ]) {
      const html = render(<QuotaPanel {...props} isAdmin />).container.innerHTML;
      expect(html).not.toContain('rail-');
      expect(html).not.toContain('text-faint');
      cleanup();
    }
  });
});
