import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../core/editor/test/dom';
import { cloneElement, isValidElement } from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { WorkflowTemplate } from '~/lib/template-stage';
import type { TemplateEditorModel } from './editor/use-template-editor';

const realNavigation = { ...(await import('next/navigation')) };
mock.module('next/navigation', () => ({ ...realNavigation, useRouter: () => ({ refresh: () => {} }) }));
// Only the portal is replaced: the mock opens from the trigger like the real
// dialog, so a test still has to click through the question before anything
// is sent.
const realConfirmation = { ...(await import('~/components/ui/confirm-dialog')) };
type DialogProps = {
  open?: boolean; onOpenChange?: (open: boolean) => void; onConfirm: () => void;
  title: string; description?: string; children?: React.ReactNode;
};
mock.module('~/components/ui/confirm-dialog', () => ({
  ...realConfirmation,
  ConfirmDialog: ({ open, onOpenChange, onConfirm, title, description, children }: DialogProps) => (
    <>
      {isValidElement<{ onClick?: () => void }>(children) ? cloneElement(children, { onClick: () => onOpenChange?.(true) }) : null}
      {open ? <div role="dialog" aria-label={title}>
        <p>{description}</p>
        <button type="button" onClick={() => { onConfirm(); onOpenChange?.(false); }}>{`Confirm: ${title}`}</button>
      </div> : null}
    </>
  ),
}));
afterAll(() => {
  mock.module('next/navigation', () => realNavigation);
  mock.module('~/components/ui/confirm-dialog', () => realConfirmation);
});

const { TemplateWorkflowAction, TemplateUnstageAction } = await import('./template-workflow-action');
const { ConfirmPublish } = await import('./confirm-publish');
const { TemplateWorkflowControls, editorStage, visibleCopy } = await import('./template-workflow-panel');

const doc = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] });
const row = (over: Partial<WorkflowTemplate> = {}) => ({
  id: 't1', title: 'Welcome', org_id: 'org', updated_at: 'u', content: doc, theme: null, preview_text: null,
  published_at: 'p', published_content: doc, published_theme: null, published_preview_text: null,
  staged_at: null, staged_content: null, staged_theme: null, staged_preview_text: null,
  review_requested_at: null, review_requested_by: null, returned_at: null, return_note: null, live_version: 2, ...over,
}) as WorkflowTemplate;
const model = (template: WorkflowTemplate | null, over: Record<string, unknown> = {}) => ({
  template, isAdmin: true, readOnly: false, unpublished: false, publishedAt: template?.published_at ?? null,
  subject: 'Welcome', beforeStage: undefined, onWorkflowChanged: () => {}, handlePublish: async () => {}, ...over,
}) as unknown as TemplateEditorModel;

const realFetch = globalThis.fetch;
let requests: string[];
beforeEach(() => {
  requests = [];
  globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
    requests.push(`${init?.method ?? 'GET'} ${String(input)}`);
    return new Response(JSON.stringify({ template: row({ staged_at: null }) }));
  }) as unknown as typeof fetch;
});
afterEach(() => { cleanup(); globalThis.fetch = realFetch; });

const withQuery = (node: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{node}</QueryClientProvider>
);

describe('editorStage and visibleCopy', () => {
  it('reads the stage from what the editor already knows, not from a stamp autosave is moving', () => {
    expect(editorStage(model(row()))).toBe('live');
    expect(editorStage(model(row(), { unpublished: true }))).toBe('draft');
    expect(editorStage(model(row({ published_at: null }), { publishedAt: null }))).toBe('draft');
    expect(editorStage(model(row({ staged_at: 's' }), { unpublished: true }))).toBe('staging');
    expect(editorStage(model(row({ staged_at: 's', review_requested_at: 'r' })))).toBe('waiting');
  });

  it('falls back to the draft when the copy asked for is not there', () => {
    expect(visibleCopy(row(), 'staged')).toBe('draft');
    expect(visibleCopy(row({ staged_at: 's', staged_content: doc }), 'staged')).toBe('staged');
    expect(visibleCopy(row({ published_at: null, published_content: null }), 'live')).toBe('draft');
    expect(visibleCopy(row(), 'live')).toBe('live');
  });
});

