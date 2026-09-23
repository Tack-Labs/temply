import type { Page } from '@playwright/test';
import { expect } from './test';
import { onPhone } from './project';

// Below `sm` the editor is the phone shell: the subject lives in the "Email
// details" sheet behind the header's subject button, and the save status
// sits inside the ⋯ menu rather than in a toolbar. The same tests run on
// both projects; only the way to the subject and to the status differs.
export { onPhone };

/**
 * The subject field, opened first when it sits behind the details sheet.
 * The canvas is waited for before anything is typed: the editor is server-
 * rendered and focusable before React attaches, and a subject typed in that
 * window shows in the field, never reaches state, and is never saved.
 */
export async function subjectField(page: Page) {
  await page.locator('.ProseMirror').waitFor();
  if (onPhone() && !(await page.getByRole('dialog', { name: 'Email details' }).isVisible())) {
    await page.getByRole('button', { name: /^Edit details:/ }).click();
  }
  return page.getByRole('textbox', { name: 'Subject' });
}

/**
 * Types a subject and waits until it is on the server. "Saved" alone is not
 * proof: the word is on screen whenever the last save settled, whichever
 * save that was, so it can already be up before this edit's debounce has
 * fired, and leaving then would abandon it. The save that carries this
 * title is the signal. The status is still read afterwards, on the phone
 * from inside the ⋯ menu, which is left open for the caller: a save that
 * failed says "Not saved", and that is the one word that must not be there.
 */
export async function renameTo(page: Page, id: string, title: string) {
  const subject = await subjectField(page);
  const saved = page.waitForResponse(
    (res) => res.request().method() === 'POST' && res.url().endsWith(`/api/v1/templates/${id}`) && res.request().postDataJSON()?.title === title && res.ok(),
    { timeout: 30_000 },
  );
  await subject.fill(title);
  await subject.blur();
  await saved;
  if (onPhone()) {
    await page.getByRole('dialog', { name: 'Email details' }).getByRole('button', { name: 'Close' }).click();
    await openMore(page);
  }
  // Read where the status is shown: the phone shell also keeps a collapsed
  // "Not saved" banner in the DOM for a failure, which a page-wide count
  // would find whether or not the save landed.
  const status = onPhone() ? page.getByRole('menu') : page;
  await expect(status.getByText('Not saved')).toHaveCount(0);
}

/** The phone header's ⋯ menu; a no-op on desktop, where the toolbar is in view. */
export async function openMore(page: Page): Promise<void> {
  if (onPhone()) await page.getByRole('button', { name: 'More', exact: true }).click();
}

/**
 * Publishes the open template; the caller asserts the "Published" toast.
 * On the phone this opens the ⋯ menu itself, so a caller that left it open
 * — `renameTo` does — closes it first, or the tap here closes it instead.
 */
export async function publish(page: Page): Promise<void> {
  if (onPhone()) {
    await openMore(page);
    await page.getByRole('menuitem', { name: 'Publish', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
  }
}
