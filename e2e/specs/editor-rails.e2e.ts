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

/** The box that holds a rail: it is the slot, not the landmark in it, that is 72px wide. */
const slot = (page: Page, landmark: string) => rail(page, landmark).locator('xpath=..');

const emailCanvas = (page: Page) => page.locator('section[aria-label="Email canvas"]');

const width = async (locator: Locator) => Math.round((await locator.boundingBox())!.width);

/** What a width transition is set to, `0s` when nothing is easing it. */
const easing = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).transitionDuration);

/** The frame's one scroller: the window does not scroll in the editor. */
const scroller = (page: Page) => page.locator('main#main-content');

/** Far more lines than any desktop window shows, so the canvas is the long thing on the page. */
const TALL_DOC = JSON.stringify({
  type: 'doc',
  content: Array.from({ length: 70 }, (_, i) => ({ type: 'paragraph', content: [{ type: 'text', text: `Line ${i + 1}` }] })),
});

/** How much further the scroller can go than it already shows. */
const spare = (page: Page) => scroller(page).evaluate((el) => el.scrollHeight - el.clientHeight);

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
      await expect.poll(() => width(slot(page, landmark))).toBe(open);
      const otherOpen = await width(slot(page, other.landmark));
      const wide = await width(emailCanvas(page));

      await panel.getByRole('button', { name: collapse }).click();
      // Focus follows the control: it would otherwise stay on a button that
      // has just gone inert.
      await expect(panel.getByRole('button', { name: expand })).toHaveAttribute('aria-expanded', 'false');
      await expect(panel.getByRole('button', { name: expand })).toBeFocused();
      await expect.poll(() => width(slot(page, landmark))).toBe(STRIP);
      await expect.poll(async () => (await width(emailCanvas(page))) - wide).toBe(open - STRIP);
      // The other rail is its own: it neither moves nor gives up width.
      expect(await width(slot(page, other.landmark))).toBe(otherOpen);

      await panel.getByRole('button', { name: expand }).click();
      await expect(panel.getByRole('button', { name: collapse })).toHaveAttribute('aria-expanded', 'true');
      await expect(panel.getByRole('button', { name: collapse })).toBeFocused();
      await expect.poll(() => width(slot(page, landmark))).toBe(open);
      await expect.poll(() => width(emailCanvas(page))).toBe(wide);
    });

    test(`the ${side} rail stays folded across a reload, and settles there without easing`, async ({ page, api, name }) => {
      const { id } = await api.createTemplate({ title: name(`${side} remembered`) });
      await openEditor(page, id);
      const panel = rail(page, landmark);

      await panel.getByRole('button', { name: collapse }).click();
      await expect.poll(() => width(slot(page, landmark))).toBe(STRIP);
      // A toggle the reader made is eased...
      expect(await easing(slot(page, landmark))).not.toBe('0s');
      expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe('collapsed');

      await page.reload();
      await canvas(page).waitFor();
      await expect(panel.getByRole('button', { name: expand })).toHaveAttribute('aria-expanded', 'false');
      await expect.poll(() => width(slot(page, landmark))).toBe(STRIP);
      // ...and a rail put back where it was left is not: it has nothing to
      // ease from, and one that slid shut on every load would be a tic.
      expect(await easing(slot(page, landmark))).toBe('0s');
      // The other rail was not touched.
      expect(await width(slot(page, other.landmark))).toBe(other.open);

      // Opening it remembers that too.
      await panel.getByRole('button', { name: expand }).click();
      await expect.poll(() => width(slot(page, landmark))).toBe(open);
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
    await expect.poll(() => width(slot(page, 'Components'))).toBe(STRIP);
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
    // The panel is the first thing in the email and the card is pinned beside
    // it, so from the foot of a long email a click would open a list nobody sees.
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

  // Eleven chips and a hint are taller than a laptop's scroller, and a rail
  // pinned at its natural height leaves its foot below the fold wherever the
  // page is scrolled to. The cap makes the chips scroll inside the rail
  // instead, so the last one can be reached without the page moving. Focus is
  // how a keyboard gets there, and it is what is measured: Playwright's own
  // click scrolls whatever it has to, and would pass for a rail that fits.
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
          await expect.poll(() => width(slot(page, 'Components'))).toBe(STRIP);
        }

        // The first preflight check puts its banner above the email a moment
        // after the editor attaches, and that is 75px under everything below
        // it. A page scrolled to the middle before then is carried down by the
        // same 75px (Chrome's scroll anchoring keeps the lines in view where
        // they were), and the check on the page not moving would be measuring
        // that rather than the rail. This document has no preview text, so
        // the banner is always there to wait for.
        await expect(page.getByRole('button', { name: /^Preflight/ })).toBeVisible();

        const port = scroller(page);
        await port.evaluate((el) => { el.scrollTop = (el.scrollHeight - el.clientHeight) / 2; });
        const mid = await port.evaluate((el) => el.scrollTop);
        expect(mid).toBeGreaterThan(300);

        const last = components.getByRole('button', { name: chip, exact: true });
        // The chips are off until the editor has attached, and a disabled one cannot take focus.
        await expect(last).toBeEnabled();
        await last.focus();
        // The page stays where the reader left it: the chips moved, not the canvas.
        expect(await port.evaluate((el) => el.scrollTop)).toBe(mid);
        const room = await last.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const view = el.closest('main')!.getBoundingClientRect();
          return { above: box.top - view.top, below: view.bottom - box.bottom };
        });
        // The focus ring is 3px of outline and 2px of offset, drawn outside the chip.
        expect(room.above).toBeGreaterThanOrEqual(5);
        expect(room.below).toBeGreaterThanOrEqual(5);

        await last.click();
        await expect(pm.locator('[data-type="repeat"]')).toHaveCount(1);
      });
    }
  });

  // A folded rail's open face is out of the flow and invisible, but without a
  // clip it still adds its height to what the page can scroll, so a short
  // email beside a folded rail would have a page of nothing below it. The
  // window is tall enough that the open left rail's natural height fits in the
  // room the frame fills below the workflow card, so once the right rail is
  // folded nothing else makes the page scroll. That fit has about 115px to
  // spare; a taller card above the rails spends it, so a change to the card's
  // height can fail the last assertion without touching a rail.
  test.describe('in a tall window', () => {
    test.use({ viewport: { width: 1300, height: 1500 } });

    test('a folded right rail leaves the page nothing to scroll that it did not need', async ({ page, api, name }) => {
      const { id } = await api.createTemplate({ title: name('fold scroll height') });
      await openEditor(page, id);
      const settings = rail(page, 'Email settings');

      // The open right rail already leaves the page with spare height at this
      // size; opening the brand's advanced fields only adds to it. Folding the
      // rail is what has to take all of it away again.
      await settings.getByRole('button', { name: 'Advanced' }).click();
      await expect.poll(() => spare(page)).toBeGreaterThan(100);

      await settings.getByRole('button', { name: 'Collapse email settings panel' }).click();
      await expect.poll(() => width(slot(page, 'Email settings'))).toBe(STRIP);
      await expect.poll(() => spare(page)).toBeLessThanOrEqual(1);
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
      expect(await width(slot(page, 'Components'))).toBeGreaterThan(700);
      expect(await width(slot(page, 'Email settings'))).toBeGreaterThan(700);
    });
  });
});
