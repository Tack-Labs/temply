import { afterAll, afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import '../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';

// Clerk's card and its session state are replaced; what is under test is
// when the page leaves, not what Clerk draws.
let session = { isLoaded: true, isSignedIn: false };
const realClerk = { ...(await import('@clerk/nextjs')) };
const realTheme = { ...(await import('~/components/theme-provider')) };
mock.module('@clerk/nextjs', () => ({
  ...realClerk,
  SignIn: () => <div data-testid="card" />,
  useAuth: () => session,
}));
mock.module('~/components/theme-provider', () => ({ ...realTheme, useTheme: () => ({ clerkAppearance: { elements: {} } }) }));
afterAll(() => {
  mock.module('@clerk/nextjs', () => realClerk);
  mock.module('~/components/theme-provider', () => realTheme);
});

const { SignInCard } = await import('./sign-in-card');
const { SIGNED_IN_HOME } = await import('~/lib/routes');

const STAMP = 'temply:login-bounce';

describe('the sign-in card for someone Clerk already knows', () => {
  let replace: ReturnType<typeof spyOn>;

  beforeEach(() => {
    session = { isLoaded: true, isSignedIn: false };
    sessionStorage.clear();
    replace = spyOn(window.location, 'replace').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    replace.mockRestore();
  });

  it('leaves for the dashboard with a full page load, so the server can renew the session', () => {
    session = { isLoaded: true, isSignedIn: true };
    render(<SignInCard />);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(SIGNED_IN_HOME);
  });

  it('stays for someone who is signed out', () => {
    const { getByTestId } = render(<SignInCard />);
    expect(getByTestId('card')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('waits for Clerk to load before deciding', () => {
    session = { isLoaded: false, isSignedIn: false };
    const { rerender } = render(<SignInCard />);
    expect(replace).not.toHaveBeenCalled();

    session = { isLoaded: true, isSignedIn: true };
    rerender(<SignInCard />);
    expect(replace).toHaveBeenCalledWith(SIGNED_IN_HOME);
  });

  it('leaves someone who signs in on this page to the card', () => {
    const { rerender } = render(<SignInCard />);
    session = { isLoaded: true, isSignedIn: true };
    rerender(<SignInCard />);
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not loop with a server that still refuses the session', () => {
    session = { isLoaded: true, isSignedIn: true };
    sessionStorage.setItem(STAMP, String(Date.now() - 2_000));
    render(<SignInCard />);
    expect(replace).not.toHaveBeenCalled();
  });

  it('tries again once the last attempt is old', () => {
    session = { isLoaded: true, isSignedIn: true };
    sessionStorage.setItem(STAMP, String(Date.now() - 60_000));
    render(<SignInCard />);
    expect(replace).toHaveBeenCalledWith(SIGNED_IN_HOME);
  });

  it('still leaves when the browser will not give it storage', () => {
    session = { isLoaded: true, isSignedIn: true };
    const blocked = spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<SignInCard />);
    blocked.mockRestore();
    expect(replace).toHaveBeenCalledWith(SIGNED_IN_HOME);
  });
});
