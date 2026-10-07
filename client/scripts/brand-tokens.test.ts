import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The brand's own colours are a third token set, beside the app's `--ds-*` and
 * the editor canvas's `--mly-*`: static, the same in light and dark, and for
 * the mark and brand artwork only. White on coral, pink or purple is 2.82,
 * 3.32 and 3.88:1, so none of them can sit under a label, and an app control,
 * link, focus ring or line of small text takes `--ds-*`. Nothing but the
 * tokens in globals.css and the files named below may read one, so a brand
 * colour cannot drift into the interface without this list growing, and each
 * entry says why it is allowed. An entry that matches nothing fails too.
 */
const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(CLIENT, 'app', 'globals.css'), 'utf8');

function block(selector: string): string {
  const opener = new RegExp(`^${selector.replace(/[.@]/g, '\\$&')}[^{]*\\{`, 'm').exec(css);
  if (!opener) throw new Error(`No "${selector}" block in globals.css`);
  const open = opener.index + opener[0].length - 1;
  return css.slice(open + 1, css.indexOf('\n}', open));
}

const light = block(':root');
const dark = block('.dark');

/** The tokens, as the pack's temply-brand.css has them. */
const BRAND = {
  coral: '#ff6b4a',
  pink: '#ff3d8f',
  purple: '#a855ff',
  violet: '#7a1eff',
  navy: '#0b1020',
  'gradient-primary':
    'linear-gradient(135deg, var(--brand-coral) 0%, var(--brand-pink) 50%, var(--brand-purple) 100%)',
} as const;

const declarations = [...css.matchAll(/^\s*--brand-([a-z-]+)\s*:\s*([^;]+);/gm)].map((match) => [match[1], match[2]?.trim()]);

describe('the brand tokens', () => {
  it('are the six the pack defines, each declared once, at the values the pack gives', () => {
    expect(Object.fromEntries(declarations)).toEqual(BRAND);
    expect(declarations).toHaveLength(Object.keys(BRAND).length);
  });

  it('are static: declared in neither theme block, so light and dark cannot disagree', () => {
    expect(light).not.toContain('--brand-');
    expect(dark).not.toContain('--brand-');
  });

  it('are not the app accent, which is a different violet on purpose', () => {
    const accent = /--ds-accent:\s*(#[0-9a-fA-F]{6})/.exec(light)?.[1]?.toLowerCase();
    expect(accent).toBeDefined();
    for (const [name, value] of Object.entries(BRAND)) {
      if (value.startsWith('#')) expect(value, `--brand-${name} is the app accent`).not.toBe(accent);
    }
  });
});

/** Where a brand colour may be read, and why. */
const ALLOWED: Record<string, string> = {
  'components/brand-mark.tsx': 'the mark: the stops of its gradient, which is artwork and carries no text',
};

const SKIPPED_DIRS = new Set(['node_modules', '.turbo', 'coverage', 'public']);

// `.next` and `.next-e2e` (the e2e build's NEXT_DIST_DIR) hold compiled copies
// of the stylesheet, and the second exists after any local e2e run.
const skipped = (name: string) => SKIPPED_DIRS.has(name) || name.startsWith('.next');

function sources(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipped(entry.name)) found.push(...sources(path));
    } else if (/\.(?:tsx?|css|mjs|mdx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(relative(CLIENT, path));
    }
  }
  return found;
}

/** A token, or a utility built on one (`text-brand-pink`, `bg-[var(--brand-navy)]`). */
const READS_BRAND = /brand-(?:coral|pink|purple|violet|navy|gradient)/;

/** The lines of a file that read a brand colour; in globals.css, not the ones that declare it. */
function readers(file: string): string[] {
  return readFileSync(join(CLIENT, file), 'utf8')
    .split('\n')
    .filter((line) => READS_BRAND.test(line) && !/^\s*--brand-[a-z-]+\s*:/.test(line));
}

describe('who reads a brand colour', () => {
  const files = sources(CLIENT);
  const readFrom = files.filter((file) => readers(file).length > 0);

  it('is only the files named, so no control, link, border or label is painted from the brand', () => {
    expect(readFrom.filter((file) => !(file in ALLOWED))).toEqual([]);
  });

  for (const [file, reason] of Object.entries(ALLOWED)) {
    it(`${file} still does (${reason})`, () => {
      expect(files, `${file} is gone; drop it from the list`).toContain(file);
      expect(readFrom, `${file} no longer reads a brand colour; drop it from the list`).toContain(file);
    });
  }
});
