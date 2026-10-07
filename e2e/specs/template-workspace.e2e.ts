import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { onPhone } from '../fixtures/editor';

// A 1.5px rule is only drawn as one on a screen dense enough to hold the
// fraction; Chromium floors it to 1px otherwise, and the density a context
// emulates does not count. Launch options belong to the worker, so this is
// stated for the file (see redesign-primitives.e2e.ts, which found it).
test.use({ launchOptions: { args: ['--force-device-scale-factor=2'] } });

/** What the page's own token paints as, read through a probe so retuning the palette cannot break a case. */
const painted = (page: Page, property: 'background-color' | 'border-bottom-color', token: string) =>
  page.evaluate(
    ([prop, name]) => {
      const probe = document.createElement('div');
      document.body.append(probe);
      probe.style.cssText = `${prop}: var(${name})`;
      const value = getComputedStyle(probe).getPropertyValue(prop);
      probe.remove();
      return value;
    },
    [property, token] as const,
  );

const personalEmail = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [
  { type: 'text', text: 'Hello, ' }, { type: 'variable', attrs: { id: 'firstName', fallback: 'Ada' } },
] }] });

test('variables explain the changing details and preview example values', async ({ page, api, name }) => {
  const { id } = await api.createTemplate({ title: name('personal email'), content: personalEmail });
  await page.goto(`/templates/${id}/variables`);
  await expect(page.getByRole('heading', { name: 'The details that change for each person' })).toBeVisible();
  await expect(page.getByText('Preview example: Ada')).toBeVisible();
  await page.getByRole('textbox', { name: 'firstName' }).fill('Maya');
  await page.getByRole('button', { name: 'Preview these details' }).click();
  await expect(page.getByTitle('Email with example details').contentFrame().getByText('Hello, Maya')).toBeVisible();
  await expect(page.getByText('Plain text version')).toBeVisible();
  await page.getByText('Plain text version').click();
  await expect(page.getByText('Hello, Maya', { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Template' }).getByRole('link', { name: 'Variables' })).toHaveAttribute('aria-current', 'page');
});

test('version tags survive reload and a preview can be restored to the draft', async ({ page, api, name }) => {
  const first = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'An earlier email' }] }] });
  const { id } = await api.createTemplate({ title: name('saved version'), content: first });
  await api.publishTemplate(id);
  await api.saveDraft(id, { title: name('updated version'), content: personalEmail });
  await api.publishTemplate(id);
  await page.goto(`/templates/${id}/versions`);
  await page.getByRole('button', { name: /^Version 1/ }).click();
  await expect(page.getByTitle('Saved version preview').contentFrame().getByText('An earlier email')).toBeVisible();
  await page.getByRole('textbox', { name: 'Version tag' }).fill('Approved copy');
  await page.getByRole('button', { name: 'Save tag' }).click();
  await expect(page.getByText('Version tag saved', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /^Version 1 Approved copy/ }).click();
  await page.getByRole('button', { name: 'Restore to draft', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Restore to draft', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/templates/${id}$`));
  await expect(page.locator('.ProseMirror').getByText('An earlier email')).toBeVisible();
  const restored = await api.getTemplate(id);
  expect(restored.content).toBe(first);
  expect(restored.has_unpublished_changes).toBe(true);
});

test('connection steps make a real test request and clear the key afterwards', async ({ page, api, name }) => {
  const { id } = await api.createTemplate({ title: name('connect email') });
  const response = await page.request.post('/api/v1/api-keys', { data: { name: name('connection test key'), mode: 'test' } });
  expect(response.ok()).toBe(true);
  const { key } = await response.json();
  api.trackApiKey(key.id);
  await page.goto(`/templates/${id}/connect`);
  await expect(page.getByRole('heading', { name: 'Put this email to work in your app' })).toBeVisible();
  await expect(page.getByText(/Bearer \$TEMPLY_KEY/)).toBeVisible();
  await page.getByLabel('Your test key').fill(key.full_key);
  await page.getByRole('button', { name: 'Check connection', exact: true }).click();
  await expect(page.getByText('Connection checked — email prepared')).toBeVisible();
  await expect(page.getByLabel('Your test key')).toHaveValue('');
  await page.getByRole('radio', { name: 'Live key', exact: true }).click();
  await expect(page.getByText('Connection checked — email prepared')).toHaveCount(0);
});

