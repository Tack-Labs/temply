import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TemplateEditorModel } from './use-template-editor';

// The version history and the share popover read the plan to know whether the
// workspace is read-only; there is no server here to answer. The real module
// is put back afterwards, or the stand-in would be every later file's.
const realBilling = { ...(await import('~/lib/billing')) };
mock.module('~/lib/billing', () => ({ ...realBilling, useBilling: () => ({ data: undefined }) }));
const realNavigation = { ...(await import('next/navigation')) };
mock.module('next/navigation', () => ({ ...realNavigation, useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
afterAll(() => {
  mock.module('~/lib/billing', () => realBilling);
  mock.module('next/navigation', () => realNavigation);
});
const { EditorActions, EditorStatus } = await import('./editor-actions');

afterEach(cleanup);

/** The slice of the editor model these two components read. */
function modelWith(overrides: Record<string, unknown> = {}) {
  return {
    template: { id: 'abc', share_token: null, staged_at: null, review_requested_at: null, short_code: 'abc123' },
    readOnly: false,
    isAdmin: true,
    unpublished: true,
    publishedLabel: null,
    publishStatus: 'unpublished',
    publishBadge: { label: 'Unpublished changes', tone: 'warn' },
    isPublishing: false,
    publishArmed: false,
    sendArmed: false,
    saveStatus: 'idle',
    autosave: null,
    handlePublish: mock(() => Promise.resolve()),
    handleSend: mock(() => {}),
    handleDiscarded: () => {},
    handleRestored: () => {},
    ...overrides,
  } as unknown as TemplateEditorModel;
}

function mount(model: TemplateEditorModel) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EditorActions model={model} />
    </QueryClientProvider>,
  );
}

describe('EditorActions', () => {
  it('offers Send a test and Publish, with History, Share and Delete behind one menu', () => {
    const view = mount(modelWith());
    expect(view.getByRole('button', { name: 'Send a test', exact: true })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Publish', exact: true })).toBeTruthy();
    const more = view.getByRole('button', { name: 'More actions' });
    expect(more.getAttribute('aria-haspopup')).toBe('menu');
    // The rarer actions are not on the bar: History and Share are a few
    // clicks in a template's life, and Delete is one slip from losing it.
    expect(view.queryByRole('button', { name: 'History' })).toBeNull();
    expect(view.queryByRole('button', { name: 'Share a review link' })).toBeNull();
    expect(view.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('draws nothing for a document that is not a saved template', () => {
    const view = mount(modelWith({ template: null }));
    expect(view.container.textContent).toBe('');
  });

  it('shows Publish to an admin only', () => {
    const view = mount(modelWith({ isAdmin: false }));
    expect(view.queryByRole('button', { name: 'Publish', exact: true })).toBeNull();
    expect(view.getByRole('button', { name: 'Send a test', exact: true })).toBeTruthy();
  });

  it('presses Publish through the model', () => {
    const model = modelWith();
    const view = mount(model);
    fireEvent.click(view.getByRole('button', { name: 'Publish', exact: true }));
    expect(model.handlePublish).toHaveBeenCalledTimes(1);
  });

  it('turns Publish off in a read-only workspace, and keeps the test send, which it may still make', () => {
    const view = mount(modelWith({ readOnly: true }));
    const publish = view.getByRole('button', { name: 'Publish', exact: true }) as HTMLButtonElement;
    expect(publish.disabled).toBe(true);
    expect((view.getByRole('button', { name: 'Send a test', exact: true }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('turns Publish off when the published copy is already this draft, and on again when it is armed', () => {
    const published = mount(modelWith({ publishStatus: 'published', unpublished: false }));
    expect((published.getByRole('button', { name: 'Publish', exact: true }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();

    // Armed: the first click found errors and opened the checks; the second
    // goes through under the name of what it overrides.
    const armed = mount(modelWith({ publishStatus: 'published', publishArmed: true }));
    const anyway = armed.getByRole('button', { name: 'Publish anyway' }) as HTMLButtonElement;
    expect(anyway.disabled).toBe(false);
    expect(anyway.className).toContain('bg-danger');
  });

  it('keeps Publish named Publish while it works, and says it is busy', () => {
    const view = mount(modelWith({ isPublishing: true }));
    const publish = view.getByRole('button', { name: 'Publish', exact: true });
    expect(publish.getAttribute('aria-busy')).toBe('true');
    expect((publish as HTMLButtonElement).disabled).toBe(true);
  });

  it('asks the model for the test send, and says "Send anyway" once armed', () => {
    const model = modelWith();
    const view = mount(model);
    fireEvent.click(view.getByRole('button', { name: 'Send a test', exact: true }));
    expect(model.handleSend).toHaveBeenCalledTimes(1);
    cleanup();

    const armed = mount(modelWith({ sendArmed: true }));
    expect(armed.getByRole('button', { name: 'Send anyway', exact: true })).toBeTruthy();
  });

  it('makes Publish the one primary action on the bar', () => {
    const view = mount(modelWith());
    const primary = [...view.container.querySelectorAll('button')].filter((button) =>
      button.className.split(/\s+/).includes('bg-accent'),
    );
    expect(primary.map((button) => button.textContent)).toEqual(['Publish']);
  });
});

describe('EditorStatus', () => {
  it('says where the draft stands against what is published, with a dot for a status', () => {
    const view = render(<EditorStatus model={modelWith()} />);
    const badge = view.getByText('Unpublished changes');
    expect(badge.className).toContain('bg-warn-wash');
    expect(badge.querySelector('span[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows no badge when there is nothing honest to say, and keeps the one live region for saves', () => {
    const view = render(<EditorStatus model={modelWith({ publishBadge: null, saveStatus: 'saved' })} />);
    expect(view.queryByText('Unpublished changes')).toBeNull();
    const regions = view.getAllByRole('status');
    expect(regions).toHaveLength(1);
    expect(regions[0]!.textContent).toBe('Saved');
  });

  it('announces nothing while nothing has happened', () => {
    const view = render(<EditorStatus model={modelWith({ saveStatus: 'idle' })} />);
    expect(view.getByRole('status').textContent).toBe('');
  });
});
