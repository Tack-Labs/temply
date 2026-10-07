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
const { NavLinks, SettingsLink } = await import('./nav-items');

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
      ['Connect your app', '/dashboard/connect'],
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

  it('paints the current page as a lavender pill and the rest muted, on the theme tokens', () => {
    pathname = '/dashboard/assets';
    const view = render(<NavLinks />);
    const active = view.getByRole('link', { name: 'Assets' });
    for (const needed of ['bg-accent-wash', 'text-accent-ink', 'font-bold']) expect(active.className).toContain(needed);
    expect(active.className).not.toContain('text-muted');
    expect(active.className).not.toContain('hover:bg-hover');
    const idle = view.getByRole('link', { name: 'Brands' });
    for (const needed of ['text-muted', 'font-semibold', 'hover:bg-hover', 'hover:text-ink']) {
      expect(idle.className).toContain(needed);
    }
    expect(idle.className).not.toContain('bg-accent-wash');
    expect(idle.className).not.toContain('font-bold');
    expect(view.container.innerHTML).not.toContain('rail-');
  });

  it('draws every row 44px tall on the field radius at 15px, whatever the pointer', () => {
    pathname = '/dashboard';
    const view = render(<NavLinks platformAdmin />);
    for (const link of view.getAllByRole('link')) {
      for (const needed of ['h-11', 'rounded-field', 'text-ui', 'px-3.5', 'gap-3']) {
        expect(link.className, link.textContent ?? '').toContain(needed);
      }
      // 44px is the row, not a step a coarse pointer adds on top of 36px.
      expect(link.className).not.toContain('pointer-coarse:h-11');
      expect(link.className).not.toMatch(/\bh-9\b/);
    }
  });

  it('sets a 20px icon in each row and hides it from assistive tech, so the name is the label alone', () => {
    pathname = '/dashboard';
    const view = render(<NavLinks />);
    for (const link of view.getAllByRole('link')) {
      const icons = Array.from(link.querySelectorAll('svg'));
      expect(icons.length).toBeGreaterThan(0);
      for (const icon of icons) expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icons[0]?.getAttribute('class')).toContain('size-5');
    }
  });

  it('labels the sections in sentence case, quietly, and leaves the first unlabelled', () => {
    pathname = '/dashboard';
    const view = render(<NavLinks platformAdmin />);
    for (const label of ['Resources', 'Temply']) {
      const heading = view.getByText(label, { selector: 'div' });
      expect(heading.className).toContain('text-muted');
      expect(heading.className).not.toContain('uppercase');
    }
  });

  it('gives every link the shared focus outline and the press treatment, without motion for a reduced-motion reader', () => {
    pathname = '/dashboard';
    const view = render(<NavLinks />);
    for (const link of view.getAllByRole('link')) {
      expect(link.className).toContain('focus-visible:outline-focus');
      expect(link.className).not.toContain('focus-visible:ring');
      expect(link.className).toContain('duration-fast');
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

describe('SettingsLink', () => {
  it('is the same row as the nav, pointing at Settings', () => {
    pathname = '/dashboard';
    const link = render(<SettingsLink />).getByRole('link', { name: 'Settings' });
    expect(link.getAttribute('href')).toBe('/dashboard/settings');
    for (const needed of ['h-11', 'rounded-field', 'text-ui', 'text-muted', 'font-semibold']) {
      expect(link.className).toContain(needed);
    }
    expect(link.getAttribute('aria-current')).toBeNull();
  });

  it('is current on the section root and on every page beneath it, and on nothing that merely starts alike', () => {
    for (const [route, current] of [
      ['/dashboard/settings', true],
      ['/dashboard/settings/plan', true],
      ['/dashboard/settings/team/members', true],
      ['/dashboard', false],
      ['/dashboard/settingsish', false],
    ] as const) {
      pathname = route;
      const link = render(<SettingsLink />).getByRole('link', { name: 'Settings' });
      expect(link.getAttribute('aria-current'), route).toBe(current ? 'page' : null);
      if (current) expect(link.className).toContain('bg-accent-wash');
      cleanup();
    }
  });

  it('tells the caller it was followed, so a drawer can close', () => {
    pathname = '/dashboard';
    let followed = 0;
    render(<SettingsLink onNavigate={() => followed++} />).getByRole('link', { name: 'Settings' }).click();
    expect(followed).toBe(1);
  });
});
