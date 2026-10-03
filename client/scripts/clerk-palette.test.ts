import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE } from '../lib/clerk-palette';

/**
 * Clerk draws its own DOM and cannot read our CSS variables, so the sign-in
 * and profile screens are handed concrete hexes in `PALETTE`. Nothing ties
 * those to app/globals.css except this test: without it a retuned token
 * leaves the auth screens on the old colour and nobody notices until a
 * customer sees a button that does not match the page around it.
 */
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'globals.css'), 'utf8');

/** The `--ds-*` hexes of the first block that opens on `selector`, the way the contrast gates read them. */
function tokens(selector: ':root' | '.dark'): Record<string, string> {
  const opener = new RegExp(`^${selector.replace('.', '\\.')}\\s*\\{`, 'm').exec(css);
  if (!opener) throw new Error(`No "${selector} {" block in globals.css`);
  const open = opener.index + opener[0].length - 1;
  const body = css.slice(open + 1, css.indexOf('}', open));
  const out: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const match = line.match(/--ds-([a-z-]+)\s*:\s*(#[0-9a-fA-F]{6})/);
    if (match) out[match[1]] = match[2].toLowerCase();
  }
  return out;
}

describe('the palette handed to Clerk matches the design tokens', () => {
  for (const [theme, selector] of [['light', ':root'], ['dark', '.dark']] as const) {
    it(`${theme} values equal their --ds-* tokens`, () => {
      const declared = tokens(selector);
      const drifted = Object.entries(PALETTE[theme])
        .filter(([name, hex]) => declared[name] !== hex.toLowerCase())
        .map(([name, hex]) => `${name}: PALETTE has ${hex}, globals.css has ${declared[name] ?? 'no such token'}`);
      expect(drifted, drifted.join('\n')).toEqual([]);
    });
  }

  it('names the same tokens in both themes', () => {
    expect(Object.keys(PALETTE.dark).sort()).toEqual(Object.keys(PALETTE.light).sort());
  });
});
