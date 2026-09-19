import type { Page } from '@playwright/test';
import { onPhone, openMore } from '../fixtures/editor';
import { test, expect } from '../fixtures/test';

// A paragraph with a variable, a paragraph shown only when `isMember`, and
// a Repeat over `items` with a variable inside — one of each thing the
// sample-data panel drives. Shapes as `shared/preflight.test.ts` and
// `server/src/render/show-if.test.ts` pin them.
const DOC = JSON.stringify({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Hello ' }, { type: 'variable', attrs: { id: 'name', fallback: 'there', required: true } }] },
    { type: 'paragraph', attrs: { showIfKey: 'isMember' }, content: [{ type: 'text', text: 'Members only' }] },
    { type: 'repeat', attrs: { each: 'items', showIfKey: null }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item: ' }, { type: 'variable', attrs: { id: 'label', fallback: 'Widget' } }] }] },
  ],
});

/** The rendered email, found by the iframe's title the way a reader would. */
const frame = (page: Page) => page.getByTitle('Email preview').contentFrame();

/**
 * Opens the template and waits until the editor is live. The server-rendered
 * page already draws the view switch, but a click on it before React has
 * mounted is lost; the body is drawn only once the editor has, so its text
 * is the sign to wait for.
 */
async function open(page: Page, id: string) {
  await page.goto(`/templates/${id}`);
  await expect(page.getByText('Members only')).toBeVisible();
}

/**
 * Switches the open template to a rendered view. Whether the phone's
 * Preview sheet is already up is probed once, not waited for, so this is
 * called only with the sheet settled — open or closed, never mid-slide —
 * or the probe reads the state it is leaving.
 */
async function view(page: Page, mode: 'Preview' | 'HTML' | 'Text') {
  if (onPhone()) {
    const sheet = page.getByRole('dialog', { name: 'Preview' });
    if (!(await sheet.isVisible())) {
      await openMore(page);
      await page.getByRole('menuitem', { name: 'Preview' }).click();
    }
    await sheet.getByRole('tab', { name: mode }).click();
  } else {
    await page.getByRole('group', { name: 'Content view' }).getByRole('button', { name: mode, exact: true }).click();
  }
}

/**
 * The sample-data controls: a popover beside the desktop preview, a sheet on
 * the phone. As with `view`, whether the sheet or the popover is up is
 * probed once, so the caller has it settled first.
 */
async function sampleData(page: Page) {
  if (onPhone()) {
    // The Preview sheet covers the bar that holds the Data tab.
    const open = page.getByRole('dialog', { name: 'Preview' });
    if (await open.isVisible()) await open.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Data', exact: true }).click();
    return page.getByRole('dialog', { name: 'Sample data' });
  }
  // The popover carries no name of its own; its heading is what tells it apart.
  const panel = page.getByRole('dialog').filter({ hasText: 'Preview data' });
  if (!(await panel.isVisible())) await page.getByRole('button', { name: 'Preview data' }).click();
  return panel;
}

/** The HTML or text pane. The desktop page shows a second `code` — the
 *  Template ID — so the pane is the one carrying the email's words. The
 *  marker is the conditional paragraph: in the HTML source the greeting is
 *  split by the `<!-- -->` React leaves between adjacent text nodes. */
const source = (page: Page) =>
  (onPhone() ? page.getByRole('dialog', { name: 'Preview' }) : page).getByRole('code').filter({ hasText: 'Members only' });

test.describe('preview', () => {
  test('sample data is reflected in the preview', async ({ page, api, name }) => {
    const { id } = await api.createTemplate({ title: name('sample data'), content: DOC });
    await open(page, id);
    await view(page, 'Preview');
    await expect(frame(page).getByText('Hello there')).toBeVisible();
    await expect(frame(page).getByText('Members only')).toBeVisible();
    await expect(frame(page).getByText('Item: Widget')).toHaveCount(2);

    const data = await sampleData(page);
    await data.getByRole('textbox', { name: 'name' }).fill('Ada');
    // A click and a waiting assertion, not `uncheck()`: the desktop popover
    // sits in the view switch's held controls, which catch up with the state
    // a commit late, so the box reads checked for a frame after the click.
    const isMember = data.getByRole('checkbox', { name: 'isMember' });
    await isMember.click();
    await expect(isMember).not.toBeChecked();
    await data.getByRole('button', { name: 'More items' }).click();
    await expect(data.getByText('3 items')).toBeVisible();
    if (onPhone()) {
      // The phone renders again on the way back into the Preview sheet, not
      // while the Data sheet is up.
      await data.getByRole('button', { name: 'Close' }).click();
      await view(page, 'Preview');
    }
    await expect(frame(page).getByText('Hello Ada')).toBeVisible();
    await expect(frame(page).getByText('Members only')).toHaveCount(0);
    await expect(frame(page).getByText('Item: Widget')).toHaveCount(3);
  });

  test('forced dark is a toggle on the preview', async ({ page, api, name }) => {
    const { id } = await api.createTemplate({ title: name('forced dark'), content: DOC });
    await open(page, id);
    await view(page, 'Preview');
    const toggle = onPhone()
      ? page.getByRole('dialog', { name: 'Preview' }).getByRole('button', { name: 'Forced dark' })
      : page.getByRole('button', { name: 'Preview as a client that forces dark mode' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(frame(page).getByText('Hello there')).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('a script in a Custom HTML block runs nowhere', async ({ page, api, name }) => {
    // The block is whatever the author typed and the render passes it
    // through as written, so the preview is the one place a customer's
    // markup runs. It used to run on the app's origin — one member's
    // template as whoever previewed it next, with their session. The frame
    // is sandboxed now: the block still shows, and nothing in it can reach
    // the frame's own document, let alone the page around it.
    const doc = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Before the block' }] },
        {
          type: 'htmlCodeBlock',
          content: [{
            type: 'text',
            text: '<p>From the block</p><script>document.body.dataset.ran="1";try{parent.document.body.dataset.pwned="1"}catch(e){}</script><img src="x" onerror="document.body.dataset.ran=(document.body.dataset.ran||\'\')+\'img\';try{parent.document.body.dataset.pwned=\'img\'}catch(e){}">',
          }],
        },
      ],
    });
    const { id } = await api.createTemplate({ title: name('inert html'), content: doc });
    await page.goto(`/templates/${id}`);
    await expect(page.getByText('Before the block')).toBeVisible();
    await view(page, 'Preview');

    await expect(frame(page).getByText('From the block'), 'the block itself is shown').toBeVisible();
    // Judged once the frame has finished loading: an inline script runs as
    // it is parsed and an image's onerror before the load event, so a frame
    // that is complete has fired everything it was ever going to.
    await expect.poll(() => frame(page).locator('body').evaluate(() => document.readyState)).toBe('complete');
    await expect(frame(page).locator('body'), 'nothing in the block ran in the frame').not.toHaveAttribute('data-ran', /./);
    await expect(page.locator('body'), 'and nothing reached the page around it').not.toHaveAttribute('data-pwned', /./);
  });

  test('HTML and Text views show the source, and HTML copies', async ({ page, api, name, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const { id } = await api.createTemplate({ title: name('sources'), content: DOC });
    await open(page, id);
    await view(page, 'HTML');
    await expect(source(page)).toBeVisible();
    await expect(source(page)).toContainText('<');
    await page.getByRole('button', { name: 'Copy HTML' }).click();
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Members only');
    await view(page, 'Text');
    await expect(source(page)).toBeVisible();
    await expect(source(page)).not.toContainText('<');
  });
});
