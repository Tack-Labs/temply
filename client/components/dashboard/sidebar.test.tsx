import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';

// Bun shares one module registry across test files, so each stand-in is put
// back once this file is done; see nav-items.test.tsx. Clerk's switcher and
// account, the quota's request and the theme are replaced, because what is
// under test is how the column is put together, not what they draw.
let pathname = '/dashboard/templates';
const realNavigation = { ...(await import('next/navigation')) };
const realClerk = { ...(await import('@clerk/nextjs')) };
const realTheme = { ...(await import('~/components/theme-provider')) };
const realQuota = { ...(await import('./quota-widget')) };
mock.module('next/navigation', () => ({ ...realNavigation, usePathname: () => pathname }));
mock.module('@clerk/nextjs', () => ({
  ...realClerk,
  OrganizationSwitcher: () => <div data-testid="switcher" />,
  useUser: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: { fullName: 'Sam Rivers', firstName: 'Sam', emailAddresses: [{ emailAddress: 'sam@northwind.test' }] },
  }),
  useOrganization: () => ({ organization: { name: 'Northwind' } }),
  useClerk: () => ({ signOut: () => {} }),
}));
mock.module('~/components/theme-provider', () => ({
  ...realTheme,
  useTheme: () => ({ theme: 'light', setTheme: () => {}, toggle: () => {}, clerkAppearance: { elements: {} } }),
}));
mock.module('./quota-widget', () => ({ ...realQuota, QuotaWidget: () => <div data-testid="quota" /> }));
afterAll(() => {
  mock.module('next/navigation', () => realNavigation);
  mock.module('@clerk/nextjs', () => realClerk);
  mock.module('~/components/theme-provider', () => realTheme);
  mock.module('./quota-widget', () => realQuota);
});
const { Sidebar } = await import('./sidebar');

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

describe('Sidebar', () => {
  it('is the Workspace landmark: white, with a 1.5px line on its right, padded 24px by 16px', () => {
    const aside = render(<Sidebar />).getByRole('complementary', { name: 'Workspace' });
    for (const needed of ['bg-raised', 'border-r-[1.5px]', 'border-line', 'px-4', 'py-6', 'gap-7', 'flex-col']) {
      expect(aside.className).toContain(needed);
    }
    expect(aside.className).not.toContain('bg-surface');
  });

  it('puts the brand, the workspace switcher, the nav and the foot in that order', () => {
    const view = render(<Sidebar />);
    const order = [
      view.getByRole('link', { name: 'Temply' }),
      view.getByTestId('switcher'),
      view.getByRole('navigation', { name: 'Dashboard' }),
      view.getByTestId('quota'),
      view.getByRole('link', { name: 'Settings' }),
      view.getByRole('button', { name: 'Dark theme' }),
      view.getByRole('button', { name: /^Account/ }),
    ];
    for (let i = 1; i < order.length; i++) {
      const before = order[i - 1] as HTMLElement;
      const after = order[i] as HTMLElement;
      expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING, `${i}`).toBeTruthy();
    }
  });

  it('draws the brand as the 30px lockup, 14px in from the column on the nav icons\' line, in a 44px row', () => {
    const brand = render(<Sidebar />).getByRole('link', { name: 'Temply' });
    expect(brand.getAttribute('href')).toBe('/dashboard');
    for (const needed of ['h-11', 'px-3.5', 'items-center']) expect(brand.className).toContain(needed);
    // The wordmark is the pack's image, not text in a face of the app's.
    expect(brand.className).not.toContain('font-display');
    expect(brand.textContent).toBe('');
    const [light, dark] = [...brand.querySelectorAll('img')];
    expect([light?.getAttribute('src'), dark?.getAttribute('src')]).toEqual([
      '/brand/temply-logo-horizontal.svg',
      '/brand/temply-logo-horizontal-on-dark.svg',
    ]);
    for (const image of [light, dark]) expect(image?.className).toContain('h-7.5');
    expect(brand.querySelector('svg')).toBeNull();
  });

  it('keeps Settings and the theme toggle out of the Dashboard nav and out of each other', () => {
    const view = render(<Sidebar />);
    const nav = view.getByRole('navigation', { name: 'Dashboard' });
    const settings = view.getByRole('link', { name: 'Settings' });
    const toggle = view.getByRole('button', { name: 'Dark theme' });
    expect(nav.contains(settings)).toBe(false);
    expect(settings.contains(toggle)).toBe(false);
    expect(settings.getAttribute('href')).toBe('/dashboard/settings');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('lights Settings, and only Settings, on a settings page', () => {
    pathname = '/dashboard/settings/plan';
    const view = render(<Sidebar />);
    const current = view.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Settings']);
    pathname = '/dashboard/templates';
  });

  it('puts the user block under a 1.5px line at the very bottom', () => {
    const view = render(<Sidebar />);
    const block = view.getByRole('button', { name: /^Account/ }).parentElement as HTMLElement;
    for (const needed of ['border-t-[1.5px]', 'border-line', 'pt-4']) expect(block.className).toContain(needed);
    const foot = block.parentElement as HTMLElement;
    expect(foot.lastElementChild).toBe(block);
    expect(foot.className).toContain('shrink-0');
  });

  it('scrolls the nav on its own, with room around it for the focus outline, and the column when it is very short', () => {
    const view = render(<Sidebar />);
    const scroller = view.getByRole('navigation', { name: 'Dashboard' }).parentElement as HTMLElement;
    for (const needed of ['overflow-y-auto', 'flex-1', 'min-h-40', 'px-2', 'py-1.5', '-mx-2', '-my-1.5']) {
      expect(scroller.className).toContain(needed);
    }
    expect(view.getByRole('complementary').className).toContain('overflow-y-auto');
  });

  it('hands the drawer its close button beside the brand, and tells it when a link is followed', () => {
    let followed = 0;
    const view = render(
      <Sidebar onNavigate={() => followed++} headerAction={<button type="button">Close navigation</button>} />,
    );
    const close = view.getByRole('button', { name: 'Close navigation' });
    expect(close.parentElement).toBe(view.getByRole('link', { name: 'Temply' }).parentElement);
    view.getByRole('link', { name: 'Temply' }).click();
    view.getByRole('link', { name: 'Settings' }).click();
    view.getByRole('link', { name: 'Brands' }).click();
    expect(followed).toBe(3);
  });

  it('shows Admin only to a platform admin', () => {
    expect(render(<Sidebar />).queryByRole('link', { name: 'Admin' })).toBeNull();
    cleanup();
    expect(render(<Sidebar platformAdmin />).getByRole('link', { name: 'Admin' })).toBeTruthy();
  });

  it('is on the theme tokens: no rail palette, no faint text, no literal colour', () => {
    const html = render(<Sidebar platformAdmin />).container.innerHTML;
    expect(html).not.toContain('rail-');
    expect(html).not.toContain('text-faint');
    expect(html).not.toMatch(/\b(?:bg|text)-(?:white|black)\b|#[0-9a-f]{3,8}\b/i);
  });
});
