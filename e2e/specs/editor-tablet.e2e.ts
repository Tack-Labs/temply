import { test, expect } from '../fixtures/test';
import { bubbleMenu, openEditor } from '../fixtures/canvas';

/** The smallest a touch target is designed to be. */
const FINGER = 44;

/** Every control the toolbar draws, as width × height. */
async function targets(menu: ReturnType<typeof bubbleMenu>) {
  return menu.getByRole('button').evaluateAll((els) =>
    els.map((el) => {
      const rect = el.getBoundingClientRect();
      return { name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '?', w: Math.round(rect.width), h: Math.round(rect.height) };
    }),
  );
}

// A tablet is above the phone breakpoint, so it gets the desktop editor and
// edits with it — but it reaches that editor with a finger. iPad metrics on
// Chromium, because WebKit is the nightly tier rather than this one. The
// same probe was run against WebKit before these were written and answered
// the same on all four counts — the coarse pointer, the absent hover, the
// handle a tap brings out, and the 44px the rule gives the toolbar — so
// Chromium is standing in here, not guessing.
test.describe('editor on a tablet', () => {
  // Portrait, the narrowest a tablet gets while still above the phone
  // breakpoint: finger-sized controls make the toolbar wider, and this is
  // where that shows.
  test.use({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true });

  test('the bubble menu is built from finger-sized targets', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('tablet') });
    const pm = await openEditor(page, t.id);

    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches),
      'the emulated tablet is a coarse pointer, which is what the rule keys on').toBe(true);

    await pm.getByText('Hello from e2e').tap();
    await page.keyboard.press('ControlOrMeta+A');
    const menu = bubbleMenu(page, 'Text formatting');
    await expect(menu).toBeVisible();

    // Read on the far side of the beat tiptap re-asks each menu after: a
    // toolbar measured while it is still arriving has not been laid out.
    await expect.poll(async () => (await targets(menu)).length, { message: 'the toolbar has its controls' }).toBeGreaterThan(3);
    const small = (await targets(menu)).filter((t) => t.w < FINGER || t.h < FINGER);
    expect(small, `every control is at least ${FINGER}px square for a finger`).toEqual([]);

    // Wider controls make a wider toolbar, and it still has to fit.
    const box = await menu.boundingBox();
    expect(box, 'the toolbar is laid out').not.toBeNull();
    expect(box!.x, 'the toolbar starts on screen').toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, 'the toolbar ends on screen').toBeLessThanOrEqual(768);
  });
});

test.describe('editor under a mouse', () => {
  test('the same menu stays compact', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('mouse') });
    const pm = await openEditor(page, t.id);
    await pm.getByText('Hello from e2e').click();
    await page.keyboard.press('ControlOrMeta+A');
    const menu = bubbleMenu(page, 'Text formatting');
    await expect(menu).toBeVisible();

    // The finger sizing is asked for by `(pointer: coarse)` alone. A mouse
    // keeps the 28px buttons the menu was drawn around.
    await expect.poll(async () => (await targets(menu)).length).toBeGreaterThan(3);
    const grown = (await targets(menu)).filter((t) => t.h >= FINGER);
    expect(grown, 'a mouse is not given touch sizing').toEqual([]);
  });
});
