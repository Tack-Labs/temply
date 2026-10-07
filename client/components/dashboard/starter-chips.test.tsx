import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';

// Bun shares one process, and one module registry, across test files, and
// `mock.module` outlives the file that made it. The real modules are captured
// before they are replaced and put back afterwards, or every file that runs
// later would meet the stand-ins, and which files those are depends on the
// run order.
const push = mock((_href: string) => {});
const toastError = mock((_message: string) => {});
let post: (path: string, body: unknown) => Promise<unknown> = async () => ({ template: { id: 'made' } });

const realClerk = { ...(await import('@clerk/nextjs')) };
const realNavigation = { ...(await import('next/navigation')) };
const realHttp = { ...(await import('~/lib/http')) };
const realSonner = { ...(await import('sonner')) };
mock.module('@clerk/nextjs', () => ({ ...realClerk, useOrganization: () => ({ organization: null }) }));
mock.module('next/navigation', () => ({ ...realNavigation, useRouter: () => ({ push }) }));
mock.module('~/lib/http', () => ({ ...realHttp, httpPost: (path: string, body: unknown) => post(path, body) }));
mock.module('sonner', () => ({ ...realSonner, toast: { ...realSonner.toast, error: toastError } }));
afterAll(() => {
  mock.module('@clerk/nextjs', () => realClerk);
  mock.module('next/navigation', () => realNavigation);
  mock.module('~/lib/http', () => realHttp);
  mock.module('sonner', () => realSonner);
});

const { StarterChips } = await import('./starter-chips');

let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  push.mockClear();
  toastError.mockClear();
  post = async () => ({ template: { id: 'made' } });
});
afterEach(cleanup);

const setup = (props: Partial<React.ComponentProps<typeof StarterChips>> = {}) =>
  render(
    <QueryClientProvider client={client}>
      <StarterChips {...props} />
    </QueryClientProvider>,
  );

const NAMES = ['Blank', 'Welcome', 'Verify email', 'Password reset', 'Receipt', 'Team invite', 'Product update'];

describe('StarterChips', () => {
  it('offers the seven starters as buttons under a heading', () => {
    const view = setup();
    expect(view.getByRole('heading', { level: 2, name: 'Start from a starter' })).toBeTruthy();
    const buttons = view.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(NAMES);
    expect(view.getAllByRole('listitem')).toHaveLength(7);
  });

  it('is a region named by its heading', () => {
    const view = setup();
    expect(view.getByRole('region', { name: 'Start from a starter' })).toBeTruthy();
  });

  it('makes the template from the starter that was picked, then opens it', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    post = async (_path, body) => {
      bodies.push(body as Record<string, unknown>);
      return { template: { id: 'tmpl_1' } };
    };
    const view = setup();

    fireEvent.click(view.getByRole('button', { name: 'Welcome' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/templates/tmpl_1'));
    expect(bodies).toHaveLength(1);
    expect(bodies[0]!.title).toBe('Welcome to Temply');
  });

  it('marks the chip that is working and holds every other one until the page moves on', async () => {
    let finish!: (value: unknown) => void;
    post = () => new Promise((resolve) => (finish = resolve));
    const view = setup();

    fireEvent.click(view.getByRole('button', { name: 'Receipt' }));

    await waitFor(() => expect(view.getByRole('button', { name: 'Receipt' }).getAttribute('aria-busy')).toBe('true'));
    const others = view.getAllByRole('button').filter((button) => button.textContent !== 'Receipt');
    expect(others).toHaveLength(6);
    for (const button of others) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(view.getByRole('button', { name: 'Receipt' }).querySelector('svg.animate-spin')).toBeTruthy();
    expect(view.container.querySelector('ul')?.getAttribute('aria-busy')).toBe('true');

    await act(async () => finish({ template: { id: 'r' } }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/templates/r'));
  });

  it('says what went wrong and frees every chip to try again', async () => {
    post = async () => {
      throw new Error('Template limit reached');
    };
    const view = setup();

    fireEvent.click(view.getByRole('button', { name: 'Blank' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Template limit reached'));
    await waitFor(() => {
      for (const button of view.getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(false);
    });
    expect(view.getByRole('button', { name: 'Blank' }).getAttribute('aria-busy')).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it('is shown but cannot be used at the template limit or when read-only', () => {
    const view = setup({ disabled: true });
    const buttons = view.getAllByRole('button') as HTMLButtonElement[];
    expect(buttons).toHaveLength(7);
    for (const button of buttons) expect(button.disabled).toBe(true);
  });

  it('makes no template when a disabled chip is clicked anyway', () => {
    let made = 0;
    post = async () => {
      made += 1;
      return { template: { id: 'x' } };
    };
    const view = setup({ disabled: true });
    fireEvent.click(view.getByRole('button', { name: 'Blank' }));
    expect(made).toBe(0);
  });

  it('wraps as a row of pills, each at least 44px tall', () => {
    const view = setup();
    expect(view.container.querySelector('ul')?.className).toContain('flex-wrap');
    for (const button of view.getAllByRole('button')) {
      expect(button.className).toContain('h-11');
      expect(button.className).toContain('rounded-full');
    }
  });
});
