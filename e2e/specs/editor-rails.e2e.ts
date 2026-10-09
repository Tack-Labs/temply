import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { onPhone } from '../fixtures/editor';
import { canvas, openEditor } from '../fixtures/canvas';

// The framed editor's two rails: the Components rail on the left and the
// Email settings rail on the right. Each folds to a 72px strip and back, and
// the fold is remembered per rail in this browser. Role locators are scoped
// to a landmark throughout: the slash menu also has a "Components" group, and
// the canvas carries its own "Preflight" disclosure.

const STRIP = 72;

// The open widths at the desktop project's 1300px, which is `xl`: 16.5rem and
// 20rem. A narrower window gives narrower rails, so these are not general.
const RAILS = [
  {
    side: 'left',
    landmark: 'Components',
    collapse: 'Collapse components panel',
    expand: 'Expand components panel',
    open: 264,
    key: 'temply.editor.rail.left',
  },
  {
    side: 'right',
    landmark: 'Email settings',
    collapse: 'Collapse email settings panel',
    expand: 'Expand email settings panel',
    open: 320,
    key: 'temply.editor.rail.right',
  },
] as const;

const rail = (page: Page, landmark: string) => page.getByRole('complementary', { name: landmark });

/** The box around a rail's card, which is the one that eases its width. */
const slot = (page: Page, landmark: string) => rail(page, landmark).locator('xpath=..');

const emailCanvas = (page: Page) => page.locator('section[aria-label="Email canvas"]');

const width = async (locator: Locator) => Math.round((await locator.boundingBox())!.width);

/** What a width transition is set to, `0s` when nothing is easing it. */
const easing = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).transitionDuration);

/** The one scroller on a wide screen: neither the window nor the frame around the editor scrolls. */
/** The editor's frame: from lg the one box that scrolls, with the rails sticky inside it. */
const scroller = (page: Page) => page.locator('[data-editor-frame]');

/** Far more lines than any desktop window shows, so the canvas is the long thing on the page. */
const TALL_DOC = JSON.stringify({
  type: 'doc',
  content: Array.from({ length: 70 }, (_, i) => ({ type: 'paragraph', content: [{ type: 'text', text: `Line ${i + 1}` }] })),
});

test.beforeEach(() => {
  test.skip(onPhone(), 'The phone has a shell of its own, with no rails.');
});

