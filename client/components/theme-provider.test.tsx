import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { PALETTE } from '~/lib/clerk-palette';
import { ThemeProvider, useTheme } from './theme-provider';

type Style = { color?: string; '&:hover'?: { color?: string } };
type Appearance = {
  variables: Record<string, string>;
  elements: Record<string, string | Style>;
};

// Rendered to a string rather than mounted: the provider's first render needs
// no DOM, and mounting it would mean registering one, which is process-wide
// and would be in place for every test file that runs after this one. Its
// effects, which do need one, settle the theme after mount and are not what
// is read here.
function appearance(): Appearance {
  let captured: Appearance | undefined;
  function Probe() {
    captured = useTheme().clerkAppearance as Appearance;
    return null;
  }
  renderToStaticMarkup(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  if (!captured) throw new Error('ThemeProvider rendered no appearance');
  return captured;
}

// Link-like text and error text are the two kinds Clerk would otherwise paint
// from colorPrimary and colorDanger, which fall under 4.5:1 on the dark card.
const LINKS = [
  'formFieldAction',
  'formResendCodeLink',
  'footerActionLink',
  'headerBackLink',
  'backLink',
  'identityPreviewEditButton',
  'profileSectionPrimaryButton',
];
const ERRORS = ['formFieldErrorText', 'otpCodeFieldErrorText', 'alertText__danger'];

describe('the appearance handed to Clerk', () => {
  it('keeps the primary on the palette, because every fill and focus ring Clerk draws reads it', () => {
    const { variables } = appearance();
    expect(variables.colorPrimary).toBe(PALETTE.light.accent);
    expect(variables.colorDanger).toBe(PALETTE.light.danger);
  });

  it('draws link-like text in accent-ink, and moves it to ink under the pointer', () => {
    const { elements } = appearance();
    for (const key of LINKS) {
      const style = elements[key] as Style;
      expect(style.color, key).toBe('var(--ds-accent-ink)');
      expect(style['&:hover']?.color, `${key} hover`).toBe('var(--ds-ink)');
    }
  });

  it('draws error text in danger-ink', () => {
    const { elements } = appearance();
    for (const key of ERRORS) expect((elements[key] as Style).color, key).toBe('var(--ds-danger-ink)');
  });

  it('keeps what it already set on the card and the footer', () => {
    const { elements } = appearance();
    expect(elements.card).toBe('shadow-none border border-line');
    expect(elements.footer).toBe('hidden');
  });

  it('names only tokens that exist in both themes', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'globals.css'), 'utf8');
    const { elements } = appearance();
    const named = new Set(JSON.stringify(elements).match(/--ds-[a-z-]+/g));
    expect([...named].sort()).toEqual(['--ds-accent-ink', '--ds-danger-ink', '--ds-ink']);
    // A token declared once in :root and redeclared under .dark is what lets
    // a var() follow the theme class, so it has to be declared in both.
    const declared = (token: string) => new RegExp(`^\\s*${token}\\s*:`, 'gm');
    for (const token of named) expect(css.match(declared(token))?.length, token).toBe(2);
  });
});
