import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * check:contrast reads the dark theme as :root with `.dark` laid over it, so a
 * token that `.dark` forgets to declare is silently measured with its light
 * value and passes. These are the tokens that do not follow the theme by
 * accident: each needs its own `.dark` line and its utility name in
 * `@theme inline`, and the script's pairs need to find it by name.
 */
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'globals.css'), 'utf8');

function block(selector: string): string {
  const opener = new RegExp(`^${selector.replace(/[.@]/g, '\\$&')}[^{]*\\{`, 'm').exec(css);
  if (!opener) throw new Error(`No "${selector}" block in globals.css`);
  const open = opener.index + opener[0].length - 1;
  return css.slice(open + 1, css.indexOf('\n}', open));
}

const light = block(':root');
const dark = block('.dark');
const theme = block('@theme inline');

const declares = (body: string, token: string) => new RegExp(`--ds-${token}\\s*:\\s*#[0-9a-fA-F]{6}`).test(body);

/** Redeclared in .dark: the redesign's added neutrals, status fills and edges. */
const THEMED = ['ink-soft', 'track', 'disabled', 'focus', 'success', 'peach', 'accent-edge'];

/** Declared once in :root because they depict a canvas, which does not follow the theme. */
const FIXED = ['canvas-accent-ink', 'canvas-accent-wash', 'canvas-accent-bar', 'canvas-dark-accent'];

describe('the redesign tokens exist in both themes', () => {
  for (const token of THEMED) {
    it(`--ds-${token} is declared in :root and in .dark, and reachable as a utility`, () => {
      expect(declares(light, token), `:root has no --ds-${token}`).toBe(true);
      expect(declares(dark, token), `.dark has no --ds-${token}, so it would inherit the light value`).toBe(true);
      expect(theme.includes(`--color-${token}: var(--ds-${token});`), `@theme inline has no --color-${token}`).toBe(true);
    });
  }

  for (const token of FIXED) {
    it(`--ds-${token} is declared in :root, left out of .dark on purpose, and reachable as a utility`, () => {
      expect(declares(light, token), `:root has no --ds-${token}`).toBe(true);
      expect(declares(dark, token), `.dark redeclares --ds-${token}; a canvas colour does not follow the theme`).toBe(false);
      expect(theme.includes(`--color-${token}: var(--ds-${token});`), `@theme inline has no --color-${token}`).toBe(true);
    });
  }

  it('declares the type scale steps the pixel-named utilities read', () => {
    for (const step of ['18', '26', '34', '38', '48', '68']) {
      expect(new RegExp(`--text-${step}:\\s*[\\d.]+rem;`).test(css), `--text-${step}`).toBe(true);
      expect(new RegExp(`--text-${step}--line-height:\\s*[\\d.]+rem;`).test(css), `--text-${step}--line-height`).toBe(true);
    }
  });

  it('points the focus ring at the focus token, with one width at rest and on focus', () => {
    expect(/outline:\s*2px solid var\(--ds-accent-ink\)/.test(css), 'a 2px accent-ink ring is the retired treatment').toBe(false);
  });
});

/**
 * The declaration block of the rule whose selector list is exactly
 * `selectors`, in that order. The list has to start the rule, after a brace, a
 * semicolon, a comment or the top of the file: `:focus-visible {` also ends
 * `textarea:focus-visible {`, so a pattern for the global ring that is not
 * anchored is satisfied by the field rule and keeps passing after the global
 * one is gone. When a selector list repeats (inside a media query, say) this
 * is the first of them.
 */
function ruleIn(source: string, ...selectors: string[]): string {
  const list = selectors.map((selector) => selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(',\\s*');
  const match = new RegExp(`(?<=(?:^|[{};]|\\*/)\\s*)${list}\\s*\\{([^}]*)\\}`).exec(source);
  if (!match) throw new Error(`No rule for "${selectors.join(', ')}" in the stylesheet`);
  return match[1].replace(/\s+/g, ' ').trim();
}

const rule = (...selectors: string[]) => ruleIn(css, ...selectors);

const FIELD = ["input:not([type='range'])", 'textarea', 'select'];
const FIELD_FOCUS = ["input:not([type='range']):focus-visible", 'textarea:focus-visible', 'select:focus-visible'];
const RESTING = ['a', 'button', 'summary', "[tabindex]:not([tabindex='-1'])"];
const FADE = 'outline-color var(--ds-motion-fast) var(--ds-ease-out)';

describe('every focus ring is the same ring, and fades in', () => {
  it('draws the global ring on :focus-visible in the focus token, 2px off the control', () => {
    const ring = rule(':focus-visible');
    expect(ring).toContain('outline: 3px solid var(--ds-focus);');
    expect(ring).toContain('outline-offset: 2px;');
  });

  it('rests links, buttons and tabbable elements at a transparent ring of the same width, and fades its colour', () => {
    const resting = rule(...RESTING);
    expect(resting, 'outline-style cannot animate, so the ring must already be solid at rest').toContain('outline: 3px solid transparent;');
    expect(resting).toContain('outline-offset: 2px;');
    expect(resting).toContain(`transition: ${FADE};`);
  });

  it('rests text fields at the same transparent ring, so the field ring fades rather than switching on', () => {
    const resting = rule(...FIELD);
    expect(resting, 'a field that rests with no outline has nothing for the fade to start from').toContain('outline: 3px solid transparent;');
    expect(resting).toContain('outline-offset: 2px;');
  });

  it('lists outline-color in the field transition, beside the border and shadow it already eases', () => {
    const resting = rule(...FIELD);
    expect(resting).toContain(FADE);
    expect(resting).toContain('border-color var(--ds-motion-fast) var(--ds-ease-out)');
    expect(resting).toContain('box-shadow var(--ds-motion-fast) var(--ds-ease-out)');
  });

  it('draws the field ring in the same focus token and width as the global one', () => {
    const ring = rule(...FIELD_FOCUS);
    expect(ring).toContain('outline: 3px solid var(--ds-focus);');
    expect(ring).toContain('outline-offset: 2px;');
    expect(ring).toContain('border-color: var(--ds-accent);');
  });

  it('reads one rule at a time, so the field rule cannot stand in for the global ring', () => {
    const fieldOnly = `textarea:focus-visible {\n  outline: 3px solid var(--ds-focus);\n  outline-offset: 2px;\n}`;
    expect(() => ruleIn(fieldOnly, ':focus-visible')).toThrow('No rule for ":focus-visible"');
    expect(ruleIn(fieldOnly, 'textarea:focus-visible')).toContain('outline: 3px solid var(--ds-focus);');
    // The global rule survives alongside the field's, and each is read on its own.
    const both = `  :focus-visible {\n    outline: 3px solid var(--ds-focus);\n  }\n  textarea:focus-visible {\n    outline: none;\n  }`;
    expect(ruleIn(both, ':focus-visible')).toBe('outline: 3px solid var(--ds-focus);');
    expect(ruleIn(both, 'textarea:focus-visible')).toBe('outline: none;');
    // A selector list is matched as a whole, in order, not by its first member.
    expect(() => ruleIn(`input,\ntextarea {\n  outline: none;\n}`, 'textarea')).toThrow();
  });
});
