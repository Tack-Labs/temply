/**
 * Asserts that the editor's theme is internally sound.
 *
 * The same defect has now shipped three times, each time because a colour was
 * decided at the component instead of coming from a layer that knows about the
 * theme:
 *
 *   select-native      black text on a background that went dark   1.00:1
 *   ui/input           white background under inherited white text 1.00:1
 *   text bubble menu   light icons on a bar that stayed white      1.11:1
 *
 * Checking component source cannot catch the third one: the bar's background
 * lives in one file and the icon colour in another. So this checks the layer
 * underneath instead — every surface token against every text token, in both
 * themes. If a pair cannot be combined safely, the theme is unsound regardless
 * of which components happen to combine them today.
 *
 * Run: bun run check:editor-contrast
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const GLOBALS = join(here, '..', 'app', 'globals.css');
const EDITOR_THEME = join(here, '..', 'core', 'styles', 'index.css');

type RGB = { r: number; g: number; b: number };

function block(css: string, selector: string): Record<string, string> {
  const opener = new RegExp(`^${selector.replace(/[.@]/g, '\\$&')}[^{]*\\{`, 'm');
  const match = opener.exec(css);
  if (!match) throw new Error(`Could not find "${selector}" in the stylesheet`);
  const open = match.index + match[0].length - 1;
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);

  const out: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const hex = line.match(/--ds-([a-z-]+)\s*:\s*(#[0-9a-fA-F]{6})/);
    if (hex) out[hex[1]] = hex[2].toLowerCase();
    const alias = line.match(/--color-([a-z0-9-]+)\s*:\s*var\(--ds-([a-z-]+)\)/);
    if (alias) out[alias[1]] = `@${alias[2]}`;
    // The editor chrome's own per-theme pair (see core/styles/index.css):
    // an alias may point at --mly-chrome-*, which per theme holds either a
    // hex or a --ds-* reference.
    const chromeHex = line.match(/--mly-chrome-([a-z-]+)\s*:\s*(#[0-9a-fA-F]{6})/);
    if (chromeHex) out[`chrome-${chromeHex[1]}`] = chromeHex[2].toLowerCase();
    const chromeAlias = line.match(/--mly-chrome-([a-z-]+)\s*:\s*var\(--ds-([a-z-]+)\)/);
    if (chromeAlias) out[`chrome-${chromeAlias[1]}`] = `@${chromeAlias[2]}`;
    const colorToChrome = line.match(/--color-([a-z0-9-]+)\s*:\s*var\(--mly-chrome-([a-z-]+)\)/);
    if (colorToChrome) out[colorToChrome[1]] = `%chrome-${colorToChrome[2]}`;
  }
  return out;
}

const toRgb = (hex: string): RGB => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

function luminance(c: RGB): number {
  const ch = (raw: number) => {
    const v = raw / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

function contrast(a: string, b: string): number {
  const l1 = luminance(toRgb(a));
  const l2 = luminance(toRgb(b));
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
}

const globals = readFileSync(GLOBALS, 'utf8');
const editorCss = readFileSync(EDITOR_THEME, 'utf8');

const themes = {
  light: block(globals, ':root'),
  dark: block(globals, '.dark'),
};
const aliases = block(editorCss, '@theme inline');
const chromeVars = {
  light: block(editorCss, ':root'),
  dark: block(editorCss, '.dark'),
};

/**
 * The contract. A `mly:` utility on the left resolves through the editor theme
 * to a --ds-* token; these are the combinations the editor is allowed to make.
 * Adding a surface or a text colour to the editor means adding it here.
 */
const SURFACES = ['soft-gray', 'gray-50', 'gray-100', 'gray-200'] as const;
const TEXT_ON_SURFACE = ['midnight-gray', 'gray-500', 'gray-600', 'gray-700', 'gray-900', 'slate-500', 'slate-600', 'slate-700'] as const;
/** Icons and other non-text marks only need 3.0. */
const MARKS = ['gray-400', 'slate-400'] as const;

function resolve(alias: string, theme: 'light' | 'dark'): string | null {
  let target = aliases[alias];
  if (!target) return null;
  if (target.startsWith('%')) {
    // Chrome indirection: hop through the per-theme --mly-chrome-* value.
    target = chromeVars[theme][target.slice(1)] ?? '';
    if (!target) return null;
  }
  if (!target.startsWith('@')) return target;
  return themes[theme][target.slice(1)] ?? null;
}

let failures = 0;
const lines: string[] = [];

