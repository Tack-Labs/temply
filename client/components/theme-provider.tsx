'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PALETTE } from '~/lib/clerk-palette';

export type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (next: Theme) => void;
  toggle: () => void;
  /** Feed straight into a Clerk component's `appearance` prop. */
  clerkAppearance: Record<string, unknown>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Clerk paints link-like text from colorPrimary and error text from
// colorDanger. Those are the concrete hexes in lib/clerk-palette.ts, and they
// are fixed hues: the blue measures 3.35:1 on the dark card and the red 2.95:1,
// under the 4.5:1 text needs. The -ink tokens are the same hues tuned per
// theme, and a var() reads the live `.dark` class, so one object serves both.
// The hover goes to ink rather than Clerk's own darker shade of the primary,
// which on the dark card is darker still. These are style objects, not
// classes, because Clerk's stylesheet outranks a utility class on its element.
const LINK_TEXT = { color: 'var(--ds-accent-ink)', '&:hover': { color: 'var(--ds-ink)' } };
const ERROR_TEXT = { color: 'var(--ds-danger-ink)' };

function applyTheme(next: Theme) {
  document.documentElement.classList.toggle('dark', next === 'dark');
  try {
    localStorage.setItem('theme', next);
  } catch {
    // Private browsing and similar — the class is already applied, which is
    // what matters for this page view.
  }
}

function preferredTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // Private browsing — fall through to the OS preference.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  // Re-assert the class rather than reading it back. The blocking script in
  // app/layout.tsx sets it before paint, but React owns <html> and clears its
  // className during hydration, so by the time this runs the class is gone —
  // and reading it would conclude "light" for someone who chose dark.
  useEffect(() => {
    const next = preferredTheme();
    document.documentElement.classList.toggle('dark', next === 'dark');
    setThemeState(next);
  }, []);

  // Follow the OS while the user has not expressed a preference of their own.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem('theme');
      } catch {
        stored = null;
      }
      if (stored) return;
      const next: Theme = event.matches ? 'dark' : 'light';
      document.documentElement.classList.toggle('dark', next === 'dark');
      setThemeState(next);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const p = PALETTE[theme];
    return {
      theme,
      setTheme,
      toggle,
      clerkAppearance: {
        variables: {
          colorPrimary: p.accent,
          colorBackground: p.raised,
          colorText: p.ink,
          colorTextSecondary: p.muted,
          colorInputBackground: p.raised,
          colorInputText: p.ink,
          colorDanger: p.danger,
          // Clerk derives its smaller radii from this one: a field lands near
          // `rounded-md`, a card a step above, which is as close as one knob
          // gets to the app's own ladder.
          borderRadius: '10px',
          fontFamily: 'var(--font-figtree)',
        },
        elements: {
          card: 'shadow-none border border-line',
          footer: 'hidden',
          formFieldAction: LINK_TEXT,
          formResendCodeLink: LINK_TEXT,
          footerActionLink: LINK_TEXT,
          headerBackLink: LINK_TEXT,
          backLink: LINK_TEXT,
          identityPreviewEditButton: LINK_TEXT,
          profileSectionPrimaryButton: LINK_TEXT,
          formFieldErrorText: ERROR_TEXT,
          otpCodeFieldErrorText: ERROR_TEXT,
          alertText__danger: ERROR_TEXT,
        },
      },
    };
  }, [theme, setTheme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
