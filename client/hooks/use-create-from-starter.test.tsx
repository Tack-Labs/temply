import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../core/editor/test/dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

// Bun shares one process, and one module registry, across test files, and
// `mock.module` outlives the file that made it. The real modules are captured
// before they are replaced and put back afterwards, or every file that runs
// later would meet the stand-ins, and which files those are depends on the
// run order.
type Organization = { name: string; hasImage: boolean; imageUrl: string } | null;
let organization: Organization = null;
const push = mock((_href: string) => {});
const toastError = mock((_message: string) => {});
let post: (path: string, body: unknown) => Promise<unknown> = async () => ({ template: { id: 'made' } });

const realClerk = { ...(await import('@clerk/nextjs')) };
const realNavigation = { ...(await import('next/navigation')) };
const realHttp = { ...(await import('~/lib/http')) };
const realSonner = { ...(await import('sonner')) };
mock.module('@clerk/nextjs', () => ({ ...realClerk, useOrganization: () => ({ organization }) }));
mock.module('next/navigation', () => ({ ...realNavigation, useRouter: () => ({ push }) }));
mock.module('~/lib/http', () => ({ ...realHttp, httpPost: (path: string, body: unknown) => post(path, body) }));
mock.module('sonner', () => ({ ...realSonner, toast: { ...realSonner.toast, error: toastError } }));
afterAll(() => {
  mock.module('@clerk/nextjs', () => realClerk);
  mock.module('next/navigation', () => realNavigation);
  mock.module('~/lib/http', () => realHttp);
  mock.module('sonner', () => realSonner);
});

const { useCreateFromStarter } = await import('./use-create-from-starter');

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  organization = null;
  push.mockClear();
  toastError.mockClear();
  post = async () => ({ template: { id: 'made' } });
});
afterEach(cleanup);

/** A request that stays open until the test settles it. */
function held() {
  let settle!: (outcome: { ok: unknown } | { fail: Error }) => void;
  const request = new Promise((resolve, reject) => {
    settle = (outcome) => ('ok' in outcome ? resolve(outcome.ok) : reject(outcome.fail));
  });
  return { request, settle };
}

describe('useCreateFromStarter starters', () => {
  it('offers the seven starters, in the order the gallery does', () => {
    const { result } = renderHook(() => useCreateFromStarter(), { wrapper });
    expect(result.current.starters.map((starter) => starter.id)).toEqual([
      'blank', 'welcome', 'verify-email', 'password-reset', 'receipt', 'invite', 'announcement',
    ]);
  });

  it('puts the workspace’s own name where the sample company was', () => {
    organization = { name: 'Northwind', hasImage: false, imageUrl: 'https://img.test/initials.png' };
    const welcome = renderHook(() => useCreateFromStarter(), { wrapper }).result.current.starters.find((s) => s.id === 'welcome');
    expect(welcome?.subject).toBe('Welcome to Northwind');
  });
});

describe('useCreateFromStarter creating', () => {
  it('posts the starter as a template, then opens it', async () => {
    const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
    post = async (path, body) => {
      calls.push({ path, body: body as Record<string, unknown> });
      return { template: { id: 'tmpl_9' } };
    };
    const { result } = renderHook(() => useCreateFromStarter(), { wrapper });
    const receipt = result.current.starters.find((s) => s.id === 'receipt')!;

    act(() => result.current.create(receipt));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/templates/tmpl_9'));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.path).toBe('/api/v1/templates');
    expect(calls[0]!.body).toEqual({
      title: receipt.subject,
      previewText: receipt.previewText,
      content: JSON.stringify(receipt.content),
    });
  });

  it('names the starter in flight, and stays busy through the redirect so a second click cannot make a second template', async () => {
    const open = held();
    const made: string[] = [];
    // One stand-in for the whole test: react-query calls the request a few
    // microtasks after `mutate`, so swapping it mid-test would swap it under
    // the first create as well.
    post = (_path, body) => {
      made.push((body as { title: string }).title);
      return open.request;
    };
    const { result } = renderHook(() => useCreateFromStarter(), { wrapper });
    const [blank, welcome] = [result.current.starters[0]!, result.current.starters[1]!];
    expect(result.current.busy).toBe(false);
    expect(result.current.pickedId).toBeNull();

    act(() => result.current.create(blank));
    expect(result.current.pickedId).toBe('blank');
    expect(result.current.busy).toBe(true);

    // A second pick while the first is open is ignored.
    await act(async () => result.current.create(welcome));
    expect(made).toEqual([blank.subject]);
    expect(result.current.pickedId).toBe('blank');

    await act(async () => open.settle({ ok: { template: { id: 'first' } } }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/templates/first'));
    // The page is still on its way out: the chip keeps its spinner.
    expect(result.current.pickedId).toBe('blank');
    expect(result.current.busy).toBe(true);
    await act(async () => result.current.create(welcome));
    expect(made).toEqual([blank.subject]);
  });

  it('refuses two picks inside one frame, before either has rendered', async () => {
    const made: string[] = [];
    post = async (_path, body) => {
      made.push((body as { title: string }).title);
      return { template: { id: 'only' } };
    };
    const { result } = renderHook(() => useCreateFromStarter(), { wrapper });
    const [first, second] = [result.current.starters[1]!, result.current.starters[2]!];

    await act(async () => {
      result.current.create(first);
      result.current.create(second);
    });

    expect(made).toEqual([first.subject]);
  });

  it('is busy in every place that offers a starter, not only the one that was clicked', async () => {
    const open = held();
    post = () => open.request;
    const gallery = renderHook(() => useCreateFromStarter(), { wrapper });
    const chips = renderHook(() => useCreateFromStarter(), { wrapper });

    act(() => gallery.result.current.create(gallery.result.current.starters[2]!));
    await waitFor(() => expect(chips.result.current.busy).toBe(true));
    // The other surface does not name a chip it never started.
    expect(chips.result.current.pickedId).toBeNull();

    await act(async () => open.settle({ fail: new Error('nope') }));
    await waitFor(() => expect(chips.result.current.busy).toBe(false));
  });
});

describe('useCreateFromStarter failing', () => {
  it('says what went wrong, and lets the reader try again', async () => {
    post = async () => {
      throw new Error('Template limit reached');
    };
    const { result } = renderHook(() => useCreateFromStarter(), { wrapper });

    act(() => result.current.create(result.current.starters[0]!));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Template limit reached'));
    expect(push).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.pickedId).toBeNull();
  });

  it('falls back to a plain sentence when the error has no message', async () => {
    post = async () => {
      throw new Error('');
    };
    const { result } = renderHook(() => useCreateFromStarter(), { wrapper });

    act(() => result.current.create(result.current.starters[0]!));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Could not create the template'));
  });
});
