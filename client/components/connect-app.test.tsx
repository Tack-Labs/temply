import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../core/editor/test/dom';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TemplatePageRow } from '~/lib/template-page';

import { ConnectApp } from './connect-app';

const document = (id: string) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'variable', attrs: { id, fallback: 'Example' } }] }] });
const template = {
  id: 'template', title: 'Welcome email', short_code: 'tpl_welcome', content: document('draftName'),
  published_content: document('liveName'), published_at: '2026-10-01T12:00:00Z',
} as TemplatePageRow;
const originalFetch = globalThis.fetch;
let sent: { path: string; body: Record<string, unknown>; authorization: string | null }[];
let failRender = false;
beforeEach(() => {
  sent = []; failRender = false;
  globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith('/versions')) return new Response(JSON.stringify({ versions: [{ id: 'saved', version_number: 1, title: 'Welcome', tag: 'Approved copy' }] }));
    if (path.endsWith('/versions/saved')) return new Response(JSON.stringify({ version: { content: document('savedName') } }));
    sent.push({ path, body: JSON.parse(String(init?.body)), authorization: new Headers(init?.headers).get('Authorization') });
    return new Response(JSON.stringify(failRender ? { errors: ['missing'], message: 'Missing values for: firstName' } : { html: '<p>Welcome</p>', text: 'Welcome', mode: 'test', version: null }), { status: failRender ? 422 : 200 });
  }) as unknown as typeof fetch;
});
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });
const open = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><ConnectApp template={template} /></QueryClientProvider>);

// happy-dom's input support is detected before React loads; the focus and
// key release exercise React's change fallback, as the other form tests do.
function type(field: HTMLElement, value: string) {
  fireEvent.focusIn(field);
  fireEvent.input(field, { target: { value } });
  fireEvent.keyUp(field, { key: 'x' });
}

describe('app connection steps', () => {
  it('uses the variables from the draft, live copy or pinned version that the app will actually receive', async () => {
    const view = open();
    expect(view.container.querySelector('pre')?.textContent).toContain('draftName');
    fireEvent.click(view.getByRole('radio', { name: 'Live key', exact: true }));
    expect(view.container.querySelector('pre')?.textContent).toContain('liveName');
    expect(view.container.querySelector('pre')?.textContent).not.toContain('draftName');
    await waitFor(() => expect(view.getByRole('option', { name: 'Version 1 — Approved copy' })).toBeTruthy());
    fireEvent.change(view.getByRole('combobox'), { target: { value: '1' } });
    await waitFor(() => expect(view.container.querySelector('pre')?.textContent).toContain('savedName'));
    expect(view.container.querySelector('pre')?.textContent).toContain('"version": 1');
  });

  it('checks through the actual public render endpoint, keeps the secret out of snippets and clears it after success', async () => {
    const view = open();
    const key = view.getByLabelText('Your test key');
    type(key, 'tply_test_example_secret');
    expect(view.container.querySelector('pre')?.textContent).not.toContain('example_secret');
    fireEvent.submit(view.getByLabelText('Your test key').closest('form')!);
    await waitFor(() => expect(view.getByText('Connection checked — email prepared')).toBeTruthy());
    expect(sent).toEqual([{ path: '/api/public/v1/templates/tpl_welcome/render', body: { data: { draftName: 'Example' } }, authorization: 'Bearer tply_test_example_secret' }]);
    expect((key as HTMLInputElement).value).toBe('');
    fireEvent.click(view.getByRole('radio', { name: 'Live key', exact: true }));
    expect(view.queryByText('Connection checked — email prepared')).toBeNull();
  });

  it('shows the real API error and clears the secret after a failed check', async () => {
    failRender = true;
    const view = open();
    type(view.getByLabelText('Your test key'), 'tply_test_example_secret');
    fireEvent.submit(view.getByLabelText('Your test key').closest('form')!);
    await waitFor(() => expect(view.getByRole('alert').textContent).toContain('Missing values for: firstName'));
    expect((view.getByLabelText('Your test key') as HTMLInputElement).value).toBe('');
    expect(view.queryByText('Connection checked — email prepared')).toBeNull();
  });
});
