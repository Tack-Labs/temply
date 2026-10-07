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
  ['ink', 'sunken', 4.5, 'body text in wells and inset panels'],
  ['muted', 'sunken', 4.5, 'secondary text in wells and inset panels'],
  ['on-accent', 'accent', 4.5, 'label on an accent fill: the Ship band\'s kicker, title and copy, the scroll-to-top button'],
  ['on-accent', 'accent-hover', 4.5, 'label on an accent fill under the pointer'],
  ['accent-ink', 'surface', 4.5, 'links and accent text'],
  ['accent-ink', 'raised', 4.5, 'links and accent text on cards'],
  ['accent-ink', 'sunken', 4.5, 'accent text in wells and inset panels'],
  ['accent-ink', 'accent-wash', 4.5, 'accent badge and selected row'],
  ['muted', 'accent-wash', 4.5, 'secondary text on the accent wash: a selected row\'s subtitle and meta, the plan-limit banner\'s detail'],
  ['ink', 'accent-wash', 4.5, 'headings on the accent wash: the closing band, the next-step banner, a selected row\'s title'],
  ['danger-ink', 'surface', 4.5, 'destructive text'],
  ['danger-ink', 'raised', 4.5, 'destructive text on cards'],
  ['danger-ink', 'sunken', 4.5, 'destructive text in wells and inset panels'],
  ['danger-ink', 'danger-wash', 4.5, 'error banner and badge'],
  ['warn-ink', 'surface', 4.5, 'warning text'],
  ['warn-ink', 'raised', 4.5, 'warning text on cards'],
  ['warn-ink', 'sunken', 4.5, 'warning text in wells and inset panels'],
  ['warn-ink', 'warn-wash', 4.5, 'warning badge'],
  ['success-ink', 'surface', 4.5, 'positive text'],
  ['success-ink', 'raised', 4.5, 'positive text on cards'],
  ['success-ink', 'sunken', 4.5, 'positive text in wells and inset panels'],
  ['success-ink', 'success-wash', 4.5, 'success badge and confirmation'],
  ['sky-ink', 'sky-wash', 4.5, 'sky badge and tag'],
  ['peach-ink', 'peach-wash', 4.5, 'peach badge and tag'],
  ['sky-ink', 'surface', 4.5, 'sky text on the page'],
  ['sky-ink', 'raised', 4.5, 'sky text on cards'],
  ['peach-ink', 'surface', 4.5, 'peach text on the page'],
  ['peach-ink', 'raised', 4.5, 'peach text on cards'],
  ['muted', 'active', 4.5, 'secondary text on a pressed row'],
  ['warn-ink', 'active', 4.5, 'warning label on a pressed row'],
  ['muted', 'hover', 4.5, 'sidebar link, neutral badge and workspace card under the pointer'],
  ['ink', 'hover', 4.5, 'sidebar link, account row and workspace card under the pointer'],
  // ink-soft is the step between ink and muted, so it answers wherever either
  // does. In .dark it is muted's own value, and the pairs hold it there.
  ['ink-soft', 'surface', 4.5, 'a lead paragraph and a quiet label on the page'],
  ['ink-soft', 'raised', 4.5, 'a lead paragraph and a quiet label on cards'],
  ['ink-soft', 'sunken', 4.5, 'a quiet label in wells and inset panels'],
  ['ink-soft', 'hover', 4.5, 'a quiet label under the pointer'],
  ['ink-soft', 'track', 4.5, 'a segmented control\'s inactive label in its groove'],
  // `track` is the groove behind a segmented control and the fill of a neutral
  // pill, so the text that sits in either answers to 4.5:1.
  ['ink', 'track', 4.5, 'the selected label, and a neutral pill\'s text, on a track'],
  ['muted', 'track', 4.5, 'secondary text on a track'],
  ['canvas-ink', 'canvas', 4.5, 'chrome drawn on the email canvas'],
  // The pictures of an email on the marketing page and in the docs. The canvas
  // never follows the theme, so these hold in both.
  ['canvas-body', 'canvas', 4.5, 'paragraph text in a pictured email'],
  ['canvas-quiet', 'canvas', 4.5, 'footer and fine print in a pictured email'],
  ['canvas-accent-ink', 'canvas', 4.5, 'a link or token in a pictured email'],
  ['canvas-accent-ink', 'canvas-accent-wash', 4.5, 'a variable pill in a pictured email'],
  ['canvas-body', 'canvas-well', 4.5, 'text on a pictured email\'s plate'],
  ['canvas-dark-ink', 'canvas-dark', 4.5, 'headings in the forced-dark rendering'],
  ['canvas-dark-body', 'canvas-dark', 4.5, 'paragraph text in the forced-dark rendering'],
  ['canvas-dark-quiet', 'canvas-dark', 4.5, 'fine print in the forced-dark rendering'],
  // The Ship band is the accent fill edge to edge: its button is white with an
  // accent label, and it is dark in both themes because the fill is.
  ['accent', 'canvas', 4.5, 'label on the Ship band\'s white button'],
  ['accent', 'canvas-accent-wash', 4.5, 'label on the Ship band\'s button under the pointer'],
  // The terminal on the Ship band. It is dark in both themes.
  ['rail-ink', 'rail-bg', 4.5, 'command and keys in the terminal'],
  ['rail-muted', 'rail-bg', 4.5, 'prompt, flags and the endpoint line in the terminal'],
  ['rail-ok', 'rail-bg', 4.5, 'the 200 OK status'],
  ['rail-accent', 'rail-bg', 4.5, 'string values in the terminal'],
  ['rail-active-ink', 'rail-active-bg', 4.5, 'a selected row on the rail'],
  // Non-text marks answer to 3:1, not the text threshold. `faint` is for
  // those and for nothing a person has to read; a `text-faint` class fails
  // scripts/faint.test.ts.
  ['faint', 'surface', 3, 'icons, dividers and dots on the page'],
  ['faint', 'raised', 3, 'icons, dividers and dots on cards'],
  ['faint', 'sunken', 3, 'icons on wells and thumbnails'],
  ['faint', 'active', 3, 'icons on a pressed row'],
  // Contrast is symmetric, so this one pair holds both jobs: the accent block
  // against the dark page (3:1 is all that mark needs) and the dark page as the
  // label on that block when it is a button's fill (4.5:1).
  ['canvas-dark', 'canvas-dark-accent', 4.5, 'the label on a forced-dark button, and the accent block against the page'],
  // An inactive control is exempt from 4.5:1, but a label nobody can find is
  // not a design. `disabled` is held to the mark threshold on every surface a
  // disabled control is drawn on, which keeps it readable and still below
  // `muted`. It is not held on the accent wash, where it measures 2.83:1 in
  // light: WCAG 1.4.3 exempts inactive components, so that is a choice, not a
  // failure.
  ['disabled', 'track', 3, 'a disabled button\'s label on its track'],
  ['disabled', 'surface', 3, 'a disabled control\'s label on the page'],
  ['disabled', 'raised', 3, 'a disabled control\'s label on cards'],
  // The focus ring is a non-text mark drawn 2px off its control, so it lands on
  // whatever the control sits on, never on the control's own fill.
  ['focus', 'surface', 3, 'focus ring on the page'],
  ['focus', 'raised', 3, 'focus ring on cards'],
  ['focus', 'sunken', 3, 'focus ring on wells and inset panels'],
  ['focus', 'hover', 3, 'focus ring on a row under the pointer'],
  ['focus', 'active', 3, 'focus ring on a pressed row'],
  ['focus', 'track', 3, 'focus ring on a segmented control\'s groove'],
  // The hairlines are decoration, not marks a person has to find: a card is
  // told from the page by its fill and its shadow, and the border only closes
  // the edge. They are held to a floor so a later retune cannot lighten them
  // into nothing, and `line-strong` stays the darker of the two.
  ['line', 'raised', 1.2, 'a divider on a card'],
  ['line-strong', 'raised', 1.3, 'the border of a field or a secondary button on a card'],
  // The bar fills of the home page's usage tiles, drawn on a wash for a track
  // and on the card. The sidebar's meter has its own pairs further down, on
  // `line-strong`.
  ['success', 'success-wash', 3, 'success bar fill on its track'],
  ['success', 'raised', 3, 'success bar fill on a card'],
  ['peach', 'peach-wash', 3, 'peach bar fill on its track'],
  ['peach', 'raised', 3, 'peach bar fill on a card'],
  ['accent-ink', 'accent-wash', 3, 'accent bar fill on its track'],
  ['warn-ink', 'warn-wash', 3, 'near-limit bar fill on its track'],
  ['danger-ink', 'danger-wash', 3, 'limit-reached bar fill on its track'],
  // `accent-edge` is the divider inside a lavender callout, such as the hint in
  // the editor's components rail. It never carries meaning alone, and a pastel
  // against white cannot reach 3:1. It is held above `line-strong`, so it stays
  // a visible step up from a divider, and no lower. It is measured on a card
  // here and drawn on the accent wash, which this pair does not cover.
  ['accent-edge', 'raised', 1.5, 'the divider inside a lavender callout'],
  // The sidebar's usage bar fills with the -ink colours on `line-strong`.
  ['accent-ink', 'line-strong', 3, 'usage bar fill on its track'],
  ['warn-ink', 'line-strong', 3, 'near-limit and overage bar fill on its track'],
  ['danger-ink', 'line-strong', 3, 'limit-reached bar fill on its track'],
];