test.describe('editor rails', () => {
  for (const { side, landmark, collapse, expand, open, key } of RAILS) {
    // The rail on the other side, which a fold here has to leave alone.
    const other = RAILS.find((r) => r.side !== side)!;

    test(`the ${side} rail folds to a ${STRIP}px strip, widens the canvas, and unfolds again`, async ({ page, api, name }) => {
      const { id } = await api.createTemplate({ title: name(`${side} fold`) });
      await openEditor(page, id);
      const panel = rail(page, landmark);

      await expect(panel.getByRole('button', { name: collapse })).toHaveAttribute('aria-expanded', 'true');
      await expect.poll(() => width(rail(page, landmark))).toBe(open);
      const otherOpen = await width(rail(page, other.landmark));
      const wide = await width(emailCanvas(page));
      // The email's own box. With both rails open at this width there is no
      // room to hold the frame's centre line, so the email sits centred
      // between the rails on the 24px gutters; a fold frees room on one side
      // and the email takes it, still centred between the strip and the
      // other rail. It never narrows, and never leaves its gutters.
      const email = () => emailCanvas(page).locator('article').evaluate((el) => {
        const { left, width } = el.getBoundingClientRect();
        const canvas = el.closest('section[aria-label="Email canvas"]')!.getBoundingClientRect();
        return {
          width: Math.round(width),
          offCentre: Math.abs(Math.round(left + width / 2 - (canvas.left + canvas.width / 2))),
          inset: Math.round(Math.min(left - canvas.left, canvas.right - (left + width))),
        };
      });
      const emailAtRest = await email();
      expect(emailAtRest.offCentre, 'the email starts centred between the rails').toBeLessThanOrEqual(1);
      expect(emailAtRest.inset, 'the email keeps the canvas\'s 24px gutter').toBeGreaterThanOrEqual(24);

      await panel.getByRole('button', { name: collapse }).click();
      // Focus follows the control: it would otherwise stay on a button that
      // has just gone inert.
      await expect(panel.getByRole('button', { name: expand })).toHaveAttribute('aria-expanded', 'false');
      await expect(panel.getByRole('button', { name: expand })).toBeFocused();
      await expect.poll(() => width(rail(page, landmark))).toBe(STRIP);
      await expect.poll(async () => (await width(emailCanvas(page))) - wide).toBe(open - STRIP);
      // The other rail is its own: it neither moves nor gives up width.
      expect(await width(rail(page, other.landmark))).toBe(otherOpen);
      // The email took the room: no narrower, still centred between the rails, still in its gutters.
      await expect.poll(async () => (await email()).width).toBeGreaterThanOrEqual(emailAtRest.width);
      await expect.poll(async () => (await email()).offCentre, 'the email is centred between the strip and the other rail').toBeLessThanOrEqual(1);
      expect((await email()).inset, 'the email keeps the canvas\'s 24px gutter').toBeGreaterThanOrEqual(24);

      await panel.getByRole('button', { name: expand }).click();
      await expect(panel.getByRole('button', { name: collapse })).toHaveAttribute('aria-expanded', 'true');
      await expect(panel.getByRole('button', { name: collapse })).toBeFocused();
      await expect.poll(() => width(rail(page, landmark))).toBe(open);
      await expect.poll(() => width(emailCanvas(page))).toBe(wide);
    });

    test(`the ${side} rail stays folded across a reload, and settles there without easing`, async ({ page, api, name }) => {
      const { id } = await api.createTemplate({ title: name(`${side} remembered`) });
      await openEditor(page, id);
      const panel = rail(page, landmark);

      await panel.getByRole('button', { name: collapse }).click();
      await expect.poll(() => width(rail(page, landmark))).toBe(STRIP);
      // A toggle the reader made is eased...
      expect(await easing(slot(page, landmark))).not.toBe('0s');
      expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe('collapsed');

      await page.reload();
      await canvas(page).waitFor();
      await expect(panel.getByRole('button', { name: expand })).toHaveAttribute('aria-expanded', 'false');
      await expect.poll(() => width(rail(page, landmark))).toBe(STRIP);
      // ...and a rail put back where it was left is not: it has nothing to
      // ease from, and one that slid shut on every load would be a tic.
      expect(await easing(slot(page, landmark))).toBe('0s');
      // The other rail was not touched.
      expect(await width(rail(page, other.landmark))).toBe(other.open);

      // Opening it remembers that too.
      await panel.getByRole('button', { name: expand }).click();
      await expect.poll(() => width(rail(page, landmark))).toBe(open);
      await page.reload();
      await canvas(page).waitFor();
      await expect(panel.getByRole('button', { name: collapse })).toHaveAttribute('aria-expanded', 'true');
    });
  }

  test('a chip on the folded strip adds a block just as the open panel does', async ({ page, api, name }) => {
    const { id } = await api.createTemplate({ title: name('chip') });
    const pm = await openEditor(page, id);
    const components = rail(page, 'Components');

    await components.getByRole('button', { name: 'Collapse components panel' }).click();
    await expect.poll(() => width(rail(page, 'Components'))).toBe(STRIP);
    await expect(pm.locator('hr')).toHaveCount(0);

    // The block goes below the one the caret is in, so the caret goes in first.
    await pm.getByText('Hello from e2e').click();
    await components.getByRole('button', { name: 'Add divider' }).click();
    await expect(pm.locator('hr')).toHaveCount(1);
    await expect(pm).toBeFocused();
    // Below the line the caret was in, not above it.
    await expect(pm.locator('> *').first()).toHaveText('Hello from e2e');

    // The strip names what each chip adds, since it has no words of its own.
    for (const label of ['Add text', 'Add heading', 'Add subheading', 'Add image', 'Add logo', 'Add button', 'Add columns', 'Add spacer', 'Add section', 'Add repeating list']) {
      await expect(components.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  test('the open Components rail names its blocks in two groups and adds one on a click', async ({ page, api, name }) => {
    const { id } = await api.createTemplate({ title: name('panel') });
    const pm = await openEditor(page, id);
    const components = rail(page, 'Components');

    await expect(components.getByRole('heading', { name: 'Components', level: 2 })).toBeVisible();
    await expect(components.getByRole('group', { name: 'Content' }).getByRole('button')).toHaveText(['Text', 'Heading', 'Subheading', 'Image', 'Logo', 'Button']);
    await expect(components.getByRole('group', { name: 'Layout' }).getByRole('button')).toHaveText(['Columns', 'Divider', 'Spacer', 'Section', 'Repeating list']);

    await pm.getByText('Hello from e2e').click();
    await components.getByRole('button', { name: 'Divider', exact: true }).click();
    await expect(pm.locator('hr')).toHaveCount(1);
  });

  test('the status card counts what preflight found, in the same words as the folded dot', async ({ page, api, name }) => {
    // A template made through the API has a subject and no preview text: one
    // warning, and nothing else in a plain paragraph.
    const { id } = await api.createTemplate({ title: name('status'), previewText: '' });
    await openEditor(page, id);
    const settings = rail(page, 'Email settings');
    const card = settings.getByRole('button', { name: /^Worth a look/ });

    // The checks run a beat after the editor does, and until they have the
    // card says "Checking" with no counts, so it is never briefly clear. That
    // window is too short to assert on without racing it: wait for the finding.
    await expect(card).toContainText('0 errors · 1 warning');
    await expect(card).toHaveAttribute('aria-expanded', 'false');
    // The card is not the preflight panel's own header, which a spec in
    // checks.e2e.ts finds by its leading word.
    await expect(page.getByRole('button', { name: /^Preflight/ })).toHaveCount(1);

    // Folded, the dot carries the same verdict as a name.
    await settings.getByRole('button', { name: 'Collapse email settings panel' }).click();
    await expect(settings.getByRole('img', { name: 'Worth a look, 0 errors, 1 warning' })).toBeVisible();

    // Its one chip opens the form where the subject is.
    await settings.getByRole('button', { name: /^Email settings: subject/ }).click();
    await expect(settings.getByLabel('Subject', { exact: true })).toBeFocused();

    await settings.getByLabel('Inbox preview text').fill('A line for the inbox');
    await expect(settings.getByText('All clear', { exact: true })).toBeVisible();
    await expect(settings.getByText('0 errors · 0 warnings', { exact: true })).toBeVisible();
    // With nothing to open, the card is a statement rather than a control.
    await expect(settings.getByRole('button', { name: /^All clear/ })).toHaveCount(0);

    await settings.getByLabel('Subject', { exact: true }).fill('');
    await expect(settings.getByRole('button', { name: /^Needs fixing/ })).toContainText('1 error · 0 warnings');
    await settings.getByRole('button', { name: 'Collapse email settings panel' }).click();
    await expect(settings.getByRole('img', { name: 'Needs fixing, 1 error, 0 warnings' })).toBeVisible();
  });

  test('the status card opens the preflight panel it summarises', async ({ page, api, name }) => {
    const { id } = await api.createTemplate({ title: name('status opens'), previewText: '' });
    await openEditor(page, id);
    const settings = rail(page, 'Email settings');
    const header = page.getByRole('button', { name: /^Preflight/ });

    await expect(settings.getByRole('button', { name: /^Worth a look/ })).toBeVisible();
    await expect(header).toHaveAttribute('aria-expanded', 'false');

    await settings.getByRole('button', { name: /^Worth a look/ }).click();
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Add preview text, or inboxes will show the first line of the email.')).toBeVisible();
    await expect(settings.getByRole('button', { name: /^Worth a look/ })).toHaveAttribute('aria-expanded', 'true');
  });

  test('the status card brings the preflight panel into view when the canvas is scrolled away from it', async ({ page, api, name }) => {
    // The panel is the first thing in the email and the card floats beside it,
    // so from the foot of a long email a click would open a list nobody sees.
    const { id } = await api.createTemplate({ title: name('status reveals'), previewText: '', content: TALL_DOC });
    await openEditor(page, id);
    const settings = rail(page, 'Email settings');
    const header = page.getByRole('button', { name: /^Preflight/ });
    const card = settings.getByRole('button', { name: /^Worth a look/ });
    await expect(card).toBeVisible();

    await scroller(page).evaluate((el) => { el.scrollTop = el.scrollHeight; });
    // Without this the case would pass for a page that never scrolled.
    await expect(header).not.toBeInViewport();

    await card.click();
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    // Easing or jumping, it ends with the header whole on screen and the list under it.
    await expect(header).toBeInViewport({ ratio: 1 });
    await expect(page.getByText('Add preview text, or inboxes will show the first line of the email.')).toBeInViewport();
  });

  // Eleven chips and a hint are taller than a laptop's rail. The rail is a card
  // of its own height with the heading pinned, so the chips scroll inside it
  // and the last one can be reached without the canvas moving. Focus is how a
  // keyboard gets there, and it is what is measured: Playwright's own click
  // scrolls whatever it has to, and would pass for a rail that fits.
  test.describe('on a laptop screen', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    for (const { state, chip, folded } of [
      { state: 'open', chip: 'Repeating list', folded: false },
      { state: 'folded', chip: 'Add repeating list', folded: true },
    ]) {
      test(`the last component chip is within reach from mid-page, ${state}`, async ({ page, api, name }) => {
        const { id } = await api.createTemplate({ title: name(`last chip ${state}`), content: TALL_DOC });
        const pm = await openEditor(page, id);
        const components = rail(page, 'Components');
        if (folded) {
          await components.getByRole('button', { name: 'Collapse components panel' }).click();
          await expect.poll(() => width(rail(page, 'Components'))).toBe(STRIP);
        }

        // The first preflight check puts its banner above the email a moment
        // after the editor attaches, and that is 75px under everything below
        // it. A canvas scrolled to the middle before then is carried down by
        // the same 75px (Chrome's scroll anchoring keeps the lines in view
        // where they were), and the check on the canvas not moving would be
        // measuring that rather than the rail. This document has no preview
        // text, so the banner is always there to wait for.
        await expect(page.getByRole('button', { name: /^Preflight/ })).toBeVisible();

        const port = scroller(page);
        await port.evaluate((el) => { el.scrollTop = (el.scrollHeight - el.clientHeight) / 2; });
        const mid = await port.evaluate((el) => el.scrollTop);
        expect(mid).toBeGreaterThan(300);

        const last = components.getByRole('button', { name: chip, exact: true });
        // The chips are off until the editor has attached, and a disabled one cannot take focus.
        await expect(last).toBeEnabled();
        await last.focus();
        // The canvas stays where the reader left it: the chips moved, not the email.
        expect(await port.evaluate((el) => el.scrollTop)).toBe(mid);
        const room = await last.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const view = el.closest('aside')!.getBoundingClientRect();
          return { above: box.top - view.top, below: view.bottom - box.bottom };
        });
        // The focus ring is 3px of outline and 2px of offset, drawn outside the chip.
        expect(room.above).toBeGreaterThanOrEqual(5);
        expect(room.below).toBeGreaterThanOrEqual(5);

        await last.click();
        await expect(pm.locator('[data-type="repeat"]')).toHaveCount(1);
      });
    }

    test('the settings form scrolls inside its card while the status card stays in view', async ({ page, api, name }) => {
      const { id } = await api.createTemplate({ title: name('settings scroll'), previewText: '' });
      await openEditor(page, id);
      const settings = rail(page, 'Email settings');
      const status = settings.getByRole('button', { name: /^Worth a look/ });
      await expect(status).toBeVisible();

      // Brand's advanced fields make the form longer than a 720px card.
      await settings.getByRole('button', { name: 'Advanced' }).click();
      const form = settings.getByLabel('Subject', { exact: true }).locator('xpath=ancestor::div[contains(@class,"overflow-y-auto")][1]');
      await expect.poll(() => form.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);

      await form.evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await expect(status).toBeInViewport({ ratio: 1 });
      // The card holds its place; only the form moved under the heading.
      await expect(settings.getByRole('heading', { name: 'Email settings', level: 2 })).toBeInViewport({ ratio: 1 });
      await expect(settings.getByLabel('Subject', { exact: true })).not.toBeInViewport();
    });
  });

  // The canvas is the one thing on a wide page that scrolls, and the rails are
  // cards with a margin of their own, so the template is in view as the page
  // opens and stays put under whatever the reader scrolls.
  test.describe('the canvas and the cards around it', () => {
    test('the canvas is the only scroller, and the rails and the workflow bar stay where they are', async ({ page, api, name }) => {
      const { id } = await api.createTemplate({ title: name('canvas scroll'), previewText: '', content: TALL_DOC });
      await openEditor(page, id);
      // See the laptop case: the banner lands after the editor and moves what is under it.
      await expect(page.getByRole('button', { name: /^Preflight/ })).toBeVisible();

      const extent = (selector: string) => page.locator(selector).first().evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
      const windowFit = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, client: window.innerHeight }));
      expect(windowFit.scroll).toBeLessThanOrEqual(windowFit.client);
      const main = await extent('main#main-content');
      expect(main.scroll).toBeLessThanOrEqual(main.client);
      const long = await scroller(page).evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
      expect(long.scroll).toBeGreaterThan(long.client);

      // The tab row is the fixed thing above the canvas: it, and the rails,
      // stay where they are while the canvas scrolls under them.
      const tabs = page.getByRole('navigation', { name: 'Template' });
      const top = async (locator: Locator) => Math.round((await locator.boundingBox())!.y);
      const before = [await top(tabs), await top(rail(page, 'Components')), await top(rail(page, 'Email settings'))];
      await scroller(page).evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await expect.poll(() => scroller(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(300);
      expect([await top(tabs), await top(rail(page, 'Components')), await top(rail(page, 'Email settings'))]).toEqual(before);
      await expect(tabs).toBeInViewport({ ratio: 1 });
    });

    test('the template is in view without scrolling, under a bar that is short', async ({ page, api, name }) => {
      const { id } = await api.createTemplate({ title: name('no scroll to template') });
      const pm = await openEditor(page, id);
      await expect(page.getByRole('button', { name: /^Preflight/ })).toBeVisible();

      await expect(pm.getByText('Hello from e2e')).toBeInViewport({ ratio: 1 });
      // The bar was three stacked boxes tall enough to push the email off a
      // laptop screen. The canvas now starts in the top third of the window.
      const canvasTop = (await emailCanvas(page).boundingBox())!.y;
      expect(canvasTop).toBeLessThan(page.viewportSize()!.height / 3);
    });

    test('the rails are cards over the canvas, inset from its edges and lifted', async ({ page, api, name }) => {
      const { id } = await api.createTemplate({ title: name('floating rails') });
      await openEditor(page, id);
      const area = (await emailCanvas(page).boundingBox())!;

      for (const landmark of ['Components', 'Email settings']) {
        const card = rail(page, landmark);
        const box = (await card.boundingBox())!;
        // 0.75rem of the page's surface above and below, and rounded and lifted.
        expect(Math.round(box.y - area.y)).toBe(12);
        expect(Math.round(area.y + area.height - (box.y + box.height))).toBe(12);
        const look = await card.evaluate((el) => {
          const style = getComputedStyle(el);
          return { shadow: style.boxShadow, radius: parseFloat(style.borderTopLeftRadius) };
        });
        expect(look.shadow).not.toBe('none');
        expect(look.radius).toBeGreaterThan(0);
      }
    });
  });

  test.describe('below lg', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('the rails stack around the canvas and cannot fold, whatever was remembered', async ({ page, api, name }) => {
      const { id } = await api.createTemplate({ title: name('stacked') });
      // A fold made on a wide screen is still in storage when the window is
      // narrow: it must not hide a rail that has no strip to fall back to.
      await page.addInitScript(() => {
        localStorage.setItem('temply.editor.rail.left', 'collapsed');
        localStorage.setItem('temply.editor.rail.right', 'collapsed');
      });
      await openEditor(page, id);

      const components = rail(page, 'Components');
      const settings = rail(page, 'Email settings');
      await expect(components.getByRole('heading', { name: 'Components', level: 2 })).toBeVisible();
      await expect(settings.getByRole('heading', { name: 'Email settings', level: 2 })).toBeVisible();
      await expect(page.getByRole('button', { name: /^(Collapse|Expand) (components|email settings) panel$/ })).toHaveCount(0);
      expect(await width(rail(page, 'Components'))).toBeGreaterThan(700);
      expect(await width(rail(page, 'Email settings'))).toBeGreaterThan(700);
    });
  });
});
