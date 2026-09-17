import type { Locator, Page } from '@playwright/test';

/**
 * Playwright's iPhone descriptor sets touch and the viewport but not
 * `(pointer: coarse)`, which the editor's CSS keys its touch sizing and
 * selection outline on, so it goes through CDP. Reduced motion rides along:
 * the phone shell's sheets and bar faces transition on show and hide, and a
 * test that asserts what is on screen should not wait on them.
 */
export async function emulateCoarsePointer(page: Page): Promise<void> {
  // A CDP session is Chromium's; a WebKit project (the nightly tier) has no
  // such thing, and will need to skip this or emulate another way.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'pointer', value: 'coarse' },
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ],
  });
}

/**
 * The editor has mounted: the canvas exists only once TipTap attaches on
 * the client. A tap or a + before that lands on a shell whose model has no
 * editor yet and quietly does nothing.
 */
async function ready(page: Page): Promise<void> {
  await page.locator('.ProseMirror').waitFor();
}

/** A tap near the block's top-left: inside its text, clear of any control
 *  a node view draws on its right. */
async function tap(page: Page, block: Locator): Promise<void> {
  await ready(page);
  await block.scrollIntoViewIfNeeded();
  const box = await block.boundingBox();
  if (!box) throw new Error(`tap: ${block} is not on screen`);
  await page.mouse.click(box.x + 20, box.y + Math.min(10, box.height / 2));
}

const live = (page: Page): Locator => page.locator(':not([inert]):not([inert] *)');

export const phone = {
  ready,
  /** Only what the customer can actually reach. All four faces of the bottom
   *  bar stay mounted and the three that are down are `inert`, which takes
   *  them out of the browser's accessibility tree — but Playwright's role
   *  engine honours `aria-hidden` and `display: none` only, and the faces
   *  share one stretched grid cell so even a down one keeps its box. `and()`
   *  this into any locator whose point is which face is up, or it will match
   *  in every state and assert nothing. */
  live,
  /** One tap selects the block: the action bar appears, the keyboard does not. */
  tapBlock: tap,
  /** A second tap on the selected block places the caret and brings up the text bar. */
  async editBlock(page: Page, block: Locator): Promise<void> {
    await tap(page, block);
    await tap(page, block);
  },
  /** The bottom bar's controls by their names, as a screen reader hears them.
   *  Scoped to the bar: a sheet above it can carry the same name — while a
   *  Button's Style sheet is open, `Style` is both the bar's button and a
   *  dropdown inside the sheet. The + rides above the bar, not in it. */
  bar(page: Page) {
    const bar = page.locator('[data-editor-bottom-bar]');
    return {
      button: (name: string) => bar.getByRole('button', { name, exact: true }).and(live(page)),
      add: () => page.getByRole('button', { name: 'Add block' }).and(live(page)),
    };
  },
  /** A bottom sheet by its name; every one carries a Close button. */
  sheet: (page: Page, name: string): Locator => page.getByRole('dialog', { name }),
  /** Opens the selected block's Style sheet. Its name is the block's kind —
   *  "Text", "Image", "Repeat" — or "Style" when nothing names it. */
  async style(page: Page, name: string): Promise<Locator> {
    await phone.bar(page).button('Style').click();
    return page.getByRole('dialog', { name });
  },
  /** The input dock: a form named by the surface that opened it, live like
   *  the bar. The dock keeps its last spec mounted so its exit can animate,
   *  and the closed field face collapses the row it sits in rather than
   *  unmounting it — the form is clipped to nothing but keeps a box of its
   *  own, which Playwright still reads as visible. So the face's `inert` is
   *  the only thing that says the dock is shut, and without this filter
   *  `toBeVisible` would pass in every state. */
  dock: (page: Page, title: string): Locator => page.getByRole('form', { name: title }).and(live(page)),
};
