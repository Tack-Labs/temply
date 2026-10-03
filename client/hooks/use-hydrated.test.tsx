import { afterEach, describe, expect, it } from 'bun:test';
import '../core/editor/test/dom';
import { act, cleanup, render } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { useHydrated } from './use-hydrated';

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

function Probe() {
  return <p>{useHydrated() ? 'client' : 'server'}</p>;
}

describe('useHydrated', () => {
  it('is false in the markup the server sends', () => {
    expect(renderToString(<Probe />)).toContain('server');
  });

  it('is true on the first render of a client that is not hydrating', () => {
    expect(render(<Probe />).container.textContent).toBe('client');
  });

  it('agrees with the server through hydration, then turns true without a mismatch', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Probe />);
    document.body.append(container);
    const mismatches: unknown[] = [];

    await act(async () => {
      hydrateRoot(container, <Probe />, { onRecoverableError: (error) => mismatches.push(error) });
    });

    expect(mismatches).toEqual([]);
    expect(container.textContent).toBe('client');
    container.remove();
  });
});
