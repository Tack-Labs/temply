import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';

// Clerk's account and organization are replaced; what is under test is what
// the trigger draws and what it is called. The menu itself opens into a Radix
// portal the test DOM does not host, so the browser spec covers it.
type Account = {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: { fullName: string | null; firstName: string | null; emailAddresses: { emailAddress: string }[] } | null;
};
const SAM: Account = {
  isLoaded: true,
  isSignedIn: true,
  user: { fullName: 'Sam Rivers', firstName: 'Sam', emailAddresses: [{ emailAddress: 'sam@northwind.test' }] },
};
let account: Account = SAM;
let organization: { name: string } | null = { name: 'Northwind' };

const realClerk = { ...(await import('@clerk/nextjs')) };
mock.module('@clerk/nextjs', () => ({
  ...realClerk,
  useUser: () => account,
  useOrganization: () => ({ organization }),
  useClerk: () => ({ signOut: () => {} }),
}));
afterAll(() => {
  mock.module('@clerk/nextjs', () => realClerk);
});
const { UserMenu } = await import('./user-menu');

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(() => {
  cleanup();
  account = SAM;
  organization = { name: 'Northwind' };
});

describe('UserMenu as the sidebar user block', () => {
  it('is named for the account and the person, and not for the second line', () => {
    const view = render(<UserMenu align="start" />);
    const trigger = view.getByRole('button', { name: 'Account: Sam Rivers' });
    expect(trigger.getAttribute('aria-label')).toBe('Account: Sam Rivers');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('shows a 40px peach avatar with the initial, the name at 15px and the workspace at 14px muted', () => {
    const view = render(<UserMenu align="start" />);
    const avatar = view.getByText('S');
    for (const needed of ['size-10', 'rounded-full', 'bg-peach-wash', 'text-peach-ink', 'font-bold']) {
      expect(avatar.className).toContain(needed);
    }
    const name = view.getByText('Sam Rivers');
    for (const needed of ['text-ui', 'font-bold', 'truncate']) expect(name.className).toContain(needed);
    const org = view.getByText('Northwind');
    for (const needed of ['text-base', 'text-muted', 'truncate']) expect(org.className).toContain(needed);
    expect(view.container.innerHTML).not.toContain('bg-accent ');
    expect(view.container.innerHTML).not.toContain('text-white');
  });

  it('falls back to the address when no workspace is active', () => {
    organization = null;
    const view = render(<UserMenu align="start" />);
    expect(view.getByText('sam@northwind.test').className).toContain('text-muted');
    expect(view.queryByText('Northwind')).toBeNull();
  });

  it('takes its initial from the address, then a U, when there is no first name', () => {
    account = { ...SAM, user: { fullName: null, firstName: null, emailAddresses: [{ emailAddress: 'zed@x.test' }] } };
    expect(render(<UserMenu />).getByText('Z')).toBeTruthy();
    cleanup();
    account = { ...SAM, user: { fullName: null, firstName: null, emailAddresses: [] } };
    const view = render(<UserMenu />);
    expect(view.getByText('U')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Account: User' })).toBeTruthy();
  });

  it('is a 44px-tall block on the field radius, with the global focus outline and a settle for reduced motion', () => {
    const trigger = render(<UserMenu align="start" />).getByRole('button', { name: /^Account/ });
    for (const needed of [
      'w-full',
      'rounded-field',
      'hover:bg-hover',
      'pointer-coarse:min-h-11',
      'focus-visible:outline-focus',
      'motion-reduce:transition-none',
    ]) {
      expect(trigger.className).toContain(needed);
    }
  });

  it('holds the block\'s place with placeholders while Clerk answers, hidden from assistive tech', () => {
    account = { isLoaded: false, isSignedIn: false, user: null };
    const view = render(<UserMenu align="start" />);
    expect(view.queryByRole('button')).toBeNull();
    const blocks = Array.from(view.container.querySelectorAll('.animate-pulse'));
    expect(blocks).toHaveLength(3);
    for (const block of blocks) expect(block.getAttribute('aria-hidden')).toBe('true');
    expect(view.container.querySelector('.size-10.rounded-full')).toBeTruthy();
  });

  it('draws nothing for someone who is not signed in', () => {
    account = { isLoaded: true, isSignedIn: false, user: null };
    expect(render(<UserMenu align="start" />).container.innerHTML).toBe('');
  });
});

describe('UserMenu as an icon button', () => {
  it('is named just Account, with the same peach avatar at 28px and no text beside it', () => {
    const view = render(<UserMenu align="end" showLabel={false} />);
    const trigger = view.getByRole('button', { name: 'Account', exact: true });
    expect(trigger.getAttribute('aria-label')).toBe('Account');
    const avatar = view.getByText('S');
    for (const needed of ['size-7', 'bg-peach-wash', 'text-peach-ink']) expect(avatar.className).toContain(needed);
    expect(view.queryByText('Sam Rivers')).toBeNull();
    expect(view.queryByText('Northwind')).toBeNull();
    expect(trigger.className).toContain('pointer-coarse:min-w-11');
  });

  it('draws nothing while Clerk answers, as it always has: its header has room to wait', () => {
    account = { isLoaded: false, isSignedIn: false, user: null };
    expect(render(<UserMenu showLabel={false} />).container.innerHTML).toBe('');
  });
});