// Every wash is a surface that body text and controls sit on: a banner, a badge,
// a selected row. Text on one answers to 4.5:1, and the focus ring (`focus`, 3px,
// held 2px off the control) to 3:1, because the ring of a button inside a banner
// is drawn on the wash and not on the page. The accent wash's ink and muted
// pairs are listed above with their own uses.
for (const wash of ['accent', 'danger', 'warn', 'success', 'sky', 'peach']) {
  if (wash !== 'accent') {
    PAIRS.push(
      ['ink', `${wash}-wash`, 4.5, `body text on the ${wash} wash`],
      ['muted', `${wash}-wash`, 4.5, `secondary text on the ${wash} wash`],
    );
  }
  PAIRS.push(
    ['ink-soft', `${wash}-wash`, 4.5, `a quiet label on the ${wash} wash`],
    ['focus', `${wash}-wash`, 3, `focus ring on the ${wash} wash`],
  );
}

/** Solid fills that carry white label text. */
const WHITE_ON: Array<[string, number, string]> = [
  ['accent', 4.5, 'white label on the primary button, and white on the Ship band: its kicker, title and copy'],
  ['accent-hover', 4.5, 'white label on the primary button under the pointer'],
  ['danger', 4.5, 'white label on a destructive button'],
];

/** A pictured button's label is the canvas's own white, so the two must agree. */
const LABEL_ON: Array<[string, string, number, string]> = [
  ['canvas-on-accent', 'accent', 4.5, 'label on a pictured email\'s button'],
];

const css = readFileSync(CSS_PATH, 'utf8');
// The dark theme is the light one with its own declarations laid over it, which
// is what the cascade does: a token declared only in :root (the rail, the
// canvas and everything pictured on it) is the same in both and is checked in both.
const light = parseBlock(css, ':root');
const themes = {
  light,
  dark: { ...light, ...parseBlock(css, '.dark') },
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

  for (const [fg, bg, min, use] of LABEL_ON) {
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
}

console.log('Design token contrast' + lines.join('\n'));

if (failures > 0) {
  console.error(`\n${failures} contrast requirement(s) not met.`);
  process.exit(1);
}
console.log('\nAll token pairs meet their threshold.');
