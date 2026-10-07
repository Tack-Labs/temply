import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../core/editor/test/dom';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

// Bun shares one module registry across test files and `mock.module` outlives
// the file that made it, so the real module is captured first and put back
// afterwards (see nav-items.test.tsx). The tabs read the route from Next's
// hooks, and there is no app router here to ask.
let pathname = '/templates/abc';
const push = mock((_href: string) => {});
const realNavigation = { ...(await import('next/navigation')) };
mock.module('next/navigation', () => ({
  ...realNavigation,
  usePathname: () => pathname,
  useRouter: () => ({ push, refresh: () => {} }),
}));
afterAll(() => {
  mock.module('next/navigation', () => realNavigation);
});
const { TemplateNavigation } = await import('./template-navigation');

afterEach(cleanup);
beforeEach(() => {
  pathname = '/templates/abc';
  push.mockClear();
});

const tabs = (view: ReturnType<typeof render>) =>
  view.getByRole('navigation', { name: 'Template' }).querySelectorAll('a');

describe('TemplateNavigation', () => {
  it('lists the five sections with the routes the specs and the bookmarks rely on', () => {
    const view = render(<TemplateNavigation id="abc" />);
    expect([...tabs(view)].map((tab) => [tab.textContent, tab.getAttribute('href')])).toEqual([
      ['Edit email', '/templates/abc'],
      ['Variables', '/templates/abc/variables'],
      ['Versions', '/templates/abc/versions'],
      ['Review & release', '/templates/abc/review'],
      ['Connect your app', '/templates/abc/connect'],
    ]);
  });

  it('marks the open section as the current page, and only that one', () => {
    for (const [path, label] of [
      ['/templates/abc', 'Edit email'],
      ['/templates/abc/variables', 'Variables'],
      ['/templates/abc/connect', 'Connect your app'],
    ] as const) {
      pathname = path;
      const view = render(<TemplateNavigation id="abc" />);
      const current = [...tabs(view)].filter((tab) => tab.getAttribute('aria-current') === 'page');
      expect(current.map((tab) => tab.textContent)).toEqual([label]);
      cleanup();
    }
  });

  it('draws the underline under the current tab and nowhere else', () => {
    pathname = '/templates/abc/versions';
    const view = render(<TemplateNavigation id="abc" />);
    const underlined = [...tabs(view)]
      .filter((tab) => tab.querySelector('span[aria-hidden="true"]'))
      .map((tab) => tab.textContent);
    expect(underlined).toEqual(['Versions']);
  });

  it('keeps the underline out of the link name, so a spec finds the tab by its label alone', () => {
    const view = render(<TemplateNavigation id="abc" />);
    expect(view.getByRole('link', { name: 'Edit email', exact: true })).toBeTruthy();
  });

  it('puts the trailing slot beside the tabs rather than inside the navigation landmark', () => {
    const view = render(<TemplateNavigation id="abc" trailing={<button type="button">Beside</button>} />);
    const nav = view.getByRole('navigation', { name: 'Template' });
    expect(view.getByRole('button', { name: 'Beside' })).toBeTruthy();
    expect(nav.contains(view.getByRole('button', { name: 'Beside' }))).toBe(false);
  });

  it('leaves a plain click to the router when nothing has to be saved first', () => {
    const view = render(<TemplateNavigation id="abc" />);
    const proceeded = fireEvent.click(view.getByRole('link', { name: 'Variables' }));
    expect(proceeded).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it('waits for the save before it follows a tab, and stays put when the save refuses', async () => {
    const beforeNavigate = mock(async () => true);
    const view = render(<TemplateNavigation id="abc" beforeNavigate={beforeNavigate} />);
    fireEvent.click(view.getByRole('link', { name: 'Variables' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/templates/abc/variables'));
    expect(beforeNavigate).toHaveBeenCalledTimes(1);

    push.mockClear();
    beforeNavigate.mockImplementation(async () => false);
    fireEvent.click(view.getByRole('link', { name: 'Versions' }));
    await waitFor(() => expect(beforeNavigate).toHaveBeenCalledTimes(2));
    expect(push).not.toHaveBeenCalled();
  });

  it('does not hijack a click that opens the tab elsewhere', () => {
    const beforeNavigate = mock(async () => true);
    const view = render(<TemplateNavigation id="abc" beforeNavigate={beforeNavigate} />);
    const proceeded = fireEvent.click(view.getByRole('link', { name: 'Variables' }), { ctrlKey: true });
    expect(proceeded).toBe(true);
    expect(beforeNavigate).not.toHaveBeenCalled();
  });
});
