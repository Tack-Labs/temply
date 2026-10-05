import { afterEach, describe, expect, it, mock } from 'bun:test';
import '../core/editor/test/dom';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { WorkflowTemplate } from '~/lib/template-stage';
import { StagedTestSend } from './staged-test-send';

const content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Snapshot ' }, { type: 'variable', attrs: { id: 'name', fallback: 'Ada' } }] }] });
const row = { title: 'Welcome', content: 'new draft', theme: '{"draft":true}', preview_text: 'Draft preview', staged_at: 'now',
  staged_content: content, staged_theme: '{"container":{"backgroundColor":"#FFFFFF"}}', staged_preview_text: 'Staged preview' } as WorkflowTemplate;
const realFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = realFetch; });

const type = (field: HTMLElement, value: string) => {
  fireEvent.focusIn(field);
  fireEvent.input(field, { target: { value } });
  fireEvent.keyUp(field, { key: 'x' });
};

describe('staged test sends', () => {
  it('sends the candidate content, brand and preview with sample values, independently of the newer draft', async () => {
    const bodies: Record<string, unknown>[] = [];
    globalThis.fetch = mock(async (_url: unknown, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response('{}');
    }) as unknown as typeof fetch;
    const view = render(<QueryClientProvider client={new QueryClient()}><StagedTestSend template={row} /></QueryClientProvider>);
    fireEvent.click(view.getByRole('button', { name: 'Send a test' }));
    type(view.getByRole('textbox', { name: 'Test recipients' }), ' test@example.com ');
    type(view.getByRole('textbox', { name: 'name' }), 'Ada');
    fireEvent.submit(view.container.querySelector('form')!);
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ to: 'test@example.com', subject: 'Welcome', content,
      theme: { container: { backgroundColor: '#FFFFFF' } }, previewText: 'Staged preview', payload: { name: 'Ada' } });
  });

  it('shows a send failure in place and leaves the recipient available for a retry', async () => {
    globalThis.fetch = mock(async () => new Response(JSON.stringify({ message: 'Sending is unavailable', errors: ['Unavailable'] }), { status: 503 })) as unknown as typeof fetch;
    const view = render(<QueryClientProvider client={new QueryClient()}><StagedTestSend template={row} /></QueryClientProvider>);
    fireEvent.click(view.getByRole('button', { name: 'Send a test' }));
    type(view.getByRole('textbox', { name: 'Test recipients' }), 'test@example.com');
    fireEvent.submit(view.container.querySelector('form')!);
    await waitFor(() => expect(view.getByRole('alert').textContent).toBe('Sending is unavailable'));
    expect((view.getByRole('textbox', { name: 'Test recipients' }) as HTMLInputElement).value).toBe('test@example.com');
    expect((view.getByRole('button', { name: 'Send staged test' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
