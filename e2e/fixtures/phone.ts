import type { Locator, Page } from '@playwright/test';

/**
 * Playwright's iPhone descriptor sets touch and the viewport but not
 * `(pointer: coarse)`, which the editor's CSS keys its touch sizing and
 * selection outline on, so it goes through CDP. Reduced motion rides along:
 * the phone shell's sheets transition on show and hide, and a test that
 * asserts what is on screen should not wait on them.
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
 * the client. A tap before that lands on a shell whose model has no editor
 * yet and quietly does nothing.
 */
async function ready(page: Page): Promise<void> {
  await page.locator('.ProseMirror').waitFor();
}

export const phone = {
  ready,
  /** The bottom bar's controls by their names, as a screen reader hears
   *  them. Scoped to the bar: a sheet above it can carry the same name. The
   *  bar is always its one sections-nav face — a read-only canvas never
   *  raises a selection for it to answer with another. */
  bar(page: Page) {
    const bar = page.locator('[data-editor-bottom-bar]');
    return {
      button: (name: string) => bar.getByRole('button', { name, exact: true }),
    };
  },
  /** A bottom sheet by its name; every one carries a Close button. */
  sheet: (page: Page, name: string): Locator => page.getByRole('dialog', { name }),
};
