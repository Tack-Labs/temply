import { expect, test } from '@playwright/test';
import { bubbleMenu, hoverControl, slashRow } from '../fixtures/canvas';

test.use({ storageState: { cookies: [], origins: [] } });

test('a Section hint leaves Escape available to dismiss its toolbar', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The phone playground does not edit the document.');
  await page.goto('/playground');
  const pm = page.locator('.ProseMirror');
  await pm.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('The line above');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/');
  await slashRow(page, 'Section').click();
  await page.keyboard.type('Inside');
  await expect(pm.locator('table[data-type="section"]')).toContainText('Inside');

  const menu = bubbleMenu(page, 'Section');
  await hoverControl(page, menu.getByRole('button', { name: 'Delete Section' }));
  await expect(page.getByRole('tooltip', { name: 'Delete Section', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await pm.getByText('The line above', { exact: true }).click();
  await page.keyboard.type('!');
  await expect(pm.locator('> p').first()).toContainText('!');
});
