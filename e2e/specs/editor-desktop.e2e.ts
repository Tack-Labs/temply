import { test, expect } from '../fixtures/test';
import { insertViaSlash, newLine, openEditor, slashRow } from '../fixtures/canvas';

// The canvas is a contenteditable, so ProseMirror's own class names stand in
// for roles it does not give, and a node view's `data-type` stands in for
// what a block is. `#slash-command` and `.tippy-box` are the two other
// exceptions this file needs, both explained where they are used.

/** Every block the menu offers, in the order the menu offers it. */
const BLOCKS = [
  'Text', 'Heading 1', 'Heading 2', 'Heading 3', 'Bullet List', 'Numbered List',
  'Image', 'Logo', 'Inline Image', 'Columns', 'Section', 'Repeat', 'Divider',
  'Spacer', 'Button', 'Link Card', 'Blockquote',
];
const COMPONENTS = ['Headers', 'Footers', 'Custom HTML'];

test.describe('editor on the desktop', () => {
  test('the block menu offers every block, in its group', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('slash roster') });
    await openEditor(page, t.id);
    await newLine(page);
    await page.keyboard.type('/');

    const menu = page.locator('#slash-command');
    await expect(menu).toBeVisible();
    await expect(menu.getByText('Blocks', { exact: true })).toBeVisible();
    await expect(menu.getByText('Components', { exact: true })).toBeVisible();
    for (const title of [...BLOCKS, ...COMPONENTS]) {
      await expect(slashRow(page, title), `${title} is offered`).toBeVisible();
    }
    await expect(menu.getByRole('button')).toHaveCount(BLOCKS.length + COMPONENTS.length);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('a block picked from the menu lands in the canvas', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('slash inserts') });
    const pm = await openEditor(page, t.id);

    // One representative per shape a customer can see: a heading, a list, a
    // wrapper, a rule, an atom with its own chrome, and a code block. The
    // catalogue's own contents are pinned by client/core/editor/block-catalogue.test.ts.
    await insertViaSlash(page, 'Heading 2');
    await page.keyboard.type('A heading');
    await expect(pm.locator('h2')).toHaveText('A heading');

    await insertViaSlash(page, 'Bullet List');
    await page.keyboard.type('An item');
    await expect(pm.locator('ul > li')).toHaveText('An item');

    await insertViaSlash(page, 'Divider');
    await expect(pm.locator('hr')).toHaveCount(1);

    await insertViaSlash(page, 'Section');
    await expect(pm.locator('table[data-type="section"]')).toHaveCount(1);

    await insertViaSlash(page, 'Columns');
    await expect(pm.locator('div[data-type="columns"]')).toHaveCount(1);
    await expect(pm.locator('div[data-type="column"]')).toHaveCount(2);

    await insertViaSlash(page, 'Button');
    await expect(pm.locator('[data-type="button"]').getByRole('button', { name: 'Button' })).toBeVisible();

    await insertViaSlash(page, 'Custom HTML');
    await expect(pm.locator('[data-type="htmlCodeBlock"]')).toHaveCount(1);
  });
});
