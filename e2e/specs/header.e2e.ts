import { expect, test, type Locator, type Page } from '@playwright/test';

// The marketing header, read where a visitor meets it: signed out, on the
// public pages, at the widths the two projects run at. A signed-out context
// is also what keeps the header on its Sign in button, which is the one the
// theme cases read.
test.use({ storageState: { cookies: [], origins: [] } });

/** Tailwind's `md`: from here the sections sit in the bar and the menu button is gone. */
const MD = 768;
const BAR = 72;

const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

const header = (page: Page) => page.locator('header').first();
const menuButton = (page: Page) => page.getByRole('button', { name: 'Menu', exact: true });
const panel = (page: Page) => page.locator('#site-menu');
/** The panel's links as assistive tech and the tab order see them: a closed
 *  panel is `visibility: hidden`, so none are counted. */
const panelLinks = (page: Page) => panel(page).getByRole('link');
const isWide = (page: Page) => (page.viewportSize()?.width ?? 0) >= MD;

/** Opens `path` with the theme chosen the way the blocking script in layout.tsx reads it. */
async function open(page: Page, path: string, theme: Theme) {
  await page.addInitScript((chosen) => localStorage.setItem('theme', chosen), theme);
  await page.goto(path);
  await expect(page.getByRole('button', { name: 'Dark theme', exact: true })).toHaveAttribute(
    'aria-pressed',
    String(theme === 'dark'),
  );
}

/** Where `target`'s top edge sits below the header's bottom edge, in px. */
async function clearance(page: Page, target: Locator) {
  const bar = await header(page).elementHandle();
  const el = await target.elementHandle();
  return page.evaluate(([b, t]) => t.getBoundingClientRect().top - b.getBoundingClientRect().bottom, [bar, el] as const);
}

