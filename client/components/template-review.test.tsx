import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../core/editor/test/dom';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { WorkflowTemplate } from '~/lib/template-stage';

const realNavigation = { ...(await import('next/navigation')) };
mock.module('next/navigation', () => ({ ...realNavigation, useRouter: () => ({ refresh: () => {} }) }));
// Only the portal is replaced. The test still drives the confirmation before
// checking which snapshot the network request signs off.
const realConfirmation = { ...(await import('~/components/ui/confirm-dialog')) };
mock.module('~/components/ui/confirm-dialog', () => ({
  ...realConfirmation,
  ConfirmDialog: ({ open, onConfirm, title }: { open?: boolean; onConfirm: () => void; title: string }) => open ?
    <button type="button" onClick={onConfirm}>{`Confirm: ${title}`}</button> : null,
}));
afterAll(() => {
  mock.module('next/navigation', () => realNavigation);
  mock.module('~/components/ui/confirm-dialog', () => realConfirmation);
});

const { TemplateReview } = await import('./template-review');
const doc = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Candidate' }] }] });
const template = { id: 'review', title: 'Welcome', org_id: 'org', updated_at: 'draft', published_at: 'live',
  content: doc, theme: null, preview_text: null, published_content: doc, published_theme: null, published_preview_text: null,
  staged_at: 'candidate', staged_content: doc, staged_theme: null, staged_preview_text: null,
  review_requested_at: 'asked', review_requested_by: 'author', returned_at: null, return_note: null, live_version: 2 } as WorkflowTemplate;

const realFetch = globalThis.fetch;
let requests: { path: string; body: Record<string, unknown> }[];
let stamp = 'candidate';
beforeEach(() => {
  requests = [];
  stamp = 'candidate';
  globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    if (init?.method === 'POST') {
      requests.push({ path, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ template: { ...template, staged_at: null, review_requested_at: null, updated_at: 'approved', published_at: 'approved' } }));
    }
    if (path.includes('/versions')) return new Response(JSON.stringify({ versions: [{ version_number: 2 }, { version_number: 1 }] }));
    return new Response(JSON.stringify({ html: '<p>Candidate</p>', updatedAt: path.includes('copy=live') ? 'live' : stamp }));
  }) as unknown as typeof fetch;
});
afterEach(() => { cleanup(); globalThis.fetch = realFetch; });

function setup(row = template, isAdmin = true) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <TemplateReview template={row} isAdmin={isAdmin} userId="admin" readOnly={false} />
  </QueryClientProvider>);
}

describe('sign-off decisions', () => {
  it('requires warning acknowledgement and confirmation, then approves the snapshot viewed', async () => {
    const view = setup();
    const approve = view.getByRole('button', { name: 'Approve and go live' }) as HTMLButtonElement;
    await waitFor(() => expect(view.getByText('0 errors, 1 warning')).toBeTruthy());
    expect(approve.disabled).toBe(true);
    fireEvent.click(view.getByRole('checkbox', { name: 'Mark as reviewed' }));
    expect(approve.disabled).toBe(false);
    fireEvent.click(approve);
    expect(requests).toHaveLength(0);
    fireEvent.click(view.getByRole('button', { name: 'Confirm: Approve and go live?' }));
    await waitFor(() => expect(requests).toEqual([{ path: '/api/v1/templates/review/approve', body: { stagedAt: 'candidate' } }]));
  });

  it('keeps approval disabled when the preview no longer matches the snapshot', async () => {
    stamp = 'replaced';
    const view = setup();
    await waitFor(() => expect(view.getByText('Approval is paused until it loads.', { exact: false })).toBeTruthy());
    expect((view.getByRole('button', { name: 'Approve and go live' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps approval disabled for an unreadable candidate', async () => {
    const view = setup({ ...template, staged_content: '{}' });
    await waitFor(() => expect(view.getByText('The staged content could not be read. Send it back and stage a valid copy.')).toBeTruthy());
    fireEvent.click(view.getByRole('checkbox', { name: 'Mark as reviewed' }));
    expect((view.getByRole('button', { name: 'Approve and go live' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers a member the same preview but no admin decisions', async () => {
    const view = setup(template, false);
    await waitFor(() => expect(view.getByTitle('Staged email preview')).toBeTruthy());
    expect(view.getByRole('heading', { name: 'Waiting for an admin' })).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Approve and go live' })).toBeNull();
    expect(view.queryByRole('button', { name: 'Send back' })).toBeNull();
    expect(view.queryByRole('button', { name: /Roll back/ })).toBeNull();
  });

  it('confirms sending back and preserves the note and candidate stamp in the request', async () => {
    const view = setup();
    const opener = view.getByRole('button', { name: 'Send back' });
    fireEvent.click(opener);
    expect(opener.textContent).toBe('Cancel');
    const field = view.getByRole('textbox', { name: 'Note for the author (optional)' });
    fireEvent.focusIn(field);
    fireEvent.input(field, { target: { value: 'Check the footer.' } });
    fireEvent.keyUp(field, { key: '.' });
    fireEvent.click(view.getByRole('button', { name: 'Send back', exact: true }));
    expect(requests).toHaveLength(0);
    fireEvent.click(view.getByRole('button', { name: 'Confirm: Send this copy back?' }));
    await waitFor(() => expect(requests).toEqual([{ path: '/api/v1/templates/review/send-back', body: { stagedAt: 'candidate', note: 'Check the footer.' } }]));
  });

  it('says nobody has asked yet when a copy is staged without a request, and offers no decision', async () => {
    const view = setup({ ...template, review_requested_at: null, review_requested_by: null });
    await waitFor(() => expect(view.getByTitle('Staged email preview')).toBeTruthy());
    expect(view.getByRole('heading', { name: 'Not waiting for sign-off' })).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Approve and go live' })).toBeNull();
    expect(view.queryByRole('button', { name: 'Send back' })).toBeNull();
  });

  it('tells an admin a rollback goes live as the next version, not as the old number', async () => {
    const view = setup();
    await waitFor(() => expect(view.getByRole('button', { name: 'Roll back to v1' })).toBeTruthy());
    expect(view.getByText('Put v1 back live as v3', { exact: false })).toBeTruthy();
  });
});
