import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { test, expect, type Locator, type Page } from '@playwright/test';
// A relative path, not `@temply/shared/plans`: this package does not depend on
// the workspace's shared one, and plans.ts imports nothing but a sibling file.
import { formatUsd, monthlyUsd, PRICES_USD } from '../../shared/plans';
import { onPhone } from '../fixtures/project';

/** How opaque an element looks: its own opacity times every ancestor's. A scroll
 *  reveal sits on a section's wrapper, so the heading inside it computes to 1
 *  while the whole section is hidden above it. */
const seen = (locator: Locator) =>
  locator.evaluate((el) => {
    let opacity = 1;
    for (let node: Element | null = el; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    return opacity;
  });

/** The "Start your free trial" link in each place the page offers it. Three
 *  exist (the hero, the Team card, the closing band), so a bare lookup by name
 *  trips strict mode: every case that wants one scopes to the section it means.
 *  The hero's sits in its entrance wrapper, the only `.hero-enter` with a link
 *  to the sign-up route. */
const trialLink = (page: Page) => ({
  hero: page.locator('div.hero-enter').getByRole('link', { name: 'Start your free trial' }),
  team: page.locator('#pricing').getByRole('link', { name: 'Start your free trial' }),
  band: page.getByRole('region', { name: 'Ready when you are' }).getByRole('link', { name: 'Start your free trial' }),
});

/** The marketing home's content a reveal could hide: the hero heading, a price,
 *  the call to action, the closing band and the contact heading, which is also
 *  the page's last section and so the one furthest below the fold. */
const revealable = (page: Page) => ({
  'the hero heading': page.getByRole('heading', { level: 1 }),
  'a price': page.locator('#pricing').getByRole('group', { name: 'Team' }).getByText(/^\$\d+$/).first(),
  'the call to action': trialLink(page).team,
  'the closing band': page.getByRole('region', { name: 'Ready when you are' }).getByRole('heading', { level: 2 }),
  'the contact heading': page.locator('#contact').getByRole('heading', { level: 2 }),
});

test.describe('marketing', () => {
  test('the home page loads and links to the docs', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Temply/);
    await page.getByRole('link', { name: 'Docs', exact: true }).first().click();
    await expect(page).toHaveURL(/\/docs/);
    await expect(page.getByRole('heading', { name: 'Introduction' })).toBeVisible();
  });

  test('a crawler is given the page in its own terms', async ({ page, request }) => {
    // Titles come from one template, the icons come in the formats each
    // browser takes, the manifest and the sitemap answer, and the front
    // page says what it is in schema.org's vocabulary.
    await page.goto('/');
    await expect(page).toHaveTitle('Email templates your team can edit | Temply');
    const graph = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(graph!)['@graph'].map((n: { '@type': string }) => n['@type'])).toEqual(['WebSite', 'Organization', 'SoftwareApplication']);
    await expect(page.locator('link[rel="icon"][type="image/png"]')).toHaveCount(1);
    await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);

    for (const [path, title] of [['/docs', 'Email template API documentation | Temply'], ['/playground', 'Email editor playground | Temply'], ['/terms', 'Terms of service | Temply']]) {
      await page.goto(path);
      await expect(page).toHaveTitle(title);
    }

    // The policy is reported, not enforced, and names the Clerk host the
    // build was given; the report endpoint answers through the proxy.
    const csp = (await request.get('/')).headers()['content-security-policy-report-only'];
    expect(csp).toContain('report-uri /api/csp-report');
    expect(csp).toContain('clerk.accounts.dev');
    expect(csp).toContain("frame-ancestors 'none'");
    const report = await request.post('/api/csp-report', {
      headers: { 'content-type': 'application/csp-report' },
      data: JSON.stringify({ 'csp-report': { 'effective-directive': 'img-src', 'blocked-uri': 'http://x', 'document-uri': '/' } }),
    });
    expect(report.status()).toBe(200);

    const manifest = await request.get('/manifest.webmanifest');
    expect(manifest.ok()).toBe(true);
    expect((await manifest.json()).name).toBe('Temply');

    // Each page is dated by the last commit that touched what it is made
    // of, not by the deploy. The terms page is the probe: its sources are
    // the page and the legal facts, and git says when they last changed.
    const sitemap = await (await request.get('/sitemap.xml')).text();
    const entries = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], new Date(m[2])] as const);
    expect(entries.length).toBe(5);
    const terms = entries.find(([loc]) => loc.endsWith('/terms'))![1];
    const committed = new Date(execFileSync('git', ['log', '-1', '--format=%cI', '--', 'app/(marketing)/terms', 'lib/legal.ts'], { cwd: join(import.meta.dirname, '..', '..', 'client'), encoding: 'utf8' }).trim());
    expect(terms.getTime()).toBe(committed.getTime());
  });

  test('every docs nav link has a section', async ({ page }) => {
    await page.goto('/docs');
    const links = page.getByRole('navigation', { name: /contents|on this page/i }).getByRole('link');
    const count = await links.count();
    expect(count).toBeGreaterThan(5);
    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute('href');
      expect(href).toMatch(/^#/);
      await expect(page.locator(href!)).toHaveCount(1);
    }
  });

  test('the page never scrolls sideways', async ({ page }) => {
    for (const path of ['/', '/docs', '/playground']) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `${path} scrolls horizontally`).toBe(false);
    }
  });

  // A card wider than its column can still end inside the viewport, which the
  // scroll-width case above does not see: it only runs through the gutter. The
  // grid's column is the page's, so every card is inside it at any phone width.
  test('the workflow cards stay inside the page column at a phone width', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');
      const { list, cards } = await page.locator('#features ol').evaluate((ol) => ({
        list: { left: ol.getBoundingClientRect().left, right: ol.getBoundingClientRect().right },
        cards: Array.from(ol.children).map((li) => ({ left: li.getBoundingClientRect().left, right: li.getBoundingClientRect().right })),
      }));
      expect(cards, `the workflow has four cards at ${width}px`).toHaveLength(4);
      for (const card of cards) {
        expect(card.left, `a card starts left of the column at ${width}px`).toBeGreaterThanOrEqual(list.left - 0.5);
        expect(card.right, `a card runs past the column at ${width}px`).toBeLessThanOrEqual(list.right + 0.5);
      }
    }
  });

  test('the playground opens the editor for a visitor', async ({ browser }) => {
    // A fresh context with no storageState: the playground is the one editor
    // a signed-out visitor can reach, and the project's `page` is signed in.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/playground');
    // The phone shell reads the demo rather than editing it, and says so
    // under the header — that banner is the mark that the editor mounted.
    if (onPhone()) await expect(page.getByText('Open on a desktop to try the editor.')).toBeVisible();
    else await expect(page.getByRole('heading', { name: 'Your email', exact: true })).toBeVisible();
    await expect(page.locator('.ProseMirror')).toContainText('Welcome to Temply');
    await context.close();
  });

  test('the legal pages link to each other', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'Terms of service' }).click();
    await expect(page.getByRole('heading', { name: 'Terms of service', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'Privacy policy' }).click();
    await expect(page.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeVisible();
  });

  test('the pricing section states the trial, the prices and the caching advice', async ({ page }) => {
    // The copy's figures are written out rather than read from the plan rules,
    // so a change to a price has to be made here on purpose. The seat stepper's
    // case reads them, because it checks arithmetic, not the price.
    await page.goto('/');
    const pricing = page.locator('#pricing');
    await expect(pricing.getByRole('heading', { name: 'One price per person, after a free trial' })).toBeVisible();
    for (const figure of ['14 days', 'No card needed', '$5', 'per user a month', '$1 per 1,000 calls', '+10 templates', '50 versions', 'updatedAt']) {
      await expect(pricing).toContainText(figure);
    }
    // The trial's own limits differ from Team's (a smaller store, a call cap),
    // so each card is checked against its own figures.
    const trial = pricing.getByRole('group', { name: 'Free trial', exact: true });
    for (const figure of ['$0', 'for 14 days', 'Every new workspace starts here. No card needed.', '10,000 live API calls', '10 templates, 10 versions of each', '100 MB of storage', '5 live keys and 5 brands', 'When it ends, the workspace turns read-only until someone subscribes. Nothing is deleted.']) {
      await expect(trial).toContainText(figure);
    }
    await expect(pricing.getByRole('group', { name: 'Team', exact: true })).toContainText('1 GB of storage');
    // It has no link of its own: the page offers the trial in the hero, on the
    // Team card and in the closing band, and nowhere else.
    await expect(trial.getByRole('link')).toHaveCount(0);
    // Scoped to the pricing section: the hero and the closing band carry the
    // same link, so a page-wide lookup would match three.
    await expect(trialLink(page).team).toHaveAttribute('href', '/sign-up');
    await expect(pricing.getByRole('link', { name: 'Contact sales' })).toHaveAttribute('href', /^mailto:/);
    await pricing.getByRole('link', { name: 'How to cache' }).click();
    await expect(page).toHaveURL(/\/docs#caching$/);
    await expect(page.getByRole('heading', { name: 'Caching', exact: true })).toBeVisible();
  });

  test.describe('the Team card seat stepper', () => {
    const SEAT = formatUsd(PRICES_USD.seat);
    // A limit of the control, not a plan rule: the plans have no seat cap, so
    // the figure is the control's own and is written out.
    const MAX_SEATS = 99;

    const open = async (page: Page) => {
      await page.goto('/');
      const team = page.getByRole('group', { name: 'Team' });
      const readout = team.getByRole('group', { name: 'Users' });
      const total = team.locator('[aria-live="polite"]');
      const more = team.getByRole('button', { name: 'Increase seats' });
      const fewer = team.getByRole('button', { name: 'Decrease seats' });
      await more.scrollIntoViewIfNeeded();
      return {
        team,
        more,
        fewer,
        seats: async () => Number((await readout.textContent())!.match(/(\d+) users?/)![1]),
        /** The count and the sum it makes, from the plan rules the API bills with. */
        expectSeats: async (n: number) => {
          const users = `${n} ${n === 1 ? 'user' : 'users'}`;
          await expect(readout).toHaveText(users);
          await expect(total).toContainText(`${users} × ${SEAT}`);
          await expect(total).toContainText(`${formatUsd(monthlyUsd(n, 0))} a month`);
        },
      };
    };

    test('prices a seat count from the plan rules, from one user up', async ({ page }) => {
      const { team, more, fewer, seats, expectSeats } = await open(page);
      await expect(team.getByText(SEAT, { exact: true }).first(), 'the card states the seat price').toBeVisible();

      const start = await seats();
      await expectSeats(start);

      await more.click();
      await expectSeats(start + 1);

      // Both buttons answer the keyboard, and one at its bound stays put and
      // keeps focus instead of dropping it to the page.
      await fewer.focus();
      for (let n = 0; n < start; n++) await page.keyboard.press('Enter');
      await expectSeats(1);
      await expect(fewer).toHaveAttribute('aria-disabled', 'true');
      await expect(fewer).toBeFocused();
      await expect(more).not.toHaveAttribute('aria-disabled', 'true');
    });

    test('stops at one user: a press at the bound does nothing and keeps focus', async ({ page }) => {
      const { more, fewer, seats, expectSeats } = await open(page);
      await fewer.focus();
      for (let n = await seats(); n > 1; n--) await page.keyboard.press('Enter');
      await expectSeats(1);

      // aria-disabled reads as not enabled to Playwright, which would wait on a
      // click for ever; forcing it sends the press a pointer really would.
      await page.keyboard.press('Enter');
      await fewer.click({ force: true });
      await expectSeats(1);
      await expect(fewer).toHaveAttribute('aria-disabled', 'true');
      await expect(fewer).toBeFocused();
      await expect(more).not.toHaveAttribute('aria-disabled', 'true');
    });

    test('paints a stepper at its bound as the filled disabled pill, at full opacity', async ({ page }) => {
      const { fewer, more, seats } = await open(page);
      await fewer.focus();
      for (let n = await seats(); n > 1; n--) await page.keyboard.press('Enter');
      await expect(fewer).toHaveAttribute('aria-disabled', 'true');

      const paint = (button: Locator) =>
        button.evaluate((el) => {
          const probe = document.createElement('div');
          document.body.append(probe);
          const resolve = (property: 'background-color' | 'color', token: string) => {
            probe.style.cssText = `${property}: var(${token})`;
            return getComputedStyle(probe).getPropertyValue(property);
          };
          const out = {
            background: getComputedStyle(el).backgroundColor,
            color: getComputedStyle(el).color,
            track: resolve('background-color', '--ds-track'),
            disabled: resolve('color', '--ds-disabled'),
          };
          probe.remove();
          return out;
        });
      // The fill and the ink settle over the press transition, so the first
      // read after the last step can still be the live button's.
      await expect.poll(async () => (await paint(fewer)).background, { message: 'the bound button is on the track' }).toBe((await paint(fewer)).track);
      await expect.poll(async () => (await paint(fewer)).color, { message: 'its glyph is in the disabled ink' }).toBe((await paint(fewer)).disabled);
      // Seen through its ancestors, so the card's own scroll reveal has to
      // have finished before a faded button can be told from a fading section.
      await expect.poll(() => seen(fewer), { message: 'it is not the live button faded' }).toBe(1);

      const live = await paint(more);
      expect(live.background, 'the live neighbour is not on the track').not.toBe(live.track);
    });

    test(`stops at ${MAX_SEATS} users: a press at the cap does nothing and keeps focus`, async ({ page }) => {
      const { more, fewer, seats, expectSeats } = await open(page);
      await more.focus();
      for (let n = await seats(); n < MAX_SEATS; n++) await page.keyboard.press('Enter');
      await expectSeats(MAX_SEATS);
      await expect(more).toHaveAttribute('aria-disabled', 'true');
      await expect(more).toBeFocused();

      await page.keyboard.press('Enter');
      await more.click({ force: true });
      await expectSeats(MAX_SEATS);
      await expect(more).toHaveAttribute('aria-disabled', 'true');
      await expect(more).toBeFocused();
      await expect(fewer).not.toHaveAttribute('aria-disabled', 'true');

      // And the way back is open.
      await fewer.click();
      await expectSeats(MAX_SEATS - 1);
      await expect(more).not.toHaveAttribute('aria-disabled', 'true');
    });
  });

  test('every pricing card is drawn at the 2xl radius', async ({ page }) => {
    await page.goto('/');
    // The token is read through a probe, as the theme cases read the colour
    // ones, so retuning the radius scale cannot break this and only a card
    // that stops using the scale can.
    const token = await page.evaluate(() => {
      const probe = document.createElement('div');
      document.body.append(probe);
      probe.style.cssText = 'border-top-left-radius: var(--radius-2xl)';
      const radius = getComputedStyle(probe).borderTopLeftRadius;
      probe.remove();
      return radius;
    });
    expect(parseFloat(token), 'the 2xl token resolves').toBeGreaterThan(0);

    const pricing = page.locator('#pricing');
    for (const name of ['Free trial', 'Team', 'Enterprise', 'Template pack']) {
      const card = pricing.getByRole('group', { name, exact: true });
      await expect(card).toHaveCount(1);
      await expect(card, `${name} card`).toHaveCSS('border-top-left-radius', token);
    }
  });

  test('the closing band says "Ready when you are" and offers one way in', async ({ page }) => {
    await page.goto('/');
    const band = page.getByRole('region', { name: 'Ready when you are' });
    await expect(band).toHaveCount(1);
    await expect(band.getByRole('heading', { level: 2, name: 'Ready when you are', exact: true })).toBeVisible();
    await expect(band.getByRole('link')).toHaveCount(1);
    await expect(band.getByRole('link')).toHaveText('Start your free trial');
    // Contact stays between the band and the footer: it is the only way a
    // visitor reaches sales for Enterprise.
    const top = (locator: Locator) => locator.evaluate((el) => el.getBoundingClientRect().top);
    const order = [await top(page.locator('#pricing')), await top(band), await top(page.locator('#contact')), await top(page.locator('footer'))];
    expect([...order].sort((a, b) => a - b), 'pricing, the band, contact and the footer run in that order').toEqual(order);
  });

  test('every free-trial call to action goes to the sign-up route', async ({ page }) => {
    await page.goto('/');
    // The hero, the Team card and the closing band: three, not a fourth that a
    // later edit forgot to send the same way.
    await expect(page.getByRole('link', { name: 'Start your free trial' })).toHaveCount(3);
    for (const [place, link] of Object.entries(trialLink(page))) {
      await expect(link, `the ${place} call to action`).toHaveAttribute('href', '/sign-up');
    }
  });

  // Team and Enterprise share a row from lg, under the trial's; below it all
  // three stack in the order a workspace meets them. As with the workflow, a
  // card wider than its column can still end inside the viewport,
  // which the scroll-width case does not see (the page clips its own overflow),
  // so each card, and every line of text and control the pricing and the band
  // hold, is held to the column the page's gutters make.
  test.describe('the pricing and the closing band at a phone width', () => {
    type Edges = { left: number; right: number; top: number; bottom: number };
    const edges = (locator: Locator): Promise<Edges> =>
      locator.evaluate((el) => {
        const { left, right, top, bottom } = el.getBoundingClientRect();
        return { left, right, top, bottom };
      });
    /** What the text and the controls under `root` do past `limit`. The
     *  screen-reader-only count and the band's decorative shapes are left out
     *  by asking for content elements, not every element. */
    const pastLimit = (root: Locator, limit: Pick<Edges, 'left' | 'right'>) =>
      root.evaluate((el, bounds) => {
        const out: string[] = [];
        for (const node of Array.from(el.querySelectorAll('h2, h3, p, li, a, button, code'))) {
          const box = node.getBoundingClientRect();
          if (box.left < bounds.left - 0.5 || box.right > bounds.right + 0.5) {
            out.push(`<${node.tagName.toLowerCase()}> "${(node.textContent ?? '').trim().slice(0, 30)}" at ${Math.round(box.left)}..${Math.round(box.right)}`);
          }
        }
        return out;
      }, limit);

    for (const width of [320, 360, 390]) {
      test(`stay inside the page column at ${width}px, the trial above Team above Enterprise`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/');

        const pricing = page.locator('#pricing');
        const card = (name: string) => pricing.getByRole('group', { name, exact: true });
        const band = page.getByRole('region', { name: 'Ready when you are' }).locator('> [data-reveal] > div');
        // The workflow section hangs from the same container, so its content
        // box is the page's column.
        const column = () =>
          page.locator('#features > div').evaluate((el) => {
            const box = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return { left: box.left + parseFloat(style.paddingLeft), right: box.right - parseFloat(style.paddingRight) };
          });

        // A resize is not laid out until a frame later and, with motion
        // reduced, there is no transition to wait on instead, so the first
        // reading is polled rather than trusted.
        await expect.poll(async () => (await edges(card('Team'))).right, { message: `the Team card fits the ${width}px screen` }).toBeLessThanOrEqual(width);

        const col = await column();
        const measure = async () => ({
          'Free trial': await edges(card('Free trial')),
          Team: await edges(card('Team')),
          Enterprise: await edges(card('Enterprise')),
          'Template pack': await edges(card('Template pack')),
        });
        const cards = await measure();
        for (const [name, box] of Object.entries(cards)) {
          expect(box.left, `the ${name} card starts left of the column at ${width}px`).toBeGreaterThanOrEqual(col.left - 0.5);
          expect(box.right, `the ${name} card runs past the column at ${width}px`).toBeLessThanOrEqual(col.right + 0.5);
        }
        expect(cards.Team.top, 'Team stacks under the trial').toBeGreaterThanOrEqual(cards['Free trial'].bottom - 0.5);
        expect(cards.Enterprise.top, 'Enterprise stacks under Team').toBeGreaterThanOrEqual(cards.Team.bottom - 0.5);
        expect(await pastLimit(pricing, col), `something in the pricing runs past the column at ${width}px`).toEqual([]);

        // The stepper's longest line is the sum at its cap, which is what has
        // to fit the narrowest card.
        const more = card('Team').getByRole('button', { name: 'Increase seats' });
        await more.focus();
        for (let n = 0; n < 96; n++) await page.keyboard.press('Enter');
        await expect(card('Team').getByRole('group', { name: 'Users' })).toHaveText('99 users');
        const atCap = await measure();
        expect(atCap.Team.right, `the Team card runs past the column at ${width}px with 99 users`).toBeLessThanOrEqual(col.right + 0.5);
        expect(await pastLimit(pricing, col), `something in the pricing runs past the column at ${width}px with 99 users`).toEqual([]);

        const box = await edges(band);
        expect(box.left, `the band starts left of the column at ${width}px`).toBeGreaterThanOrEqual(col.left - 0.5);
        expect(box.right, `the band runs past the column at ${width}px`).toBeLessThanOrEqual(col.right + 0.5);
        expect(await pastLimit(band, box), `something in the band runs past its box at ${width}px`).toEqual([]);

        const scrolls = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(scrolls, `the page scrolls sideways at ${width}px`).toBe(false);
      });
    }
  });

  test('the Team and Enterprise cards share a row on a wide screen, Team the wider, under the trial', async ({ page }) => {
    // Reduced motion withholds the scroll reveal, whose slide would otherwise
    // be mid-flight between one measurement and the next.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const rect = (name: string) =>
      page.locator('#pricing').getByRole('group', { name, exact: true }).evaluate((el) => {
        const { x, y, width, height, bottom, right } = el.getBoundingClientRect();
        return { x, y, width, height, bottom, right };
      });
    const trial = await rect('Free trial');
    const team = await rect('Team');
    const enterprise = await rect('Enterprise');
    expect(Math.abs(team.y - enterprise.y), 'the two cards start on one line').toBeLessThan(1);
    expect(Math.abs(team.height - enterprise.height), 'and are as tall as each other').toBeLessThan(1);
    expect(team.x, 'Team is the left card').toBeLessThan(enterprise.x);
    expect(team.width, 'and the wider').toBeGreaterThan(enterprise.width);
    // The trial takes the row above the pair, so it takes no width from either.
    expect(trial.bottom, 'the trial sits above the pair').toBeLessThanOrEqual(team.y + 0.5);
    expect(Math.abs(trial.x - team.x), 'and starts where Team does').toBeLessThan(1);
    expect(Math.abs(trial.right - enterprise.right), 'and ends where Enterprise does').toBeLessThan(1);
  });

  test('the page has one main and one h1', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    // The break the hero is built around does not change what the heading says.
    await expect(page.locator('h1')).toHaveText('Emails that feel like you. Ready for your app.');
  });

  test('the hero, a price, the call to action, the closing band and the contact heading are on the page without scripts', async ({ browser }) => {
    // Nothing here runs: the first paint is what a crawler and a reader with
    // scripts off both get. `toBeVisible` ignores opacity, and the entrance
    // animations start at zero, so what is asserted is how opaque each one
    // looks with its ancestors counted, which is where a section is hidden.
    const context = await browser.newContext({ javaScriptEnabled: false, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Emails that feel like you. Ready for your app.');
    // Not merely arrived by now: with scripts off the entrance never starts,
    // so there is no first frame at zero for a renderer that snapshots early.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('animation-name', 'none');
    for (const [name, locator] of Object.entries(revealable(page))) {
      await expect(locator, name).toBeVisible();
      expect(await seen(locator), `${name} is faded out`).toBe(1);
    }
    // The stepper is rendered by the server at its starting count; nothing
    // here can run to put it there.
    await expect(page.locator('#pricing').getByRole('group', { name: 'Team' }).getByRole('group', { name: 'Users' })).toHaveText('3 users');
    await context.close();
  });

  test('the pricing, the closing band, the workflow cards and the contact section show when the page scripts fail to load', async ({ browser }) => {
    // Scripts are on, but none of the bundle arrives, so the reveal's hook
    // never runs. The page's own head is inline and still does.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    await context.route('**/_next/static/**/*.js', (route) => route.abort());
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Emails that feel like you. Ready for your app.');
    await expect(page.locator('html'), 'a flag was raised with nothing to lift it').not.toHaveAttribute('data-reveal-ready', /.*/);

    const pricing = page.locator('#pricing');
    await expect(pricing.getByRole('heading', { name: 'One price per person, after a free trial' })).toBeVisible();
    expect(await seen(pricing.locator('> [data-reveal]')), 'the pricing is faded out').toBe(1);
    const band = page.getByRole('region', { name: 'Ready when you are' });
    await expect(band.getByRole('heading', { level: 2 })).toBeVisible();
    expect(await seen(band.locator('> [data-reveal]')), 'the closing band is faded out').toBe(1);
    expect(await seen(page.locator('#contact > [data-reveal]')), 'the contact section is faded out').toBe(1);
    expect(await seen(page.locator('#contact').getByRole('heading', { level: 2 })), 'the contact heading is faded out').toBe(1);

    // A workflow card stages its copy and its visual separately, each from zero.
    const halves = page.locator('.reveal-visual, .reveal-copy');
    const count = await halves.count();
    expect(count, 'the page has workflow cards').toBeGreaterThan(0);
    for (let n = 0; n < count; n++) expect(await seen(halves.nth(n)), `workflow card half ${n} is faded out`).toBe(1);
    await context.close();
  });

  test.describe('the scroll reveal with scripts running', () => {
    // Each case asks for motion itself: the reveal is withheld under reduced
    // motion, and these cases are about the reveal.
    const armed = (page: Page) =>
      expect(page.locator('html')).toHaveAttribute('data-reveal-ready', '');

    test('what is on screen at load is shown with no fade, and a section below the fold waits for the scroll', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      // Tall enough that the features section is in view without scrolling.
      await page.setViewportSize({ width: 1300, height: 2400 });
      await page.goto('/');
      await armed(page);

      // Marked revealed in the commit that raised the flag, so it never
      // computes to zero, and there is nothing to wait for.
      const inView = page.locator('#features [data-reveal]').first();
      await expect(inView).toHaveAttribute('data-revealed', 'true');
      expect(await seen(inView), 'a section on screen at load faded in after it').toBe(1);

      const section = page.locator('#contact > [data-reveal]');
      await expect.poll(() => seen(section), { message: 'the contact section is not hidden at load' }).toBe(0);
      await expect(section).toHaveAttribute('data-revealed', 'false');

      await page.locator('#contact').scrollIntoViewIfNeeded();
      await expect(section).toHaveAttribute('data-revealed', 'true');
      await expect.poll(() => seen(section), { message: 'the contact section never showed' }).toBe(1);
      await expect(page.locator('#contact').getByRole('heading', { level: 2 })).toBeVisible();
    });

    /** Where an engine's observer root ends, either way it might inset it: a
     *  tenth of the height, which is what Chromium does, or of the width, which
     *  is what the specification says. */
    const rootHeights = (page: Page) =>
      page.evaluate(() => [window.innerHeight * 0.9, window.innerHeight - window.innerWidth * 0.1]);

    test('the header\'s Pricing anchor lands on a revealed section on the smallest phone held sideways', async ({ page }) => {
      // The jump a nav link makes puts the section's top at the header's scroll
      // padding, not at the top of the screen. 568x280 is a landscape phone
      // with its browser bars up: the shortest screen the page is held to, and
      // the one where the most of the section is below the root's edge.
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.setViewportSize({ width: 568, height: 280 });
      await page.goto('/');
      await armed(page);

      const section = page.locator('#pricing > [data-reveal]');
      const { height } = await section.evaluate((el) => ({ height: el.getBoundingClientRect().height }));
      expect(height, 'the section is no longer taller than twice the observer root, which is the case').toBeGreaterThan(2 * Math.max(...(await rootHeights(page))));
      await page.evaluate(() => document.querySelector('#pricing')!.scrollIntoView());
      await expect(section).toHaveAttribute('data-revealed', 'true');
      await expect.poll(() => seen(section), { message: 'the pricing never showed' }).toBe(1);
    });

    // A scroll that stops with the section's top part-way up the screen is what
    // a thumb does, and it is the one a jump to the anchor never makes: the
    // top is at 0 after `scrollIntoView`, where any rule reveals it. Asking for
    // 15% of a section a little taller than the root left the stretch before it
    // blank, until its top was nearly at the screen's. The reveal is a
    // property of the section's height against the screen's, which the copy
    // moves, so each case also sets the height: the 1742px the pricing came to
    // after its restyle, where 15% of it fits the root at 568x320 and the
    // regression shows, and the 2269px it was before, where it did not.
    for (const { width, height } of [
      { width: 568, height: 320 },
      { width: 667, height: 375 },
    ]) {
      for (const forced of [null, 1742, 2269]) {
        const label = forced ? `${forced}px tall` : 'at its own height';
        test(`pricing shows once any of it is on a ${width}x${height} screen held sideways, ${label}`, async ({ page }) => {
          await page.emulateMedia({ reducedMotion: 'no-preference' });
          await page.setViewportSize({ width, height });
          await page.goto('/');
          await armed(page);

          const section = page.locator('#pricing > [data-reveal]');
          if (forced) {
            // Clipped, so a section the copy has made taller still measures
            // what the case says.
            await section.evaluate((el, px) => {
              el.style.height = `${px}px`;
              el.style.overflow = 'hidden';
            }, forced);
          }
          const sectionHeight = await section.evaluate((el) => el.getBoundingClientRect().height);
          expect(sectionHeight, 'the section is no longer taller than twice the observer root, which is the case').toBeGreaterThan(2 * Math.max(...(await rootHeights(page))));

          const scrollTo = (top: number | 'section', offset = 0) =>
            page.evaluate(
              ([target, from]) => {
                const y = target === 'section' ? document.querySelector('#pricing')!.getBoundingClientRect().top + window.scrollY - from : target;
                window.scrollTo({ top: y, behavior: 'instant' });
              },
              [top, offset] as const,
            );

          // At 250px down, between 13 and 87px of the section's top is inside
          // the root at these sizes, whichever way an engine insets it; at 60px
          // it is most of the screen.
          for (const offset of [250, 150, 60]) {
            await scrollTo(0);
            await expect(section, 'the section is hidden again once it is off screen').toHaveAttribute('data-revealed', 'false');
            await scrollTo('section', offset);
            await expect(section, `pricing is still blank with its top ${offset}px down a ${width}x${height} screen`).toHaveAttribute('data-revealed', 'true');
            await expect.poll(() => seen(section), { message: `the pricing never showed with its top ${offset}px down` }).toBe(1);
          }
        });
      }
    }
  });

  test('the contact form asks for what is missing before it sends anything', async ({ page }) => {
    await page.goto('/');
    const form = page.locator('#contact');
    // A message opens by growing, so "shown" is a height, not a visibility:
    // a closed one is still a box, clipped to nothing.
    const opened = (id: string) =>
      expect.poll(async () => (await page.locator(`#${id}`).locator('..').boundingBox())?.height ?? 0);

    await form.getByRole('button', { name: 'Send message' }).click();
    await expect(page.locator('#contact-email-error')).toHaveText('Add an email address so we can reply.');
    await expect(page.locator('#contact-message-error')).toHaveText('Write a few words about what you need.');
    await opened('contact-email-error').toBeGreaterThan(0);
    // The first field with a problem takes focus, and a screen reader is told
    // which words belong to which field.
    await expect(form.getByLabel('Name')).toBeFocused();
    await expect(form.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
    await expect(form.getByLabel('Email')).toHaveAttribute('aria-describedby', 'contact-email-error');

    // Typing in a field takes its message back; the others stay.
    await form.getByLabel('Email').fill('not an address');
    await expect(form.getByLabel('Email')).not.toHaveAttribute('aria-invalid', 'true');
    await opened('contact-email-error').toBe(0);
    await opened('contact-message-error').toBeGreaterThan(0);
  });

  test('the contact form paints its send button as the filled disabled pill while it sends', async ({ page }) => {
    // The request never answers, so the form stays in "Sending".
    await page.route('**/api/v1/contact', () => new Promise<void>(() => {}));
    await page.goto('/');
    const form = page.locator('#contact');
    await form.getByLabel('Name').fill('Ada');
    await form.getByLabel('Email').fill('ada@example.com');
    await form.getByLabel('Message').fill('Hello there');
    await form.getByRole('button', { name: 'Send message' }).click();

    const sending = form.getByRole('button', { name: 'Sending' });
    await expect(sending).toHaveAttribute('aria-disabled', 'true');
    const paint = () =>
      sending.evaluate((el) => {
        const probe = document.createElement('div');
        document.body.append(probe);
        probe.style.cssText = 'background-color: var(--ds-track)';
        const track = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return { background: getComputedStyle(el).backgroundColor, track };
      });
    await expect.poll(async () => (await paint()).background, { message: 'the sending button is on the track, not the accent' }).toBe((await paint()).track);
    await expect.poll(() => seen(sending), { message: 'it is not the live button faded' }).toBe(1);
  });

  test('docs code tabs switch the language and remember it', async ({ page }) => {
    await page.goto('/docs');
    // Only a JavaScript snippet contains `fetch(`, and until a reload only the
    // block whose tab was clicked shows one: the other two stay on curl. So
    // the page goes from no `fetch(` to exactly one, and loses one block that
    // starts with `curl `.
    const js = page.getByText(/fetch\(/);
    const curl = page.getByText(/^curl /);
    await expect(js).toHaveCount(0);
    const curlBefore = await curl.count();
    const first = page.getByRole('tablist', { name: 'Language' }).first();
    await first.getByRole('tab', { name: 'JavaScript' }).click();
    await expect(first.getByRole('tab', { name: 'JavaScript' })).toHaveAttribute('aria-selected', 'true');
    await expect(js).toHaveCount(1);
    await expect(curl).toHaveCount(curlBefore - 1);
    // The choice is read from storage on mount only, so the other blocks
    // follow on reload rather than live.
    await page.reload();
    await expect(page.getByRole('tab', { name: 'JavaScript', selected: true })).toHaveCount(3);
  });
});
