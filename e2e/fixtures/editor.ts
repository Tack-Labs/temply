import type { Page } from '@playwright/test';
import { test, expect } from './test';

// Below `sm` the editor is the phone shell: the subject lives in the "Email
// details" sheet behind the header's subject button, and the save status
// sits inside the ⋯ menu rather than in a toolbar. The same tests run on
// both projects; only the way to the subject and to "Saved" differs.
export const onPhone = () => test.info().project.name.startsWith('phone');

/** The subject field, opened first when it sits behind the details sheet. */
export async function subjectField(page: Page) {
  if (onPhone() && !(await page.getByRole('dialog', { name: 'Email details' }).isVisible())) {
    await page.getByRole('button', { name: /^Edit details:/ }).click();
  }
  return page.getByRole('textbox', { name: 'Subject' });
}

/**
 * Types a subject and waits until it is on the server. "Saved" alone is not
 * proof: a template fresh from the gallery autosaves once on mount, so the
 * word can already be up before this edit's debounce has fired, and leaving
 * then would abandon it. The save that carries this title is the signal;
 * the word is what the customer reads afterwards.
 */
export async function renameTo(page: Page, id: string, title: string) {
  const subject = await subjectField(page);
  const saved = page.waitForResponse(
    (res) => res.request().method() === 'POST' && res.url().endsWith(`/api/v1/templates/${id}`) && res.request().postDataJSON()?.title === title && res.ok(),
  );
  await subject.fill(title);
  await subject.blur();
  await saved;
  if (onPhone()) {
    await page.getByRole('dialog', { name: 'Email details' }).getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'More', exact: true }).click();
  }
  // "Not saved" would also match a loose pattern; the word alone is the pass.
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
}

/** The phone header's ⋯ menu; a no-op on desktop, where the toolbar is in view. */
export async function openMore(page: Page): Promise<void> {
  if (onPhone()) await page.getByRole('button', { name: 'More', exact: true }).click();
}

/** Publishes the open template; the caller asserts the "Published" toast. */
export async function publish(page: Page): Promise<void> {
  if (onPhone()) {
    await openMore(page);
    await page.getByRole('menuitem', { name: 'Publish', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
  }
}
