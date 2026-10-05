import { test, expect } from '../fixtures/test';
import { onPhone } from '../fixtures/editor';

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
  await page.getByRole('complementary', { name: 'Add content' }).getByRole('button', { name: 'Subheading', exact: true }).click();
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
