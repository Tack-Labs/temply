import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../core/editor/test/dom';
import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// The dialog's content is a Radix portal, which a mounted test cannot count
// on (see ui/dialog.test.tsx), so the decisions made before the portal are
// covered by mounting the dialog, and the delete itself by its hook: what
// the customer hears and where they end up when the request fails.
//
// Bun shares one module registry across test files and `mock.module`
// outlives the file that made it, so each real module is captured first and
// put back afterwards.
const push = mock((_href: string) => {});
const refresh = mock(() => {});
const toastError = mock((_message: string) => {});
const toastSuccess = mock((_message: string) => {});
let remove: (path: string) => Promise<unknown> = async () => ({});

const realNavigation = { ...(await import('next/navigation')) };
const realHttp = { ...(await import('~/lib/http')) };
const realSonner = { ...(await import('sonner')) };
mock.module('next/navigation', () => ({ ...realNavigation, useRouter: () => ({ push, refresh }) }));
mock.module('~/lib/http', () => ({ ...realHttp, httpDelete: (path: string) => remove(path) }));
mock.module('sonner', () => ({ ...realSonner, toast: { ...realSonner.toast, error: toastError, success: toastSuccess } }));
afterAll(() => {
  mock.module('next/navigation', () => realNavigation);
  mock.module('~/lib/http', () => realHttp);
  mock.module('sonner', () => realSonner);
});
const { DeleteEmailDialog, useDeleteTemplate } = await import('./delete-email-dialog');

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const mount = (element: React.ReactElement) => render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  push.mockClear();
  refresh.mockClear();
  toastError.mockClear();
  toastSuccess.mockClear();
  remove = async () => ({});
});
afterEach(cleanup);

describe('DeleteEmailDialog', () => {
  it('draws no trigger when it is not handed one', () => {
    // Both callers bring the control that opens it, or open it from outside;
    // a button of its own would be a second Delete nobody mounts.
    const view = mount(<DeleteEmailDialog templateId="abc" />);
    expect(view.container.querySelector('button')).toBeNull();
  });

  it('uses the trigger it is handed', () => {
    const view = mount(<DeleteEmailDialog templateId="abc" trigger={<button type="button">Remove it</button>} />);
    expect(view.getByRole('button', { name: 'Remove it' })).toBeTruthy();
  });

  it('draws no trigger at all when it is opened from outside', () => {
    // The header's ⋯ menu owns Delete. A dialog mounted inside menu content
    // goes when the menu closes, so the menu holds the open state and the
    // dialog sits beside it with nothing of its own to press.
    const view = mount(<DeleteEmailDialog templateId="abc" trigger={null} open={false} onOpenChange={() => {}} />);
    expect(view.container.querySelector('button')).toBeNull();
  });
});

describe('useDeleteTemplate', () => {
  it('deletes the template, says so, and goes back to the list', async () => {
    const paths: string[] = [];
    remove = async (path) => {
      paths.push(path);
      return {};
    };
    const { result } = renderHook(() => useDeleteTemplate('tmpl_1'), { wrapper });

    act(() => result.current.mutate());

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/templates'));
    expect(paths).toEqual(['/api/v1/templates/tmpl_1']);
    expect(toastSuccess).toHaveBeenCalledWith('Template deleted');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('says why it failed and stays put, with the button free to try again', async () => {
    // Without an error handler the dialog sat open with no word said while the
    // template stayed where it was.
    remove = async () => {
      throw new Error('Template is locked');
    };
    const { result } = renderHook(() => useDeleteTemplate('tmpl_1'), { wrapper });

    act(() => result.current.mutate());

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Template is locked'));
    expect(push).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(false);
  });

  it('falls back to a plain sentence when the failure carries no message', async () => {
    remove = async () => {
      throw new Error('');
    };
    const { result } = renderHook(() => useDeleteTemplate('tmpl_1'), { wrapper });

    act(() => result.current.mutate());

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Could not delete the template'));
  });
});
