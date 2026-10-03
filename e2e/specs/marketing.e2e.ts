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

/** The marketing home's content a reveal could hide: the hero heading, a price,
 *  the call to action and the contact heading, which is also the page's last
 *  section and so the one furthest below the fold. */
const revealable = (page: Page) => ({
  'the hero heading': page.getByRole('heading', { level: 1 }),
  'a price': page.locator('#pricing').getByRole('group', { name: 'Team' }).getByText(/^\$\d+$/).first(),
  'the call to action': page.locator('#pricing').getByRole('link', { name: 'Start your free trial' }),
  'the contact heading': page.locator('#contact').getByRole('heading', { level: 2 }),
});

test.describe('marketing', () => {
  test('the home page loads and links to the docs', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Temply/);
    // The hero's link to the docs page reads "Read the docs": a verb for the
    // thing it does, where the header's own link is the bare noun.
    await page.getByRole('link', { name: 'Read the docs' }).first().click();
    await expect(page).toHaveURL(/\/docs/);
    await expect(page.getByRole('heading', { name: 'Introduction' })).toBeVisible();
  });

  test('a crawler is given the page in its own terms', async ({ page, request }) => {
    // Titles come from one template, the icons come in the formats each
    // browser takes, the manifest and the sitemap answer, and the front
    // page says what it is in schema.org's vocabulary.
    await page.goto('/');
    await expect(page).toHaveTitle('Visual email editor and template API | Temply');
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
    for (const path of ['/apple-icon', '/icon-192', '/icon-512']) {
      const icon = await request.get(path);
      expect(icon.headers()['content-type'], `${path} is a PNG`).toBe('image/png');
    }

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

  test('the playground opens the editor for a visitor', async ({ browser }) => {
    // A fresh context with no storageState: the playground is the one editor
    // a signed-out visitor can reach, and the project's `page` is signed in.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/playground');
    // The phone shell reads the demo rather than editing it, and says so
    // under the header — that banner is the mark that the editor mounted.
    if (onPhone()) await expect(page.getByText('Open on a desktop to try the editor.')).toBeVisible();
    else await expect(page.getByRole('heading', { name: 'Content', exact: true })).toBeVisible();
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
    await expect(pricing.getByRole('link', { name: 'Start your free trial' })).toHaveAttribute('href', '/sign-up');
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

  test('the page has one main and one h1', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    // The break the hero is built around does not change what the heading says.
    await expect(page.locator('h1')).toHaveText('Write the email. We handle the HTML.');
  });

  test('the hero, a price, the call to action and the contact heading are on the page without scripts', async ({ browser }) => {
    // Nothing here runs: the first paint is what a crawler and a reader with
    // scripts off both get. `toBeVisible` ignores opacity, and the entrance
    // animations start at zero, so what is asserted is how opaque each one
    // looks with its ancestors counted, which is where a section is hidden.
    const context = await browser.newContext({ javaScriptEnabled: false, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Write the email. We handle the HTML.');
    // Not merely arrived by now: with scripts off the entrance never starts,
    // so there is no first frame at zero for a renderer that snapshots early.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('animation-name', 'none');
    for (const [name, locator] of Object.entries(revealable(page))) {
      await expect(locator, name).toBeVisible();
      expect(await seen(locator), `${name} is faded out`).toBe(1);
    }
    await context.close();
  });

  test('the pricing, the showcase rows and the contact section show when the page scripts fail to load', async ({ browser }) => {
    // Scripts are on, but none of the bundle arrives, so the reveal's hook
    // never runs. The page's own head is inline and still does.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    await context.route('**/_next/static/**/*.js', (route) => route.abort());
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Write the email. We handle the HTML.');
    await expect(page.locator('html'), 'a flag was raised with nothing to lift it').not.toHaveAttribute('data-reveal-ready', /.*/);

    const pricing = page.locator('#pricing');
    await expect(pricing.getByRole('heading', { name: 'One price per person, after a free trial' })).toBeVisible();
    expect(await seen(pricing.locator('> [data-reveal]')), 'the pricing is faded out').toBe(1);
    expect(await seen(page.locator('#contact > [data-reveal]')), 'the contact section is faded out').toBe(1);
    expect(await seen(page.locator('#contact').getByRole('heading', { level: 2 })), 'the contact heading is faded out').toBe(1);

    // A showcase row stages its two halves separately, each from zero.
    const halves = page.locator('.reveal-visual, .reveal-copy');
    const count = await halves.count();
    expect(count, 'the page has showcase rows').toBeGreaterThan(0);
    for (let n = 0; n < count; n++) expect(await seen(halves.nth(n)), `showcase half ${n} is faded out`).toBe(1);
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

    test('a section too tall for 15% of it to fit the screen still shows on a phone held sideways', async ({ page }) => {
      // The pricing section is several screens tall at this size, so an
      // observer asking for 15% of it in view would never be satisfied.
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.setViewportSize({ width: 568, height: 320 });
      await page.goto('/');
      await armed(page);

      const section = page.locator('#pricing > [data-reveal]');
      const { height, rootHeight } = await section.evaluate((el) => ({
        height: el.getBoundingClientRect().height,
        rootHeight: window.innerHeight - window.innerWidth * 0.1,
      }));
      expect(height * 0.15, 'the section is no longer taller than the case assumes').toBeGreaterThan(rootHeight);
      await page.evaluate(() => document.querySelector('#pricing')!.scrollIntoView());
      await expect(section).toHaveAttribute('data-revealed', 'true');
      await expect.poll(() => seen(section), { message: 'the pricing never showed' }).toBe(1);
    });
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