test('the editor panels add content and save the latest change before opening variables', async ({ page, api, name }) => {
  test.skip(onPhone(), 'The phone keeps its existing read-only canvas.');
  const { id } = await api.createTemplate({ title: name('editor panels') });
  await page.goto(`/templates/${id}`);
  await expect(page.locator('.ProseMirror').getByText('Hello from e2e')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Email settings' })).toBeVisible();
  // Scoped to the landmark: the slash menu has a "Components" group of its own.
  await page.getByRole('complementary', { name: 'Components' }).getByRole('button', { name: 'Subheading', exact: true }).click();
  await page.keyboard.type('Heading from the panel');
  await expect(page.locator('.ProseMirror').getByRole('heading', { name: 'Heading from the panel' })).toBeVisible();
  const title = name('saved before leaving');
  await page.getByLabel('Subject', { exact: true }).fill(title);
  await page.getByRole('navigation', { name: 'Template' }).getByRole('link', { name: 'Variables' }).click();
  await expect(page).toHaveURL(new RegExp(`/templates/${id}/variables$`));
  const stored = await api.getTemplate(id);
  expect(stored.title).toBe(title);
  expect(stored.content).toContain('Heading from the panel');
});

test('the editor is one full-height frame: header, tab row, view switch and a sunken canvas surround', async ({ page, api, name }) => {
  test.skip(onPhone(), 'The phone has a frame of its own.');
  const title = name('frame');
  const { id } = await api.createTemplate({ title });
  await page.goto(`/templates/${id}`);
  await expect(page.locator('.ProseMirror').getByText('Hello from e2e')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  // The header: the template's name as the page's one heading, on the raised
  // surface, closed by a 1.5px rule. Its height is 14px of padding round the
  // 48px buttons and the rule, so a name that runs long truncates rather than
  // adding a row.
  const header = page.getByRole('banner');
  await expect(header.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(header).toHaveCSS('background-color', await painted(page, 'background-color', '--ds-raised'));
  await expect(header).toHaveCSS('border-bottom-width', '1.5px');
  await expect(header).toHaveCSS('border-bottom-color', await painted(page, 'border-bottom-color', '--ds-line'));
  const bar = (await header.boundingBox())!;
  expect(bar.height, 'one row of 48px buttons between 14px of padding, and the rule').toBeGreaterThanOrEqual(76);
  expect(bar.height).toBeLessThanOrEqual(79);
  await expect(header.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();

  // The tab row: the current tab is marked for a screen reader and drawn with
  // a 3px accent underline along its foot; the others carry neither.
  const tabs = page.getByRole('navigation', { name: 'Template' });
  const current = tabs.getByRole('link', { name: 'Edit email' });
  await expect(current).toHaveAttribute('aria-current', 'page');
  await expect(tabs.locator('[aria-current]')).toHaveCount(1);
  expect((await current.boundingBox())!.height).toBeCloseTo(54, 0);
  const underline = current.locator('span[aria-hidden="true"]');
  await expect(underline, 'the underline has finished fading in').toHaveCSS('opacity', '1');
  await expect(underline).toHaveCSS('background-color', await painted(page, 'background-color', '--ds-accent'));
  const mark = (await underline.boundingBox())!;
  const tab = (await current.boundingBox())!;
  expect(mark.height).toBeCloseTo(3, 0);
  expect(mark.y + mark.height, 'the underline sits on the foot of the tab').toBeCloseTo(tab.y + tab.height, 0);
  await expect(tabs.getByRole('link', { name: 'Variables' }).locator('span[aria-hidden="true"]')).toHaveCount(0);

  // The view switch: four text segments, one pressed.
  const views = page.getByRole('group', { name: 'Content view' });
  await expect(views.getByRole('button')).toHaveText(['Edit', 'Preview', 'HTML', 'Text']);
  await expect(views.getByRole('button', { name: 'Edit', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect((await views.getByRole('button', { name: 'Edit', exact: true }).boundingBox())!.height).toBeCloseTo(40, 0);
  await views.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(views.getByRole('button', { name: 'Preview', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(views.getByRole('button', { name: 'Edit', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await views.getByRole('button', { name: 'Edit', exact: true }).click();

  // The canvas surround follows the app's token, with the email in a card of
  // its own on it; the page itself never scrolls, because the canvas does.
  const surround = page.getByRole('region', { name: 'Email canvas' });
  await expect(surround).toHaveCSS('background-color', await painted(page, 'background-color', '--ds-sunken'));
  await expect(surround.locator('article')).toHaveCSS('border-radius', '28px');
  const overflow = await page.evaluate(() => ({
    scroll: document.scrollingElement!.scrollHeight,
    height: window.innerHeight,
  }));
  expect(overflow.scroll, 'the document is exactly as tall as the window: nothing to scroll').toBeLessThanOrEqual(overflow.height);
});

// Every page of a template but the editor shares one frame (TemplateFrame), so
// the frame's promises are checked on each tab rather than assumed from the
// editor's case above: the way back, the template's name as the one heading,
// this tab alone marked current, and a body that scrolls so the page does not.
const FRAMED_TABS = [
  { label: 'Variables', path: 'variables' },
  { label: 'Versions', path: 'versions' },
  { label: 'Review & release', path: 'review' },
  { label: 'Connect your app', path: 'connect' },
] as const;

for (const tab of FRAMED_TABS) {
  test(`the ${tab.label} tab sits in the template's frame: header, tab row and one main landmark`, async ({ page, api, name }) => {
    const title = name(`${tab.path} frame`);
    const { id } = await api.createTemplate({ title });
    await page.goto(`/templates/${id}/${tab.path}`);
    await page.evaluate(() => document.fonts.ready);

    const header = page.getByRole('banner');
    await expect(header.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(header.getByRole('link', { name: 'Back to templates' })).toHaveAttribute('href', '/dashboard/templates');

    const tabs = page.getByRole('navigation', { name: 'Template' });
    await expect(tabs.getByRole('link', { name: tab.label, exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(tabs.locator('[aria-current]')).toHaveCount(1);

    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveAttribute('id', 'main-content');
    const scroll = await page.evaluate(() => ({ document: document.scrollingElement!.scrollHeight, window: window.innerHeight }));
    expect(scroll.document, 'the body of the frame scrolls, not the page').toBeLessThanOrEqual(scroll.window);
  });
}

test('deleting from the editor sits behind the more menu, asks first and gives focus back on cancel', async ({ page, api, name }) => {
  test.skip(onPhone(), 'The phone keeps Delete in its own ⋯ menu.');
  const { id } = await api.createTemplate({ title: name('editor delete') });
  await page.goto(`/templates/${id}`);
  await expect(page.locator('.ProseMirror').getByText('Hello from e2e')).toBeVisible();

  // One confirmation away rather than one slip: no Delete button in the bar.
  await expect(page.getByRole('banner').getByRole('button', { name: 'Delete' })).toHaveCount(0);
  const more = page.getByRole('button', { name: 'More actions', exact: true });
  await more.click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Are you absolutely sure?' });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(more, 'the dialog has no trigger of its own, so the menu button takes focus back').toBeFocused();
  expect((await api.getTemplate(id)).id).toBe(id);

  await more.click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog', { name: 'Are you absolutely sure?' }).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/templates$/);
  // Already gone; the fixture's cleanup tolerates 404.
});
