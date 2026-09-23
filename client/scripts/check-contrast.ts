/**
 * Fails the build when a design token pair drops below its WCAG threshold.
 *
 * Values are read out of app/globals.css rather than duplicated here, so the
 * check cannot drift from the tokens it is guarding.
 *
 * Run: bun run check:contrast
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type RGB = { r: number; g: number; b: number };

const CSS_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'globals.css');

function parseBlock(css: string, selector: string): Record<string, string> {
  // Anchor on a selector that starts its own line, so `.dark` does not match
  // the `@custom-variant dark (&:where(.dark, .dark *))` declaration above.
  const opener = new RegExp(`^${selector.replace('.', '\\.')}\\s*\\{`, 'm');
  const match = opener.exec(css);
  if (!match) throw new Error(`Could not find a "${selector} {" block in globals.css`);
  const open = match.index + match[0].length - 1;
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);

  const tokens: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const match = line.match(/--ds-([a-z-]+)\s*:\s*(#[0-9a-fA-F]{6})/);
    if (match) tokens[match[1]] = match[2].toLowerCase();
  }
  return tokens;
}

function toRgb(hex: string): RGB {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function luminance(c: RGB): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

function contrast(a: string, b: string): number {
  const l1 = luminance(toRgb(a));
  const l2 = luminance(toRgb(b));
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
}

/** Foreground token, background token, minimum ratio, what it is used for. */
const PAIRS: Array<[string, string, number, string]> = [
  ['ink', 'surface', 4.5, 'body text on the page'],
  ['ink', 'raised', 4.5, 'body text on cards'],
  ['muted', 'surface', 4.5, 'secondary text on the page'],
  ['muted', 'raised', 4.5, 'secondary text on cards'],
  ['accent-ink', 'surface', 4.5, 'links and accent text'],
  ['accent-ink', 'raised', 4.5, 'links and accent text on cards'],
  ['danger-ink', 'surface', 4.5, 'destructive text'],
  ['danger-ink', 'raised', 4.5, 'destructive text on cards'],
  ['warn-ink', 'surface', 4.5, 'warning text'],
  ['warn-ink', 'raised', 4.5, 'warning text on cards'],
  ['warn-ink', 'warn-wash', 4.5, 'warning badge'],
  ['success-ink', 'surface', 4.5, 'positive text'],
  ['success-ink', 'raised', 4.5, 'positive text on cards'],
  ['canvas-ink', 'canvas', 4.5, 'chrome drawn on the email canvas'],
];

/** Solid fills that carry white label text. */
const WHITE_ON: Array<[string, number, string]> = [
  ['accent', 4.5, 'white label on the primary button'],
  ['danger', 4.5, 'white label on a destructive button'],
];

const css = readFileSync(CSS_PATH, 'utf8');
const themes = {
  light: parseBlock(css, ':root'),
  dark: parseBlock(css, '.dark'),
};

let failures = 0;
const lines: string[] = [];

for (const [themeName, tokens] of Object.entries(themes)) {
  lines.push(`\n  ${themeName}`);

  for (const [fg, bg, min, use] of PAIRS) {
    const fgHex = tokens[fg];
    const bgHex = tokens[bg];
    if (!fgHex || !bgHex) {
      failures++;
      lines.push(`    MISSING  --ds-${fg} / --ds-${bg}`);
      continue;
    }
    const ratio = contrast(fgHex, bgHex);
    const pass = ratio >= min;
    if (!pass) failures++;
    lines.push(
      `    ${pass ? 'ok  ' : 'FAIL'} ${String(ratio).padStart(5)}:1  ${fg} on ${bg}  (needs ${min}) — ${use}`,
    );
  }

  for (const [fill, min, use] of WHITE_ON) {
    const fillHex = tokens[fill];
    if (!fillHex) {
      failures++;
      lines.push(`    MISSING  --ds-${fill}`);
      continue;
    }
    const ratio = contrast('#ffffff', fillHex);
    const pass = ratio >= min;
    if (!pass) failures++;
    lines.push(
      `    ${pass ? 'ok  ' : 'FAIL'} ${String(ratio).padStart(5)}:1  white on ${fill}  (needs ${min}) — ${use}`,
    );
  }

  // `faint` is deliberately below the text threshold. Report it so the number
  // stays visible, and so nobody "fixes" it by putting text on it.
  const faint = tokens['faint'];
  if (faint) {
    lines.push(
      `    note ${String(contrast(faint, tokens['surface'])).padStart(5)}:1  faint on surface — borders and icons only, never text`,
    );
  }
}

console.log('Design token contrast' + lines.join('\n'));

if (failures > 0) {
  console.error(`\n${failures} contrast requirement(s) not met.`);
  process.exit(1);
}
console.log('\nAll token pairs meet their threshold.');