describe('the next step', () => {
  it('leaves out "Edit draft" in the editor, where the draft is already in front of the reader', () => {
    const view = render(withQuery(<TemplateWorkflowAction id="t1" stage="live" isAdmin inEditor />));
    expect(view.container.textContent).toBe('');
  });

  it('links "Edit draft" to the template from a list', () => {
    const view = render(withQuery(<TemplateWorkflowAction id="t1" stage="live" isAdmin title="Welcome" />));
    expect(view.getByRole('link', { name: 'Edit draft “Welcome”' }).getAttribute('href')).toBe('/templates/t1');
  });

  it('sends an admin to review and a member to the same page to view', () => {
    const admin = render(withQuery(<TemplateWorkflowAction id="t1" stage="waiting" isAdmin />));
    expect(admin.getByRole('link', { name: 'Review' }).getAttribute('href')).toBe('/templates/t1/review');
    cleanup();
    const member = render(withQuery(<TemplateWorkflowAction id="t1" stage="waiting" isAdmin={false} />));
    expect(member.getByRole('link', { name: 'View sign-off' }).getAttribute('href')).toBe('/templates/t1/review');
  });

  it('stages from a draft and reports the row it got back', async () => {
    const changed: WorkflowTemplate[] = [];
    const view = render(withQuery(<TemplateWorkflowAction id="t1" stage="draft" isAdmin={false} onChanged={(next) => changed.push(next)} />));
    fireEvent.click(view.getByRole('button', { name: 'Move to staging' }));
    await waitFor(() => expect(changed).toHaveLength(1));
    expect(requests).toEqual(['POST /api/v1/templates/t1/stage']);
  });

  it('does not stage when the editor cannot save the draft first', async () => {
    const view = render(withQuery(<TemplateWorkflowAction id="t1" stage="draft" isAdmin={false} beforeStage={async () => false} />));
    fireEvent.click(view.getByRole('button', { name: 'Move to staging' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requests).toEqual([]);
  });

  it('is disabled on a read-only plan', () => {
    const view = render(withQuery(<TemplateWorkflowAction id="t1" stage="staging" isAdmin={false} disabled />));
    expect((view.getByRole('button', { name: 'Ask for sign-off' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('removing the staged copy', () => {
  it('asks first, and says a request for sign-off ends with it', () => {
    const view = render(withQuery(<TemplateUnstageAction id="t1" waiting />));
    fireEvent.click(view.getByRole('button', { name: 'Remove staged copy' }));
    expect(view.getByRole('dialog', { name: 'Remove the staged copy?' })).toBeTruthy();
    expect(view.getByText('This also ends the request for sign-off.', { exact: false })).toBeTruthy();
    expect(requests).toEqual([]);
  });

  it('leaves the request out of the wording when nobody has asked for sign-off', () => {
    const view = render(withQuery(<TemplateUnstageAction id="t1" waiting={false} />));
    fireEvent.click(view.getByRole('button', { name: 'Remove staged copy' }));
    expect(view.queryByText('ends the request', { exact: false })).toBeNull();
    expect(view.getByText('You can stage the draft again later.', { exact: false })).toBeTruthy();
  });

  it('posts to unstage once confirmed and hands back the row', async () => {
    const changed: WorkflowTemplate[] = [];
    const view = render(withQuery(<TemplateUnstageAction id="t1" waiting={false} onChanged={(next) => changed.push(next)} />));
    fireEvent.click(view.getByRole('button', { name: 'Remove staged copy' }));
    fireEvent.click(view.getByRole('button', { name: 'Confirm: Remove the staged copy?' }));
    await waitFor(() => expect(changed).toHaveLength(1));
    expect(requests).toEqual(['POST /api/v1/templates/t1/unstage']);
  });

  it('is disabled on a read-only plan', () => {
    const view = render(withQuery(<TemplateUnstageAction id="t1" waiting={false} disabled />));
    expect((view.getByRole('button', { name: 'Remove staged copy' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('publishing over a candidate', () => {
  const button = (publish: (() => void) | undefined) => <button type="button" onClick={publish}>Publish</button>;

  it('publishes straight away when nothing is staged', () => {
    let published = 0;
    const view = render(<ConfirmPublish model={model(row(), { handlePublish: async () => { published += 1; } })}>{button}</ConfirmPublish>);
    fireEvent.click(view.getByRole('button', { name: 'Publish' }));
    expect(published).toBe(1);
    expect(view.queryByRole('dialog')).toBeNull();
  });

  it('asks first when a copy is staged, and publishes only once confirmed', () => {
    let published = 0;
    const view = render(<ConfirmPublish model={model(row({ staged_at: 's' }), { handlePublish: async () => { published += 1; } })}>{button}</ConfirmPublish>);
    fireEvent.click(view.getByRole('button', { name: 'Publish' }));
    expect(published).toBe(0);
    expect(view.getByText('A copy is staged.', { exact: false })).toBeTruthy();
    expect(view.getByText('removes the staged copy', { exact: false })).toBeTruthy();
    fireEvent.click(view.getByRole('button', { name: 'Confirm: Publish the draft?' }));
    expect(published).toBe(1);
  });

  it('says someone is waiting when a request for sign-off is open', () => {
    const view = render(<ConfirmPublish model={model(row({ staged_at: 's', review_requested_at: 'r' }))}>{button}</ConfirmPublish>);
    fireEvent.click(view.getByRole('button', { name: 'Publish' }));
    expect(view.getByText('A copy is waiting for sign-off.', { exact: false })).toBeTruthy();
  });
});

describe('the staging controls', () => {
  const controls = (m: TemplateEditorModel) => render(withQuery(<TemplateWorkflowControls model={m} copy="draft" onCopy={() => {}} />));

  it('offers a copy only when it exists', () => {
    const view = controls(model(row()));
    expect((view.getByRole('radio', { name: 'Staged copy' }) as HTMLButtonElement).disabled).toBe(true);
    expect((view.getByRole('radio', { name: 'Live copy' }) as HTMLButtonElement).disabled).toBe(false);
    expect(view.queryByRole('button', { name: 'Remove staged copy' })).toBeNull();
  });

  it('offers to update the staged copy once the draft has moved on, and to remove it', () => {
    const view = controls(model(row({ staged_at: 's', staged_content: doc }), { unpublished: true }));
    expect((view.getByRole('radio', { name: 'Staged copy' }) as HTMLButtonElement).disabled).toBe(false);
    expect(view.getByRole('button', { name: 'Update staged copy' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Ask for sign-off' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Remove staged copy' })).toBeTruthy();
  });

  it('shows a waiting copy as locked, with a way out for any member', () => {
    const view = controls(model(row({ staged_at: 's', staged_content: doc, review_requested_at: 'r' }), { isAdmin: false }));
    expect(view.getByText('Waiting for sign-off')).toBeTruthy();
    expect(view.getByRole('link', { name: 'View sign-off' }).getAttribute('href')).toBe('/templates/t1/review');
    expect(view.queryByRole('button', { name: 'Update staged copy' })).toBeNull();
    expect(view.getByRole('button', { name: 'Remove staged copy' })).toBeTruthy();
  });

  it('shows an admin the way to roll back only when there is an earlier version and nothing is waiting', () => {
    expect(controls(model(row())).getByRole('link', { name: 'Review and rollback' }).getAttribute('href')).toBe('/templates/t1/review');
    cleanup();
    expect(controls(model(row({ live_version: 1 }))).queryByRole('link', { name: 'Review and rollback' })).toBeNull();
    cleanup();
    expect(controls(model(row(), { isAdmin: false })).queryByRole('link', { name: 'Review and rollback' })).toBeNull();
    cleanup();
    expect(controls(model(row({ staged_at: 's', review_requested_at: 'r' }))).queryByRole('link', { name: 'Review and rollback' })).toBeNull();
  });

  it('does not offer "Edit draft" in the editor', () => {
    const view = controls(model(row()));
    expect(view.queryByRole('link', { name: 'Edit draft' })).toBeNull();
  });
});
