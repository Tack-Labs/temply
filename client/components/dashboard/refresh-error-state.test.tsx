import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';

// Bun shares one process, and one module registry, across test files, and
// `mock.module` outlives the file that made it. The real module is captured
// before it is replaced and put back afterwards, or every file that runs later
// would meet the stand-in, and which files those are depends on the run order.
// The retry refreshes the route, and there is no app here to ask: the stand-in
// answers when the test says so, as the route's refresh does once the server
// has, which is what keeps the transition pending in between.
let settle = () => {};
const refresh = mock(
  () =>
    new Promise<void>((resolve) => {
      settle = resolve;
    }),
);
const realNavigation = { ...(await import('next/navigation')) };
mock.module('next/navigation', () => ({ ...realNavigation, useRouter: () => ({ refresh }) }));
afterAll(() => {
  mock.module('next/navigation', () => realNavigation);
});

const { RefreshErrorState } = await import('./refresh-error-state');

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(async () => {
  // A refresh still out when the test ends is answered inside act, so React is
  // not left finishing a transition no test is watching.
  await act(async () => settle());
  cleanup();
  refresh.mockClear();
});

type View = ReturnType<typeof render>;
const setup = () => render(<RefreshErrorState title="Usage could not be loaded" description="We could not reach billing." />);
const retry = (view: View) => fireEvent.click(view.getByRole('button', { name: 'Try again' }));
const status = (view: View) => view.getByRole('status');
const dimmed = (view: View) => view.getByText('Usage could not be loaded').closest('.transition-opacity');
/** The refresh comes back with the same error still there, as the route does when nothing has changed. */
const failAgain = () => act(async () => settle());

const TRYING = 'Trying again…';
const STILL = 'Still could not load. Try again in a moment.';

describe('RefreshErrorState', () => {
  it('says what failed and offers a retry that refreshes the route', () => {
    const view = setup();
    expect(view.getByText('Usage could not be loaded')).toBeTruthy();
    expect(view.getByText('We could not reach billing.')).toBeTruthy();

    retry(view);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('falls back to the primitive’s own title when none is given', () => {
    const view = render(<RefreshErrorState description="We could not reach the server." />);
    expect(view.getByText('Could not load this')).toBeTruthy();
  });

  it('is not busy until a retry is under way', () => {
    expect(dimmed(setup())?.getAttribute('aria-busy')).toBeNull();
  });

  it('ignores a second press until the refresh has settled', async () => {
    const view = setup();
    retry(view);
    await waitFor(() => expect(dimmed(view)?.getAttribute('aria-busy')).toBe('true'));
    retry(view);
    expect(refresh).toHaveBeenCalledTimes(1);

    await failAgain();
    retry(view);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});

describe('RefreshErrorState announcing a retry', () => {
  it('says nothing on first render, and draws no alert: the error is already on the page', () => {
    const view = setup();
    // Mounted from the start, because a live region announces a change to its
    // text and not text it was mounted with.
    expect(status(view).textContent).toBe('');
    expect(status(view).getAttribute('aria-live')).toBeNull();
    expect(view.queryByRole('alert')).toBeNull();
  });

  it('keeps the line shut until there is something to say, and opens it with a transition', async () => {
    const view = setup();
    const track = status(view).closest('[class*="grid-rows-"]');
    expect(track?.className).toContain('grid-rows-[0fr]');
    expect(track?.className).toContain('motion-reduce:transition-none');

    retry(view);
    await waitFor(() => expect(status(view).closest('[class*="grid-rows-"]')?.className).toContain('grid-rows-[1fr]'));
  });

  it('says it is trying again while the refresh runs', async () => {
    const view = setup();
    retry(view);
    await waitFor(() => expect(status(view).textContent).toBe(TRYING));
  });

  it('keeps the region out of the busy wrapper, which would hold its announcements back', async () => {
    const view = setup();
    retry(view);
    await waitFor(() => expect(status(view).textContent).toBe(TRYING));
    expect(dimmed(view)?.contains(status(view))).toBe(false);
    expect(status(view).closest('[aria-busy]')).toBeNull();
  });

  it('says the error is still there when the retry ends with it unchanged', async () => {
    const view = setup();
    retry(view);
    await failAgain();
    await waitFor(() => expect(status(view).textContent).toBe(STILL));
    expect(dimmed(view)?.getAttribute('aria-busy')).toBeNull();
    // The visible copy and the button are the ones that were there.
    expect(view.getByText('Usage could not be loaded')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('says so again after a second failed retry, passing through "trying again" so the text changes', async () => {
    const view = setup();
    retry(view);
    await failAgain();
    await waitFor(() => expect(status(view).textContent).toBe(STILL));

    retry(view);
    await waitFor(() => expect(status(view).textContent).toBe(TRYING));
    await failAgain();
    await waitFor(() => expect(status(view).textContent).toBe(STILL));
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
