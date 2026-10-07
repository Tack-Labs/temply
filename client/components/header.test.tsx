import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../core/editor/test/dom';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { container } from '~/components/marketing/container';

// Bun shares one module registry across test files and `mock.module` outlives
// the file that made it, so each real module is captured before it is replaced
// and put back afterwards. The route is Next's to say and there is no router
// here; the signed-in menu is a dynamic import that would bring Clerk along,
// and what is under test is which controls the bar chooses, not what Clerk draws.
let pathname = '/';
const realNavigation = { ...(await import('next/navigation')) };
const realDynamic = { ...(await import('next/dynamic')) };
mock.module('next/navigation', () => ({ ...realNavigation, usePathname: () => pathname }));
mock.module('next/dynamic', () => ({ ...realDynamic, default: () => () => <div data-testid="user-menu" /> }));
afterAll(() => {
  mock.module('next/navigation', () => realNavigation);
  mock.module('next/dynamic', () => realDynamic);
});

const { ThemeProvider } = await import('~/components/theme-provider');
const { Header } = await import('./header');
const { SIGNED_IN_HOME } = await import('~/lib/routes');

const mount = () =>
  render(
    <ThemeProvider>
      <Header />
    </ThemeProvider>,
  );

const SECTIONS = ['Features', 'Blocks', 'Pricing', 'Contact'];

/** Clerk's own hint that a session exists, which is all the header reads. */
function setSignedInHint(value: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: the header reads this cookie by hand, so the case has to write it by hand
  document.cookie = `__client_uat=${value}`;
}

beforeEach(() => {
  pathname = '/';
});
afterEach(() => {
  cleanup();
  setSignedInHint('; expires=Thu, 01 Jan 1970 00:00:00 GMT');
});

describe('the marketing header', () => {
  it('is the 72px bar the page offsets are measured from, on the shared column', () => {
    const view = mount();
    const bar = view.container.querySelector('header') as HTMLElement;
    expect(bar.className).toContain('h-(--header-h)');
    // The inner row is the shared column, so the bar's edges are the page's.
    const row = bar.firstElementChild as HTMLElement;
    for (const token of container.split(' ')) expect(row.className.split(/\s+/)).toContain(token);
  });

  it('offers exactly four sections, in the bar and again in the menu a phone opens', () => {
    const view = mount();
    const navs = view.getAllByRole('navigation', { name: 'Page sections' });
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      const links = Array.from(nav.querySelectorAll('a'));
      expect(links.map((link) => link.textContent)).toEqual(SECTIONS);
      expect(links.map((link) => link.getAttribute('href'))).toEqual(['#features', '#blocks', '#pricing', '#contact']);
    }
  });

  it('routes each section home from a page that is not the landing page', () => {
    pathname = '/terms';
    const view = mount();
    const [bar] = view.getAllByRole('navigation', { name: 'Page sections' });
    expect(Array.from(bar.querySelectorAll('a')).map((link) => link.getAttribute('href'))).toEqual([
      '/#features',
      '/#blocks',
      '/#pricing',
      '/#contact',
    ]);
  });

  it('names the menu button Menu, open or closed, and leaves which to aria-expanded', () => {
    const view = mount();
    const button = view.getByRole('button', { name: 'Menu' });
    expect(button.getAttribute('aria-controls')).toBe('site-menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    // An action's name would be wrong the moment the panel was open.
    expect(view.queryByRole('button', { name: 'Open menu' })).toBeNull();

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(view.getByRole('button', { name: 'Menu' })).toBe(button);

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the theme toggle, a quiet Sign in and a Start free trial pill for someone with no account', () => {
    const view = mount();
    expect(view.getByRole('button', { name: 'Dark theme' })).toBeTruthy();

    const signIn = view.getByRole('link', { name: 'Sign in' });
    expect(signIn.getAttribute('href')).toBe('/login');
    // Quiet: ink on no fill, so the pill beside it is the one thing to press.
    expect(signIn.className).not.toContain('bg-accent');

    const trial = view.getByRole('link', { name: 'Start free trial' });
    expect(trial.getAttribute('href')).toBe('/sign-up');
    expect(trial.className).toContain('bg-accent');
    // No glow: it would spill past a 72px bar.
    expect(trial.className).not.toContain('shadow-cta');
    // Below sm there is no room for it beside the wordmark, the toggle, Sign in
    // and the menu button at 320px; from sm it is in the bar.
    const classes = trial.className.split(/\s+/);
    expect(classes).toContain('hidden');
    expect(classes).toContain('sm:inline-flex');
  });

  it('puts Dashboard in the primary place, with the account menu, for someone signed in', () => {
    setSignedInHint('1');
    const view = mount();
    const dashboard = view.getByRole('link', { name: 'Dashboard' });
    // A plain anchor: a Link's fetch would be read as signed out.
    expect(dashboard.getAttribute('href')).toBe(SIGNED_IN_HOME);
    expect(dashboard.className).toContain('bg-accent');
    expect(view.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(view.queryByRole('link', { name: 'Start free trial' })).toBeNull();
    expect(view.getByTestId('user-menu')).toBeTruthy();
  });

  it('holds the buttons to the room a signed-out visitor needs, so the sections stay put when Dashboard takes its place', () => {
    // The group is what the toggle's wrapper sits in: the toggle, then the pair
    // the cookie chose, then the menu button. The cell it shares with an unseen
    // copy of the signed-out group is as wide as the wider of the two, which is
    // the browser's measure in whatever face it has, not a width written down.
    const cell = (hint?: string) => {
      if (hint) setSignedInHint(hint);
      const view = mount();
      const group = view.getByRole('button', { name: 'Dark theme' }).parentElement?.parentElement as HTMLElement;
      const twin = group.parentElement?.querySelector('[inert]') as HTMLElement;
      const seen = {
        grid: group.parentElement?.className.split(/\s+/),
        group: group.className.split(/\s+/),
        twin: twin.className.split(/\s+/),
        twinAriaHidden: twin.getAttribute('aria-hidden'),
        twinLinks: twin.querySelectorAll('a').length,
        twinText: twin.textContent,
      };
      cleanup();
      return seen;
    };
    const signedOut = cell();
    const signedIn = cell('1730000000');
    // Right-aligned, so the extra room opens up beside the sections and not
    // between the buttons, and both share the one cell.
    expect(signedOut.grid).toEqual(expect.arrayContaining(['grid', 'justify-items-end']));
    expect(signedOut.group).toEqual(expect.arrayContaining(['col-start-1', 'row-start-1', 'justify-end']));
    expect(signedOut.twin).toEqual(expect.arrayContaining(['col-start-1', 'row-start-1', 'invisible', 'hidden', 'sm:flex']));
    // Not a second Sign in to anything that reads the page, and not a link
    // for Next to prefetch.
    expect(signedOut.twinAriaHidden).toBe('true');
    expect(signedOut.twinLinks).toBe(0);
    expect(signedOut.twinText).toBe('Sign inStart free trial');
    expect(signedIn).toEqual({ ...signedOut, group: signedIn.group });
  });

  it('is hidden below sm on the playground, whose own phone bar takes the edge', () => {
    pathname = '/playground';
    const view = mount();
    const bar = view.container.querySelector('header') as HTMLElement;
    expect(bar.className.split(/\s+/)).toEqual(expect.arrayContaining(['hidden', 'sm:block']));
  });
});
