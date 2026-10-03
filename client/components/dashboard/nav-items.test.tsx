import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';

// Bun shares one process, and one module registry, across test files, and
// `mock.module` outlives the file that made it. The real module is captured
// before it is replaced and put back afterwards, or every file that runs later
// would meet the stand-in, and which files those are depends on the run order.
// The links read the route from Next's hook, which has no router to ask here.
let pathname = '/dashboard';
const realNavigation = { ...(await import('next/navigation')) };
mock.module('next/navigation', () => ({ ...realNavigation, usePathname: () => pathname }));
afterAll(() => {
  mock.module('next/navigation', () => realNavigation);
});
const { NavLinks } = await import('./nav-items');

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

const current = (view: ReturnType<typeof render>) =>
  view.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page').map((link) => link.textContent);

describe('NavLinks', () => {
  it('shows Admin only when server authorization allows it', () => {
    pathname = '/dashboard/admin';
    expect(render(<NavLinks />).queryByRole('link', { name: 'Admin' })).toBeNull();
    cleanup();
    const view = render(<NavLinks platformAdmin />);
    expect(view.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/dashboard/admin');
    expect(current(view)).toEqual(['Admin']);
  });
  it('keeps the labels and routes the specs and the muscle memory rely on', () => {
    pathname = '/dashboard';
    const view = render(<NavLinks />);
    expect(view.getByRole('navigation', { name: 'Dashboard' })).toBeTruthy();
    const links = view.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')]);
    expect(links).toEqual([
      ['Overview', '/dashboard'],
      ['Templates', '/dashboard/templates'],
      ['Brands', '/dashboard/brands'],
      ['Assets', '/dashboard/assets'],
      ['Landing', '/'],
      ['Documentation', '/docs'],
    ]);
  });

  it('marks exactly one page as current, and Overview only on its own route', () => {
    pathname = '/dashboard';
    expect(current(render(<NavLinks />))).toEqual(['Overview']);
    cleanup();
    pathname = '/dashboard/templates/abc123';
    expect(current(render(<NavLinks />))).toEqual(['Templates']);
    cleanup();
    pathname = '/dashboard/brands';
    expect(current(render(<NavLinks />))).toEqual(['Brands']);
    cleanup();
    pathname = '/dashboard/settings/plan';
    expect(current(render(<NavLinks />))).toEqual([]);
  });

  it('never marks a link that leaves the dashboard, and opens it in a new tab', () => {
    pathname = '/';
    const view = render(<NavLinks />);
    expect(current(view)).toEqual([]);
    for (const name of ['Landing', 'Documentation']) {
      const link = view.getByRole('link', { name });
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noreferrer');
    }
    expect(view.getByRole('link', { name: 'Templates' }).getAttribute('target')).toBeNull();
  });

  it('paints the current page accent and the rest muted, on the theme tokens', () => {
    pathname = '/dashboard/assets';
    const view = render(<NavLinks />);
    const active = view.getByRole('link', { name: 'Assets' });
    expect(active.className).toContain('bg-accent-wash');
    expect(active.className).toContain('text-accent-ink');
    const idle = view.getByRole('link', { name: 'Brands' });
    expect(idle.className).toContain('text-muted');
    expect(idle.className).toContain('hover:bg-hover');
    expect(idle.className).toContain('hover:text-ink');
    expect(idle.className).not.toContain('bg-accent-wash');
    expect(view.container.innerHTML).not.toContain('rail-');
  });

  it('gives every link the shared focus outline and a 44px target on a coarse pointer', () => {
    pathname = '/dashboard';
    const view = render(<NavLinks />);
    for (const link of view.getAllByRole('link')) {
      expect(link.className).toContain('focus-visible:outline-accent-ink');
      expect(link.className).not.toContain('focus-visible:ring');
      expect(link.className).toContain('pointer-coarse:h-11');
      expect(link.className).toContain('motion-reduce:transition-none');
    }
  });

  it('tells the caller a link was followed, so a drawer can close', () => {
    pathname = '/dashboard';
    let followed = 0;
    const view = render(<NavLinks onNavigate={() => followed++} />);
    view.getByRole('link', { name: 'Brands' }).click();
    expect(followed).toBe(1);
  });
});
