import type { Page } from '@playwright/test';

/**
 * A template's own link in the dashboard list. A published template's row also
 * carries an "Edit draft" button to the same page, whose label holds the title
 * so a screen reader can tell the rows' buttons apart; a name match alone finds
 * both. The row's link is the one without a label of its own.
 */
export function templateLink(page: Page, title: string) {
  return page.getByRole('link', { name: title }).and(page.locator('a:not([aria-label])'));
}
