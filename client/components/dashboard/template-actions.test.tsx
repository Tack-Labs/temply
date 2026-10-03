import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Bun shares one process, and one module registry, across test files, and
// `mock.module` outlives the file that made it. Left in place, a stand-in
// below would be what every later file imports, and which files those are
// depends on the run order; so each is put back, as the module stood when
// this file loaded, once the file is done.

// The actions refresh the route once a request lands, and there is no app
// router here to ask. The router has to be replaced at the module: the hook
// reads it through next/navigation, and a context provider would lose to any
// stand-in that module already carries.
const refresh = mock(() => {});
const realNavigation = { ...(await import('next/navigation')) };
mock.module('next/navigation', () => ({ ...realNavigation, useRouter: () => ({ refresh }) }));

// The confirmation is a Radix dialog in a portal, which a mounted test cannot
// count on (see dialog.test.tsx). This stands in for it with the one thing the
// actions depend on: a button that answers yes.
const realConfirmDialog = { ...(await import('~/components/ui/confirm-dialog')) };
mock.module('~/components/ui/confirm-dialog', () => ({
  ...realConfirmDialog,
  ConfirmDialog: ({
    title,
    description,
    onConfirm,
    children,
  }: {
    title: string;
    description: string;
    onConfirm: () => void;
    children?: React.ReactNode;
  }) => (
    <>
      {children}
      <p>{description}</p>
      <button type="button" onClick={onConfirm}>
        {`Confirm: ${title}`}
      </button>
    </>
  ),
}));
afterAll(() => {
  mock.module('next/navigation', () => realNavigation);
  mock.module('~/components/ui/confirm-dialog', () => realConfirmDialog);
});

const { TemplateActions } = await import('./template-actions');

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

const realFetch = globalThis.fetch;
let respond!: (response: Response) => void;
let requests: Array<{ url: string; method: string | undefined }> = [];

// Every request waits until the test says how it ends, so what the buttons do
// in between can be looked at.
beforeEach(() => {
  refresh.mockClear();
  requests = [];
  globalThis.fetch = mock((url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), method: init?.method });
    return new Promise<Response>((resolve) => {
      respond = resolve;
    });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const ok = () => new Response(JSON.stringify({ template: { id: 'copy' } }), { status: 200 });
const refused = () => new Response(JSON.stringify({}), { status: 500 });

const setup = (props: Partial<React.ComponentProps<typeof TemplateActions>> = {}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TemplateActions templateId="t1" {...props} />
    </QueryClientProvider>,
  );

type View = ReturnType<typeof render>;
const duplicate = (view: View) => view.getByRole('button', { name: /^Duplicate template/ }) as HTMLButtonElement;
const remove = (view: View) => view.getByRole('button', { name: /^Delete template/ }) as HTMLButtonElement;

describe('TemplateActions names', () => {
  it('keeps "Duplicate template" and "Delete template" as the stem of each button name', () => {
    const view = setup();
    expect(view.getByRole('button', { name: 'Duplicate template' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Delete template' })).toBeTruthy();
  });

  it('adds the title, so a list of rows has buttons a screen reader can tell apart', () => {
    const view = setup({ templateTitle: 'Welcome email' });
    expect(view.getByRole('button', { name: 'Duplicate template “Welcome email”' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Delete template “Welcome email”' })).toBeTruthy();
  });

  it('asks the question the specs and customers know, in the words they know', () => {
    const view = setup();
    expect(view.getByText('This cannot be undone.')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Confirm: Delete this template?' })).toBeTruthy();
  });

  it('leaves out Duplicate once the plan cap is hit, and keeps Delete', () => {
    const view = setup({ canDuplicate: false });
    expect(view.queryByRole('button', { name: /^Duplicate template/ })).toBeNull();
    expect(remove(view)).toBeTruthy();
  });
});

describe('TemplateActions duplicating', () => {
  it('disables both buttons while the copy is being made, then gives them back and refreshes', async () => {
    const view = setup();
    fireEvent.click(duplicate(view));
    await waitFor(() => expect(duplicate(view).disabled).toBe(true));
    expect(remove(view).disabled).toBe(true);
    expect(requests).toEqual([{ url: '/api/v1/templates/t1/duplicate', method: 'POST' }]);
    expect(refresh).not.toHaveBeenCalled();

    respond(ok());
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(duplicate(view).disabled).toBe(false));
    expect(remove(view).disabled).toBe(false);
  });

  it('gives the buttons back when the copy fails, without refreshing a list that did not change', async () => {
    const view = setup();
    fireEvent.click(duplicate(view));
    await waitFor(() => expect(duplicate(view).disabled).toBe(true));
    respond(refused());
    await waitFor(() => expect(duplicate(view).disabled).toBe(false));
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('TemplateActions deleting', () => {
  it('reports the delete as it moves, and disables both buttons while it runs', async () => {
    const states: string[] = [];
    const view = setup({ onDeleteStateChange: (state) => states.push(state) });
    fireEvent.click(view.getByRole('button', { name: 'Confirm: Delete this template?' }));
    await waitFor(() => expect(remove(view).disabled).toBe(true));
    expect(duplicate(view).disabled).toBe(true);
    expect(states).toEqual(['deleting']);
    expect(requests).toEqual([{ url: '/api/v1/templates/t1', method: 'DELETE' }]);

    respond(ok());
    await waitFor(() => expect(states).toEqual(['deleting', 'deleted']));
    // The row is told it is gone before the refresh takes it out of the list,
    // so it has a moment to close.
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('reports the template back as idle when the server refuses, and does not refresh', async () => {
    const states: string[] = [];
    const view = setup({ onDeleteStateChange: (state) => states.push(state) });
    fireEvent.click(view.getByRole('button', { name: 'Confirm: Delete this template?' }));
    await waitFor(() => expect(states).toEqual(['deleting']));
    respond(refused());
    await waitFor(() => expect(states).toEqual(['deleting', 'idle']));
    await waitFor(() => expect(remove(view).disabled).toBe(false));
    expect(refresh).not.toHaveBeenCalled();
  });
});