/** What a bar wider than its screen leaves behind: the page scrolling sideways, or a control sitting past an edge. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const client = document.documentElement.clientWidth;
    const bar = document.querySelector('header') as HTMLElement;
    const stray = Array.from(bar.querySelectorAll<HTMLElement>('a, button'))
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return box.width > 0 && (box.left < 0 || box.right > client);
      })
      .map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName);
    return { scroll: document.documentElement.scrollWidth, client, stray };
  });
}

test.describe('the bar', () => {
  test('is 72px tall, and stays that tall and on the top edge once the page has scrolled', async ({ page }) => {
    await page.goto('/');
    const bar = header(page);
    await expect.poll(async () => (await bar.boundingBox())?.height).toBeCloseTo(BAR, 0);

    // The height is the `--header-h` token, not a number of the component's own.
    const token = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.cssText = 'height: var(--header-h); position: absolute; visibility: hidden';
      document.body.append(probe);
      const height = probe.getBoundingClientRect().height;
      probe.remove();
      return height;
    });
    expect(token).toBeCloseTo(BAR, 0);

    await page.evaluate(() => window.scrollTo({ top: 1400, behavior: 'instant' }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
    const scrolled = await bar.boundingBox();
    expect(scrolled?.y).toBeCloseTo(0, 0);
    expect(scrolled?.height).toBeCloseTo(BAR, 0);
  });

  test('keeps the sections in the bar when there is room and behind a menu button when there is not', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Page sections' });
    if (isWide(page)) {
      await expect(nav).toHaveCount(1);
      await expect(nav.getByRole('link')).toHaveText(['Features', 'Blocks', 'Pricing', 'Contact']);
      await expect(menuButton(page)).toHaveCount(0);
    } else {
      // Closed, the panel is out of the accessibility tree and the bar's own
      // nav is display:none: no landmark is announced until the menu opens.
      await expect(menuButton(page)).toBeVisible();
      await expect(nav).toHaveCount(0);
    }
  });

  test('keeps the theme toggle and the Sign in button in the bar at every width', async ({ page }) => {
    await page.goto('/');
    const bar = header(page);
    await expect(bar.getByRole('button', { name: 'Dark theme', exact: true })).toBeVisible();
    await expect(bar.getByRole('link', { name: 'Sign in' })).toBeVisible();
    // 44px for a thumb, whatever the pointer says about the dense sizes.
    if (!isWide(page)) {
      for (const control of [bar.getByRole('button', { name: 'Dark theme', exact: true }), bar.getByRole('link', { name: 'Sign in' }), menuButton(page)]) {
        const box = await control.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(box?.width).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('puts an in-page anchor below itself, whichever way it is reached', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('#pricing');
    if (isWide(page)) {
      await header(page).getByRole('link', { name: 'Pricing' }).click();
    } else {
      await menuButton(page).click();
      await panelLinks(page).filter({ hasText: 'Pricing' }).click();
    }
    await expect(page).toHaveURL(/#pricing$/);
    // Clear of the bar and close to it: far under would be an offset nobody
    // re-based, and negative would be a heading under the glass. The poll is
    // the smooth scroll arriving.
    await expect.poll(() => clearance(page, section)).toBeGreaterThanOrEqual(0);
    await expect.poll(() => clearance(page, section)).toBeLessThanOrEqual(48);
    if (isWide(page)) {
      await expect(header(page).getByRole('link', { name: 'Pricing' })).toHaveAttribute('aria-current', 'true');
    }
  });

  test('puts the docs and legal headings below itself when a link lands on them', async ({ page }) => {
    for (const [path, target] of [['/docs#caching', 'h3#caching'], ['/docs#api-render', 'h3#api-render'], ['/terms#plans', 'section#plans']] as const) {
      await page.goto(path);
      const heading = page.locator(target);
      await expect.poll(() => clearance(page, heading), { message: path }).toBeGreaterThanOrEqual(0);
      await expect.poll(() => clearance(page, heading), { message: path }).toBeLessThanOrEqual(48);
    }
  });

  test('keeps the docs contents rail clear of itself while it sticks', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'the rail only sticks from lg');
    await page.goto('/docs');
    await page.evaluate(() => window.scrollTo({ top: 1600, behavior: 'instant' }));
    const rail = page.getByRole('navigation', { name: 'On this page' });
    await expect.poll(async () => (await rail.boundingBox())?.y).toBeGreaterThanOrEqual(BAR);
  });

  test('routes the sections home from a page that is not the landing page', async ({ page }) => {
    // The sections route home from anywhere else, so each one is a real link.
    await page.goto('/terms');
    if (!isWide(page)) await menuButton(page).click();
    const links = isWide(page) ? header(page).getByRole('navigation', { name: 'Page sections' }).getByRole('link') : panelLinks(page);
    await expect(links).toHaveCount(4);
    await expect(links.filter({ hasText: 'Features' })).toHaveAttribute('href', '/#features');
  });
});

test.describe('the menu on a phone', () => {
  // The desktop project runs these at the phone's width too: the menu is a
  // matter of width, and the phone project adds the coarse pointer.
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens and closes from its button, and says which it will do through aria-expanded alone', async ({ page }) => {
    await page.goto('/');
    const button = menuButton(page);
    // One name for both states: the state is aria-expanded's to say.
    await expect(button).toHaveAccessibleName('Menu');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toHaveAttribute('aria-controls', 'site-menu');
    await expect(panel(page)).toHaveCount(1);
    await expect(panelLinks(page)).toHaveCount(0);

    await button.click();
    await expect(button).toHaveAccessibleName('Menu');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: 'Page sections' })).toHaveCount(1);
    await expect(panelLinks(page)).toHaveText(['Features', 'Blocks', 'Pricing', 'Contact']);
    for (const link of await panelLinks(page).all()) {
      expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }

    await button.click();
    await expect(button).toHaveAccessibleName('Menu');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(panelLinks(page)).toHaveCount(0);
  });

  test('is in the tab order only while it is open, and Tab from the button enters it', async ({ page }) => {
    await page.goto('/');
    const stops = async (presses: number) => {
      const seen: string[] = [];
      for (let i = 0; i < presses; i++) {
        await page.keyboard.press('Tab');
        seen.push(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.closest('#site-menu') ? 'panel' : 'elsewhere'));
      }
      return seen;
    };

    await page.getByRole('link', { name: 'Temply' }).first().focus();
    expect(await stops(6), 'a closed panel has nothing to focus').not.toContain('panel');

    const button = menuButton(page);
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    // Visibility flips on the first frame of the open, not the instant of the
    // key press: a Tab sent before it would pass over links not yet there.
    await expect(panelLinks(page)).toHaveCount(4);
    await page.keyboard.press('Tab');
    await expect(panelLinks(page).first()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(panelLinks(page).nth(1)).toBeFocused();
  });

  test('closes on Escape and hands focus back to its button', async ({ page }) => {
    await page.goto('/');
    const button = menuButton(page);
    await button.click();
    await expect(panelLinks(page)).toHaveCount(4);
    await page.keyboard.press('Tab');
    await expect(panelLinks(page).first()).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeFocused();
    await expect(panelLinks(page)).toHaveCount(0);

    // And from the button itself, where the panel never had focus.
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeFocused();
  });

  test('closes when focus leaves the bar, and leaves focus where it went', async ({ page }) => {
    await page.goto('/');
    const button = menuButton(page);
    await button.click();
    await expect(panelLinks(page)).toHaveCount(4);

    // The panel is not modal, so a Tab can carry focus out of it. With the
    // menu left open behind a keyboard user who has gone on into the page,
    // nothing would ever close it.
    for (const index of [0, 1, 2, 3]) {
      await page.keyboard.press('Tab');
      await expect(panelLinks(page).nth(index)).toBeFocused();
    }
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(panelLinks(page)).toHaveCount(0);
    expect(
      await page.evaluate(() => {
        const focus = document.activeElement;
        return { inPage: !!focus && focus !== document.body && !focus.closest('header') };
      }),
      'focus went on into the page, and was not pulled back to the button',
    ).toEqual({ inPage: true });

    // Any way focus can arrive in the page is the same way out, and the key
    // that follows is then the page's.
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    const link = page.locator('main').getByRole('link').first();
    await link.focus();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(link).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(link).toBeFocused();
    await expect(button).not.toBeFocused();
  });

  test('stays open while focus moves about inside the bar', async ({ page }) => {
    await page.goto('/');
    const button = menuButton(page);
    await button.click();
    await expect(panelLinks(page)).toHaveCount(4);
    await panelLinks(page).first().focus();
    await button.focus();
    await page.getByRole('link', { name: 'Temply' }).first().focus();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(panelLinks(page)).toHaveCount(4);
  });

  test('leaves Escape to a layer that has already answered it, rather than closing the menu and taking focus', async ({ page }) => {
    await page.goto('/');
    const button = menuButton(page);
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');

    // A layer that has already answered the key (Radix prevents it for the
    // user menu it closes) has claimed it, even with focus on the button.
    await page.evaluate(() =>
      document.addEventListener('keydown', (event) => event.key === 'Escape' && event.preventDefault(), { capture: true }),
    );
    await button.focus();
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  test('closes when a link in it is followed, and when the page changes under it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const button = menuButton(page);
    await button.click();
    await panelLinks(page).filter({ hasText: 'Blocks' }).click();
    await expect(page).toHaveURL(/#blocks$/);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(panelLinks(page)).toHaveCount(0);

    // The header outlives a client-side navigation, so a menu left open on
    // the page it was opened on would still be open on the next one.
    await page.goto('/docs');
    await page.getByRole('link', { name: 'Temply' }).first().click();
    await expect(page).toHaveURL('/');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await page.goBack();
    await expect(page).toHaveURL(/\/docs$/);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(panelLinks(page)).toHaveCount(0);

    // From another page the same link routes home to the section.
    await button.click();
    await panelLinks(page).filter({ hasText: 'Features' }).click();
    await expect(page).toHaveURL(/\/#features$/);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  test('closes when the page behind it is pressed', async ({ page }) => {
    await page.goto('/terms');
    const button = menuButton(page);
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    // The gutter: nothing there but the page.
    await page.mouse.click(4, 760);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(panelLinks(page)).toHaveCount(0);
  });

  test('closes when the window grows to where the bar holds the sections', async ({ page }) => {
    await page.goto('/');
    const button = menuButton(page);
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');

    await page.setViewportSize({ width: 1300, height: 900 });
    await expect(button).toBeHidden();
    await expect(header(page).getByRole('navigation', { name: 'Page sections' }).getByRole('link')).toHaveCount(4);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(panelLinks(page)).toHaveCount(0);
  });

  test('opens over the page without moving it, and the bar keeps its height', async ({ page }) => {
    await page.goto('/');
    const main = page.locator('main');
    const before = { main: await main.boundingBox(), bar: await header(page).boundingBox() };
    await menuButton(page).click();
    await expect(panelLinks(page)).toHaveCount(4);
    // Let the panel finish opening: a page that shifts does so as it grows.
    await expect.poll(async () => (await panel(page).boundingBox())?.height).toBeGreaterThan(200);
    const after = { main: await main.boundingBox(), bar: await header(page).boundingBox() };
    expect(after.main?.y).toBe(before.main?.y);
    expect(after.main?.height).toBe(before.main?.height);
    expect(after.bar?.height).toBe(before.bar?.height);
    // It hangs from the bar's lower edge.
    expect((await panel(page).boundingBox())?.y).toBeCloseTo((before.bar?.height ?? 0) - 1, 0);
  });

  test('animates its height, unless motion is reduced', async ({ page }) => {
    const transitioned = () => panel(page).evaluate((el) => getComputedStyle(el).transitionProperty);
    await page.goto('/');
    expect(await transitioned()).toContain('grid-template-rows');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await transitioned()).toBe('none');
  });

  for (const theme of THEMES) {
    test(`paints from the ${theme} tokens and fits the screen with the menu open`, async ({ page }) => {
      await open(page, '/', theme);
      await menuButton(page).click();
      await expect(panelLinks(page)).toHaveCount(4);

      const painted = await page.evaluate(() => {
        const probe = document.createElement('div');
        document.body.append(probe);
        const resolve = (property: 'background-color' | 'color', token: string) => {
          probe.style.cssText = `${property}: var(${token})`;
          return getComputedStyle(probe).getPropertyValue(property);
        };
        const out = {
          surface: resolve('background-color', '--ds-surface'),
          ink: resolve('color', '--ds-ink'),
          line: resolve('background-color', '--ds-line'),
        };
        probe.remove();
        const menu = document.getElementById('site-menu') as HTMLElement;
        const link = menu.querySelector('a') as HTMLElement;
        return {
          ...out,
          menu: getComputedStyle(menu).backgroundColor,
          bar: getComputedStyle(document.querySelector('header') as HTMLElement).backgroundColor,
          link: getComputedStyle(link).color,
          divider: getComputedStyle(link).borderTopColor,
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        };
      });
      expect(painted.menu).toBe(painted.surface);
      // Open, the bar is the same opaque surface as the panel under it.
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('header') as HTMLElement).backgroundColor)).toBe(painted.surface);
      expect(painted.link).toBe(painted.ink);
      expect(painted.scroll, 'the page scrolls sideways').toBeLessThanOrEqual(painted.client);
    });
  }
});

test.describe('the bar at the narrowest phone', () => {
  // 320px is the iPhone SE and the smallest width the layout promises: the
  // wordmark, the theme toggle, the sign-in button and the menu button have
  // to share it without scrolling the page or running off the right edge,
  // and with a 44px target each.
  for (const width of [320, 390]) {
    test(`fits at ${width}px, with the menu closed and open`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.goto('/');
      const bar = header(page);
      await expect(bar.getByRole('link', { name: 'Sign in' })).toBeVisible();
      await expect(menuButton(page)).toBeVisible();

      const closed = await overflow(page);
      expect(closed.scroll, `the bar overflows at ${width}px`).toBeLessThanOrEqual(closed.client);
      expect(closed.stray, `controls past the edge at ${width}px`).toEqual([]);

      await menuButton(page).click();
      await expect(panelLinks(page)).toHaveCount(4);
      const open = await overflow(page);
      expect(open.scroll, `the open menu overflows at ${width}px`).toBeLessThanOrEqual(open.client);
      expect(open.stray, `controls past the edge at ${width}px`).toEqual([]);
    });
  }
});

test.describe('the bar when someone is signed in', () => {
  // The cookie is Clerk's own hint, which is all the header reads; the
  // session behind it is not needed to see which button the bar chooses.
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: '__client_uat', value: '1', url: baseURL! }]);
  });

  test('offers Dashboard in the bar, at a phone width and a desktop one, in a bar that stays 72px', async ({ page }) => {
    for (const width of [320, 390, 1300]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');
      const bar = header(page);
      await expect(bar.getByRole('link', { name: 'Dashboard' })).toBeVisible();
      await expect(bar.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
      expect((await bar.boundingBox())?.height).toBeCloseTo(BAR, 0);
      const { scroll, client, stray } = await overflow(page);
      expect(scroll, `the bar overflows at ${width}px`).toBeLessThanOrEqual(client);
      expect(stray, `controls past the edge at ${width}px`).toEqual([]);
    }
  });
});
