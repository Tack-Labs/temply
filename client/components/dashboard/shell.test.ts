import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The shell is the part of the app a signed-in customer sees on every page, so
 * the rules that keep it on the theme tokens and reachable are read straight
 * from its source. Components mount Radix portals and Clerk widgets that the
 * test DOM cannot host; the signed-in spec in e2e/specs/shell.e2e.ts covers
 * their behaviour in a browser.
 */
const dir = dirname(fileURLToPath(import.meta.url));
const source = (name: string) => readFileSync(join(dir, name), 'utf8');

const SHELL = ['sidebar.tsx', 'mobile-nav.tsx', 'nav-items.tsx', 'quota-widget.tsx', 'user-menu.tsx', 'billing-banner.tsx'];

describe('the dashboard shell sources', () => {
  it('stay off the rail palette, which belongs to the marketing rail alone', () => {
    const offenders = readdirSync(dir)
      .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
      .filter((name) => /\brail-/.test(source(name)));
    expect(offenders).toEqual([]);
  });

  it('never ask for faint text, which fails the contrast gate on every surface', () => {
    for (const name of SHELL) expect(source(name), name).not.toContain('text-faint');
  });

  it('leave the focus ring to the global outline instead of drawing their own', () => {
    for (const name of ['sidebar.tsx', 'nav-items.tsx', 'user-menu.tsx', 'mobile-nav.tsx']) {
      expect(source(name), name).not.toMatch(/focus-visible:ring|focus:ring/);
    }
  });
});

describe('the mobile drawer', () => {
  const src = source('mobile-nav.tsx');

  it('keeps the names the signed-in specs open and close it by', () => {
    expect(src).toContain('aria-label="Open navigation"');
    expect(src).toContain('aria-label="Close navigation"');
  });

  it('makes the opener a 44px box on every pointer and pulls it back so its 20px glyph sits on the gutter', () => {
    expect(src).toMatch(/className="-ml-3 size-11 md:hidden \[&_svg\]:size-5"/);
    expect(src).not.toContain('pointer-coarse:-ml-3.5');
  });

  it('is as wide as the sidebar it carries, 248px', () => {
    expect(src).toContain('w-62');
    expect(src).not.toContain('w-64');
  });

  it('makes the close button a touch target', () => {
    expect(src).toMatch(/size="icon-sm"\s+touch/);
  });

  it('moves with the motion tokens rather than numbers of its own', () => {
    expect(src).toContain('overlay-fade');
    expect(src).toContain('drawer-left');
    expect(src).not.toMatch(/duration-\d|cubic-bezier/);
  });
});

describe('the account menu', () => {
  const src = source('user-menu.tsx');

  it('keeps the names the auth spec finds it by', () => {
    expect(src).toMatch(/`Account: \$\{user\?\.fullName \?\? 'User'\}`/);
    expect(src).toContain("'Account'");
    // The auth and shell specs match /sign out/i; sentence case is the repo's.
    expect(src).toContain('Sign out');
    expect(src).not.toContain('Sign Out');
  });

  it('keeps the props its callers pass', () => {
    expect(src).toMatch(/align\??:/);
    expect(src).toMatch(/showLabel\??:/);
  });
});

describe('the sidebar', () => {
  it('is one component for the rail and the drawer, so they cannot drift', () => {
    expect(source('mobile-nav.tsx')).toMatch(/import \{ Sidebar \} from '\.\/sidebar'/);
    expect(source('sidebar.tsx')).toContain('headerAction');
  });
});
