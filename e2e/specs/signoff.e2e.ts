import { TEST_USER_2 } from '../env';
import { EMPTY_DOC } from '../fixtures/api';
import { subjectField, onPhone, openWorkflow, closeWorkflow, publish } from '../fixtures/editor';
import { signInAs } from '../fixtures/session';
import { readWorkspaces } from '../fixtures/workspaces';
import { test, expect } from '../fixtures/test';

const doc = (text: string) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

test.describe('staging and sign-off', () => {
  test('long template names and return notes stay within the viewport', async ({ page, api, name }) => {
    const title = name('title').padEnd(200, 'T');
    const note = 'N'.repeat(500);
    const { id } = await api.createTemplate({ title });
    await api.saveDraft(id, { title, content: doc('A candidate to review') });
    expect((await page.request.post(`/api/v1/templates/${id}/stage`)).ok()).toBe(true);
    expect((await page.request.post(`/api/v1/templates/${id}/request-signoff`)).ok()).toBe(true);
    expect((await page.request.post(`/api/v1/templates/${id}/send-back`, { data: { note } })).ok()).toBe(true);
    await page.goto(`/templates/${id}/review`);
    await expect(page.getByText(note, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('a member stages and asks; an admin reviews the frozen copy and puts it live', async ({ page, browser, api, name }) => {
    const title = name('sign-off');
    const { id } = await api.createTemplate({ title });
    await api.saveDraft(id, { title, content: doc('Candidate for sign-off') });
    const member = await signInAs(browser, TEST_USER_2, readWorkspaces().shared);
    try {
      await member.page.goto(`/templates/${id}`);
      await expect(member.page.locator('.ProseMirror')).toBeVisible();
      if (onPhone()) {
        await member.page.getByRole('button', { name: 'More', exact: true }).click();
        await expect(member.page.getByRole('menuitem', { name: 'Publish', exact: true })).toHaveCount(0);
        await member.page.keyboard.press('Escape');
      } else await expect(member.page.getByRole('button', { name: 'Publish', exact: true })).toHaveCount(0);

      const flow = await openWorkflow(member.page);
      await flow.getByRole('button', { name: 'Move to staging', exact: true }).click();
      await expect(member.page.getByText('Moved to staging', { exact: true })).toBeVisible();
      await flow.getByRole('radio', { name: 'Staged copy', exact: true }).click();
      await expect(flow.getByTitle('Staged email preview').contentFrame().getByText('Candidate for sign-off')).toBeVisible();
      await flow.getByRole('button', { name: 'Ask for sign-off', exact: true }).click();
      await expect(member.page.getByText('Sign-off requested', { exact: true })).toBeVisible();
      await flow.getByRole('link', { name: 'View sign-off', exact: true }).click();
      await expect(member.page.getByRole('heading', { name: 'Waiting for an admin' })).toBeVisible();
      await expect(member.page.getByRole('button', { name: 'Approve and go live' })).toHaveCount(0);

      // Another draft edit must not replace the copy the admin is checking.
      await api.saveDraft(id, { title, content: doc('A newer draft stays private') });
      await page.goto('/dashboard/templates');
      await page.getByRole('searchbox', { name: 'Search templates' }).fill(title);
      const row = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: title }) });
      await expect(row.getByText('Sign-off', { exact: true })).toBeVisible();
      await row.getByRole('link', { name: /^Review / }).click();
      await expect(page.getByTitle('Staged email preview').contentFrame().getByText('Candidate for sign-off')).toBeVisible();
      await page.getByRole('button', { name: 'Send a test', exact: true }).click();
      await page.getByRole('textbox', { name: 'Test recipients' }).fill('test@example.com');
      const send = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/v1/emails/send'));
      await page.getByRole('button', { name: 'Send staged test', exact: true }).click();
      expect((await send).postDataJSON().content).toContain('Candidate for sign-off');
      await expect(page.getByText('Test email sent', { exact: true })).toBeVisible();
      const approve = page.getByRole('button', { name: 'Approve and go live' });
      await expect(approve).toBeDisabled();
      await page.getByRole('checkbox', { name: 'Mark as reviewed' }).check();
      await expect(approve).toBeEnabled();
      await approve.click();
      await page.getByRole('dialog', { name: 'Approve and go live?' }).getByRole('button', { name: 'Approve', exact: true }).click();
      await expect(page.getByText('Approved and live', { exact: true }).first()).toBeVisible();
      const res = await page.request.get(`/api/v1/templates/${id}`);
      const { template } = await res.json();
      expect(template.published_content).toContain('Candidate for sign-off');
      expect(template.content).toContain('A newer draft stays private');
      expect(template.staged_at).toBeNull();
      expect(template.has_unpublished_changes).toBe(true);
    } finally {
      await member.context.close();
    }
  });

  test('sending back preserves the live copy and lets the author stage a correction', async ({ page, api, name }) => {
    const title = name('send back');
    const { id } = await api.createTemplate({ title });
    await api.saveDraft(id, { title, content: doc('Needs a correction') });
    expect((await page.request.post(`/api/v1/templates/${id}/stage`)).ok()).toBe(true);
    expect((await page.request.post(`/api/v1/templates/${id}/request-signoff`)).ok()).toBe(true);
    await page.goto(`/templates/${id}/review`);
    await page.getByRole('button', { name: 'Send back', exact: true }).click();
    // The opener becomes "Cancel" as the note opens, so it is found by that
    // name; "Send back" now names the button inside the note.
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('textbox', { name: 'Note for the author (optional)' }).fill('Check the footer link.');
    await page.getByRole('button', { name: 'Send back', exact: true }).click();
    await page.getByRole('dialog', { name: 'Send this copy back?' }).getByRole('button', { name: 'Send back', exact: true }).click();
    await expect(page.getByText('Check the footer link.', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Go to draft', exact: true }).click();
    const flow = await openWorkflow(page);
    await expect(flow.getByText('Sent back for changes', { exact: true })).toBeVisible();
    await flow.getByRole('button', { name: 'Update staged copy', exact: true }).click();
    await expect(page.getByText('Moved to staging', { exact: true })).toBeVisible();
    await expect(flow.getByText('Check the footer link.', { exact: true })).toHaveCount(0);
    const res = await page.request.get(`/api/v1/templates/${id}`);
    expect((await res.json()).template.published_content).toBe(EMPTY_DOC);
  });

  test('staging captures an edit before the autosave debounce settles', async ({ page, api, name }) => {
    const title = name('capture');
    const { id } = await api.createTemplate({ title });
    await page.goto(`/templates/${id}`);
    const subject = await subjectField(page);
    await subject.fill(name('captured subject'));
    if (onPhone()) await page.getByRole('dialog', { name: 'Email details' }).getByRole('button', { name: 'Close' }).click();
    const flow = await openWorkflow(page);
    await flow.getByRole('button', { name: 'Move to staging', exact: true }).click();
    await expect(page.getByText('Moved to staging', { exact: true })).toBeVisible();
    expect((await api.getTemplate(id)).title).toBe(name('captured subject'));
  });

  test('rollback restores the previous live copy and keeps the draft', async ({ page, api, name }) => {
    const title = name('rollback');
    const { id } = await api.createTemplate({ title });
    await api.publishTemplate(id);
    await api.saveDraft(id, { title, content: doc('Live version two') });
    await api.publishTemplate(id);
    await api.saveDraft(id, { title, content: doc('Draft version three') });
    await page.goto(`/templates/${id}`);
    const flow = await openWorkflow(page);
    await flow.getByRole('link', { name: 'Review and rollback' }).click();
    await page.getByRole('button', { name: 'Roll back to v1' }).click();
    await page.getByRole('dialog', { name: 'Roll back to v1?' }).getByRole('button', { name: 'Roll back', exact: true }).click();
    await expect(page.getByText('Rolled back', { exact: true })).toBeVisible();
    const res = await page.request.get(`/api/v1/templates/${id}`);
    const { template } = await res.json();
    expect(template.published_content).toBe(EMPTY_DOC);
    expect(template.content).toContain('Draft version three');
    expect(template.live_version).toBe(3);
  });

  test('taking a staged copy back ends its request and leaves the draft and the live copy', async ({ page, api, name }) => {
    const title = name('unstage');
    const { id } = await api.createTemplate({ title });
    await api.saveDraft(id, { title, content: doc('A copy staged by mistake') });
    expect((await page.request.post(`/api/v1/templates/${id}/stage`)).ok()).toBe(true);
    expect((await page.request.post(`/api/v1/templates/${id}/request-signoff`)).ok()).toBe(true);
    await page.goto(`/templates/${id}`);
    await expect(page.locator('.ProseMirror')).toBeVisible();
    const flow = await openWorkflow(page);
    await flow.getByRole('button', { name: 'Remove staged copy', exact: true }).click();
    const ask = page.getByRole('dialog', { name: 'Remove the staged copy?' });
    await expect(ask.getByText('This also ends the request for sign-off.', { exact: false })).toBeVisible();
    await ask.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByText('Staged copy removed', { exact: true })).toBeVisible();
    await expect(flow.getByRole('radio', { name: 'Staged copy', exact: true })).toBeDisabled();
    await closeWorkflow(page);
    const { template } = await (await page.request.get(`/api/v1/templates/${id}`)).json();
    expect(template.staged_at).toBeNull();
    expect(template.review_requested_at).toBeNull();
    expect(template.content).toContain('A copy staged by mistake');
    expect(template.published_content).toBe(EMPTY_DOC);
  });

  test('publishing the draft over a waiting copy asks first, then ends the request', async ({ page, api, name }) => {
    const title = name('publish over');
    const { id } = await api.createTemplate({ title });
    await api.saveDraft(id, { title, content: doc('Staged for review') });
    expect((await page.request.post(`/api/v1/templates/${id}/stage`)).ok()).toBe(true);
    expect((await page.request.post(`/api/v1/templates/${id}/request-signoff`)).ok()).toBe(true);
    await api.saveDraft(id, { title, content: doc('Published instead') });
    await page.goto(`/templates/${id}`);
    await expect(page.locator('.ProseMirror')).toBeVisible();

    await publish(page);
    const ask = page.getByRole('dialog', { name: 'Publish the draft?' });
    await expect(ask.getByText('A copy is waiting for sign-off.', { exact: false })).toBeVisible();
    await ask.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(ask).toHaveCount(0);
    // The phone's menu stays open under its dialogs; `publish` taps ⋯ itself,
    // which would close it instead of opening it.
    if (onPhone() && await page.getByRole('menu').isVisible()) await page.keyboard.press('Escape');
    const before = (await (await page.request.get(`/api/v1/templates/${id}`)).json()).template;
    expect(before.staged_at).not.toBeNull();
    expect(before.review_requested_at).not.toBeNull();

    await publish(page);
    await page.getByRole('dialog', { name: 'Publish the draft?' }).getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByText('Published', { exact: true })).toBeVisible();
    const { template } = await (await page.request.get(`/api/v1/templates/${id}`)).json();
    expect(template.published_content).toContain('Published instead');
    expect(template.staged_at).toBeNull();
    expect(template.review_requested_at).toBeNull();
  });
});
