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

/** A tap near the block's top-left: inside its text, clear of any control
 *  a node view draws on its right. */
async function tap(page: Page, block: Locator): Promise<void> {
  await block.scrollIntoViewIfNeeded();
  const box = await block.boundingBox();
  if (!box) throw new Error(`tap: ${block} is not on screen`);
  await page.mouse.click(box.x + 20, box.y + Math.min(10, box.height / 2));
}

export const phone = {
  /** One tap selects the block: the action bar appears, the keyboard does not. */
  tapBlock: tap,
  /** A second tap on the selected block places the caret and brings up the text bar. */
  async editBlock(page: Page, block: Locator): Promise<void> {
    await tap(page, block);
    await tap(page, block);
  },
  /** The bottom bar's controls by their names, as a screen reader hears them. */
  bar(page: Page) {
    return {
      button: (name: 'Move up' | 'Move down' | 'Style' | 'Duplicate' | 'Delete' | 'Done') => page.getByRole('button', { name, exact: true }),
      add: () => page.getByRole('button', { name: 'Add block' }),
    };
  },
};
