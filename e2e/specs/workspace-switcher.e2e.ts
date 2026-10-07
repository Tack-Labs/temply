import { onPhone } from '../fixtures/project';
import { test, expect } from '../fixtures/test';
import type { Locator, Page } from '@playwright/test';

// The workspace switcher the sidebar hands to Clerk, read where a signed-in
// customer meets it. Clerk's stylesheet outranks anything the app hands its
// elements, so globals.css pins the trigger's size, border, corners and
// spacing, and whether those pins win can only be seen in a browser with
// Clerk's own CSS loaded. This is that look, in both themes, closed and open.
//
// Chromium floors a border to whole CSS pixels unless the screen itself has
// the density to draw the fraction, and the density a context emulates is not
// one (see redesign-primitives). Launch options belong to the worker, which is
// why this is a file of its own: the shell cases keep the density they were
// written at. The phone drawer holds the same trigger under the same rules, and
// its emulated density of 3 would draw a 1.5px border as 1.33px, so it is not
// repeated there.
test.use({ launchOptions: { args: ['--force-device-scale-factor=2'] } });

type Theme = 'light' | 'dark';

/** What the page's own token paints as, read through a probe so retuning the palette cannot break a case. */
const painted = (page: Page, property: 'background-color' | 'color' | 'border-top-left-radius', token: string) =>
  page.evaluate(
    ([prop, name]) => {
      const probe = document.createElement('div');
      document.body.append(probe);
      probe.style.cssText = `${prop}: var(${name})`;
      const value = getComputedStyle(probe).getPropertyValue(prop);
      probe.remove();
      return value;
    },
    [property, token] as const,
  );

const computed = (target: Locator, property: string) =>
  target.evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), property);

/** Opens the dashboard with the theme chosen the way the blocking script in layout.tsx reads it. */
async function open(page: Page, theme: Theme) {
  await page.addInitScript((chosen) => localStorage.setItem('theme', chosen), theme);
  await page.goto('/dashboard/templates');
  const sidebar = page.getByRole('complementary', { name: 'Workspace' });
  const trigger = sidebar.locator('.cl-organizationSwitcherTrigger');
  await expect(trigger).toBeVisible();
  // Faces that arrive late reflow the trigger, and a measure taken before they
  // do is of a layout that is about to change.
  await page.evaluate(() => document.fonts.ready);
  return { sidebar, trigger };
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`the workspace switcher in the ${theme} theme`, () => {
    test.beforeEach(() => {
      test.skip(onPhone(), 'the drawer holds the same trigger; see the note at the top');
    });

    test('is a nav row dressed as a card, and its avatar sits on the line of the icons under it', async ({ page }, info) => {
      const { sidebar, trigger } = await open(page, theme);

      // A nav row's 44px target, drawn 1.5px in and 14px round.
      expect((await trigger.boundingBox())?.height).toBeCloseTo(44, 0);
      expect(await computed(trigger, 'border-top-width')).toBe('1.5px');
      expect(await computed(trigger, 'border-top-left-radius')).toBe(await painted(page, 'border-top-left-radius', '--radius-field'));
      expect(await computed(trigger, 'background-color')).toBe(await painted(page, 'background-color', '--ds-raised'));

      // 14px of row padding less the border: the avatar lands where the nav
      // icons do, and the name sits 12px past it, the nav labels' distance.
      expect(await computed(trigger, 'padding-left')).toBe('12.5px');
      const preview = trigger.locator('.cl-organizationPreview');
      expect(await computed(preview, 'column-gap')).toBe('12px');
      const avatar = await preview.locator('> *').first().boundingBox();
      const icon = await sidebar.getByRole('navigation', { name: 'Dashboard' }).getByRole('link', { name: 'Overview', exact: true }).locator('svg').first().boundingBox();
      if (!avatar || !icon) throw new Error('the avatar and a nav icon both need a box to be compared');
      expect(Math.abs(avatar.x - icon.x), 'the avatar and the nav icons share a left edge').toBeLessThanOrEqual(1);

      // The name is read from the live tokens, not from Clerk's palette.
      expect(await computed(trigger.locator('.cl-organizationPreviewMainIdentifier'), 'color')).toBe(await painted(page, 'color', '--ds-ink'));

      const closed = info.outputPath(`switcher-${theme}-closed.png`);
      await trigger.screenshot({ path: closed });
      await info.attach(`switcher-${theme}-closed`, { path: closed, contentType: 'image/png' });
    });

    test('opens its menu on the page, in the same theme', async ({ page }, info) => {
      const { trigger } = await open(page, theme);
      await trigger.click();
      const menu = page.locator('.cl-organizationSwitcherPopoverCard');
      await expect(menu).toBeVisible();
      // Clerk's own entrance finishes before the picture is taken.
      await expect.poll(async () => (await menu.boundingBox())?.height ?? 0).toBeGreaterThan(0);
      await page.evaluate(() => document.fonts.ready);

      const shot = info.outputPath(`switcher-${theme}-open.png`);
      await page.screenshot({ path: shot, clip: await clipAround(trigger, menu) });
      await info.attach(`switcher-${theme}-open`, { path: shot, contentType: 'image/png' });
    });
  });
}

/** The smallest rectangle holding the trigger and its menu, padded for their shadows. */
async function clipAround(a: Locator, b: Locator) {
  const [one, two] = await Promise.all([a.boundingBox(), b.boundingBox()]);
  if (!one || !two) throw new Error('the trigger and its menu both need a box to be pictured');
  const pad = 16;
  const x = Math.max(0, Math.min(one.x, two.x) - pad);
  const y = Math.max(0, Math.min(one.y, two.y) - pad);
  return {
    x,
    y,
    width: Math.max(one.x + one.width, two.x + two.width) + pad - x,
    height: Math.max(one.y + one.height, two.y + two.height) + pad - y,
  };
}