for (const theme of ['light', 'dark'] as const) {
  lines.push(`\n  ${theme}`);

  // Every panel in the editor floats on `panel`, so check that first — it is
  // the pairing the bubble menus actually make.
  const surfaceList = ['panel', ...SURFACES];

  for (const surface of surfaceList) {
    const surfaceHex = resolve(surface, theme);
    if (!surfaceHex) {
      failures++;
      lines.push(`    UNMAPPED surface ${surface}`);
      continue;
    }
    const label = surface;

    for (const [group, min] of [[TEXT_ON_SURFACE, 4.5], [MARKS, 3.0]] as const) {
      for (const fg of group) {
        const fgHex = resolve(fg, theme);
        if (!fgHex) {
          failures++;
          lines.push(`    UNMAPPED text ${fg}`);
          continue;
        }
        const ratio = contrast(fgHex, surfaceHex);
        if (ratio < min) {
          failures++;
          lines.push(`    FAIL ${String(ratio).padStart(6)}:1  ${fg} on ${label}  (needs ${min})`);
        }
      }
    }
  }

  if (!lines[lines.length - 1].includes('FAIL') && !lines[lines.length - 1].includes('UNMAPPED')) {
    lines.push('    every surface / text pairing clears its threshold');
  }
}

/**
 * The pairing matrix above only sees colours the theme knows about. The bubble
 * menu defect slipped through exactly because its background — `mly:bg-white` —
 * was never mapped, so it stayed a fixed literal while the foregrounds around
 * it learned to follow the theme. An unmapped surface is the mechanism, so
 * catch it directly.
 */
// The whole editor, not just components/: the menus that shipped white lived
// in nodes/ and extensions/, which the earlier scope never walked.
const COMPONENTS = join(here, '..', 'core', 'editor');
/** Files whose colours belong to the email being edited, not to our chrome:
 *  the editor body the canvas paints over, the HTML block's source view and
 *  the link card's badge — all drawn on the canvas, which follows the
 *  template's theme and ignores app dark mode. */
const CONTENT_FILES = [
  'core/editor/index.tsx',
  'core/editor/nodes/html/html-view.tsx',
  'core/editor/nodes/link-card.tsx',
];

function walk(dir: string): string[] {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  return readdirSync(dir).flatMap((entry: string) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory()
      ? walk(full)
      : /\.tsx?$/.test(entry)
        ? [full]
        : [];
  });
}

const unmapped = new Map<string, string[]>();
// Names can be multi-word (`soft-gray`, `midnight-gray`) or scaled (`gray-200`).
const BG = /mly:bg-([a-z]+(?:-[a-z]+)*(?:-\d+)?)/g;
/** Fixed colours that are legitimately fixed: they belong to the email being
 *  edited, not to our chrome. */
const CONTENT_SURFACES = new Set(['transparent', 'current', 'inherit', 'canvas']);

for (const file of walk(COMPONENTS)) {
  if (CONTENT_FILES.some((c) => file.endsWith(c))) continue;
  const src = readFileSync(file, 'utf8');
  for (const match of src.matchAll(BG)) {
    const name = match[1];
    if (CONTENT_SURFACES.has(name)) continue;
    if (aliases[name]) continue; // resolves through the theme
    const rel = file.slice(file.indexOf('core/editor'));
    unmapped.set(name, [...(unmapped.get(name) ?? []), rel]);
  }
}

/**
 * globals.css defines one :focus-visible treatment for the whole app. Editor
 * components used to switch it off and draw their own grey ring — and in nine
 * files, switch it off and draw nothing, leaving those controls with no focus
 * indicator at all. Suppressing it is now a build failure.
 */
const SUPPRESSORS = /(?:mly:)?(?:focus-visible:|focus:)?outline-(?:none|hidden)/;
const suppressing: string[] = [];
for (const file of walk(COMPONENTS)) {
  if (SUPPRESSORS.test(readFileSync(file, 'utf8'))) {
    suppressing.push(file.slice(file.indexOf('core/editor')));
  }
}
if (suppressing.length > 0) {
  failures += suppressing.length;
  lines.push('\n  controls that switch off the app focus treatment');
  for (const f of suppressing.slice(0, 6)) lines.push(`    FAIL ${f}`);
  if (suppressing.length > 6) lines.push(`         …and ${suppressing.length - 6} more`);
}

if (unmapped.size > 0) {
  lines.push('\n  surfaces that do not resolve through the theme');
  for (const [name, files] of unmapped) {
    failures += 1;
    const unique = [...new Set(files)];
    lines.push(`    FAIL mly:bg-${name} — fixed literal, used in ${unique.length} file(s)`);
    for (const f of unique.slice(0, 3)) lines.push(`         ${f}`);
    if (unique.length > 3) lines.push(`         …and ${unique.length - 3} more`);
  }
}

console.log('Editor theme contrast' + lines.join('\n'));

if (failures > 0) {
  console.error(
    `\n${failures} unsafe pairing(s). A colour is being decided somewhere that does not know about the theme.`,
  );
  process.exit(1);
}
console.log('\nThe editor theme is sound in both themes.');
