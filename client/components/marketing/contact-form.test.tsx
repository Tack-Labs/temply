import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { ContactForm } from './contact-form';

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

const realFetch = globalThis.fetch;
let answers: Array<() => Response> = [];
let bodies: Array<Record<string, unknown>> = [];

beforeEach(() => {
  answers = [];
  bodies = [];
  globalThis.fetch = mock((_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const answer = answers.shift();
    return Promise.resolve(answer ? answer() : new Response(JSON.stringify({}), { status: 500 }));
  }) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const broken = () => new Response(JSON.stringify({}), { status: 500 });
const fused = () =>
  new Response(JSON.stringify({ errors: true, message: 'Too many messages. Try again in a minute.' }), { status: 429 });

type View = ReturnType<typeof render>;

/** The live regions in the markup itself, which the accessible-only queries would hide. */
const alerts = (view: View) => [...view.container.querySelectorAll('[role="alert"]')];

// React settles at load whether the DOM reports `input` events, and under
// happy-dom it settles on no: it then reads a field's value on focus and key
// release instead. A typed change is therefore a focus, the value arriving, and
// a key coming up, as in template-list.test.tsx.
function type(field: HTMLElement, value: string) {
  fireEvent.focusIn(field);
  fireEvent.input(field, { target: { value } });
  fireEvent.keyUp(field, { key: 'x' });
}

function fillIn(view: View) {
  type(view.getByLabelText('Name'), 'Ada');
  type(view.getByLabelText('Email'), 'ada@example.com');
  type(view.getByLabelText('Message'), 'Hello there');
}

async function submit(view: View) {
  await act(async () => {
    fireEvent.submit(view.container.querySelector('form')!);
  });
}

describe('ContactForm failure notice', () => {
  it('is not a live region until a send has failed', () => {
    const view = render(<ContactForm />);
    expect(alerts(view)).toHaveLength(0);
  });

  it('mounts one alert with the words and the address when a send fails', async () => {
    answers = [broken];
    const view = render(<ContactForm />);
    fillIn(view);
    await submit(view);

    await waitFor(() => expect(alerts(view)).toHaveLength(1));
    const [alert] = alerts(view);
    expect(alert.textContent).toContain('That did not send.');
    expect(alert.querySelector('a')?.getAttribute('href')).toMatch(/^mailto:.+@.+/);
  });

  it('announces the same failure again as a new element', async () => {
    answers = [broken, broken];
    const view = render(<ContactForm />);
    fillIn(view);
    await submit(view);
    await waitFor(() => expect(alerts(view)).toHaveLength(1));
    const [first] = alerts(view);

    await submit(view);
    await waitFor(() => expect(first.isConnected).toBe(false));
    await waitFor(() => expect(alerts(view)).toHaveLength(1));
    const [second] = alerts(view);

    expect(second).not.toBe(first);
    expect(second.textContent).toBe(first.textContent);
    expect(bodies).toHaveLength(2);
  });

  it('is not a live region again while the next send is in flight', async () => {
    answers = [broken];
    const view = render(<ContactForm />);
    fillIn(view);
    await submit(view);
    await waitFor(() => expect(alerts(view)).toHaveLength(1));

    // The second request never answers, so the form stays in "Sending".
    globalThis.fetch = mock(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    await submit(view);

    expect(alerts(view)).toHaveLength(0);
  });

  it('shows the send button as the filled disabled pill while a send is in flight, not the live violet faded', async () => {
    globalThis.fetch = mock(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    const view = render(<ContactForm />);
    fillIn(view);
    await submit(view);

    const send = view.getByRole('button', { name: 'Sending' });
    expect(send.getAttribute('aria-disabled'), 'it keeps the keyboard, so it is not `disabled`').toBe('true');
    const classes = send.className.split(/\s+/);
    for (const needed of ['aria-disabled:bg-track', 'aria-disabled:text-disabled', 'aria-disabled:shadow-none', 'aria-disabled:cursor-wait']) {
      expect(classes).toContain(needed);
    }
    expect(classes.some((name) => name.startsWith('aria-disabled:opacity'))).toBe(false);
  });

  it('uses the server\'s own words, with no address, when the fuse is blown', async () => {
    answers = [fused];
    const view = render(<ContactForm />);
    fillIn(view);
    await submit(view);

    await waitFor(() => expect(alerts(view)).toHaveLength(1));
    const [alert] = alerts(view);
    expect(alert.textContent).toBe('Too many messages. Try again in a minute.');
    expect(alert.querySelector('a')).toBeNull();
  });
});
