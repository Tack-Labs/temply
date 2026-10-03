import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `faint` is held to 3:1 for icons, dividers and dots, so any text set in it
 * fails the 4.5:1 that reading needs. It shipped as placeholder, hint and
 * eyebrow colour in some forty places before anyone measured it, so the rule
 * lives here rather than in a comment: `faint` is allowed on an icon (which
 * takes its colour from `currentColor`) and nowhere else. A ban on one
 * spelling only moves the offenders to the next, so the guard reads every way
 * a colour reaches text: the utility class, a Tailwind arbitrary value, an
 * inline style, and an `@apply` in a stylesheet.
 */
const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['app', 'components', 'core', 'hooks', 'lib'];
const CSS_ROOTS = ['app', join('core', 'styles')];

type Hit = { at: number; text: string };

/** `faint` as a CSS variable. `--ds-rail-faint` is a different token and does not match. */
const VAR = String.raw`--(?:ds|color)-faint(?![\w-])`;
/** The token however it is spelled in a style value: the variable, or a bare `faint` key. */
const ANY = String.raw`(?:${VAR}|(?<![\w-])faint(?![\w-]))`;

const UTILITY = /(?<![\w-])(?:[\w[\]&_:-]+:)?text-faint(?![\w-])/g;
// `text-[var(--ds-faint)]`, `text-(--ds-faint)` and `[color:var(--ds-faint)]`.
const ARBITRARY = new RegExp(String.raw`(?<![\w-])text-(?:\[[^\]\s]*${VAR}[^\]\s]*\]|\([^)\s]*${VAR}[^)\s]*\))`, 'g');
const PROPERTY = new RegExp(String.raw`(?<![\w-])\[color:[^\]\s]*${VAR}[^\]\s]*\]`, 'g');
// `color: var(--ds-faint)` and `style={{ color: tokens.faint }}`. Not `border-color`,
// not `--color-faint:` and not an arbitrary `[color:…]`, which PROPERTY owns.
const DECLARATION = new RegExp(String.raw`(?<![\w[-])color\s*:\s*[^,;}\n]*?${ANY}`, 'g');

function* walk(dir: string, pattern: RegExp): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path, pattern);
    else if (pattern.test(name) && !/\.test\.tsx?$/.test(name)) yield path;
  }
}

/**
 * Whether the class at `index` belongs to an icon: the nearest opening tag
 * before it is a component named `Icon` or `…Icon`, still unclosed, or the
 * class is reached through `[&_svg]:` from a parent, with or without other
 * variants between that prefix and the utility.
 */
function onAnIcon(source: string, index: number): boolean {
  const variants = /[^\s'"`]*$/.exec(source.slice(0, index))?.[0] ?? '';
  if (variants.includes('[&_svg]:')) return true;
  const open = source.lastIndexOf('<', index);
  if (open === -1) return false;
  const inside = source.slice(open, index);
  // A `>` that is not an arrow means the tag closed before the class.
  if (/(?<!=)>/.test(inside)) return false;
  return /^<\w*Icon\b/.test(inside);
}

/** Class-list spellings of faint text, wherever the string sits. */
function classHits(source: string): Hit[] {
  const hits: Hit[] = [];
  for (const hit of source.matchAll(UTILITY)) {
    // The match carries its variant prefix; the class itself starts later.
    hits.push({ at: hit.index + hit[0].lastIndexOf('text-faint'), text: hit[0] });
  }
  for (const form of [ARBITRARY, PROPERTY]) {
    for (const hit of source.matchAll(form)) hits.push({ at: hit.index, text: hit[0] });
  }
  return hits;
}

function declarationHits(source: string): Hit[] {
  return [...source.matchAll(DECLARATION)].map((hit) => ({ at: hit.index, text: hit[0] }));
}

/** Faint text in a TypeScript source: every hit that is not on an icon. */
function flagged(source: string): Hit[] {
  return [...classHits(source), ...declarationHits(source)].filter((hit) => !onAnIcon(source, hit.at));
}

/**
 * Faint text in a stylesheet. A rule cannot say it targets an icon, so there is
 * no exemption: a mark that wants faint takes it through `border-color`, `fill`
 * or `stroke`. Comments are blanked, not removed, so the line numbers hold.
 */
function flaggedCss(source: string): Hit[] {
  const bare = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
  const hits = declarationHits(bare);
  for (const apply of bare.matchAll(/@apply\s[^;}]*/g)) {
    for (const hit of classHits(apply[0])) hits.push({ at: apply.index + hit.at, text: hit.text });
  }
  return hits;
}

function lineOf(source: string, at: number): number {
  return source.slice(0, at).split('\n').length;
}

describe('faint is for marks, never for text', () => {
  it('no faint sits on anything but an icon, in a class, an inline style or a stylesheet', () => {
    const offenders: string[] = [];
    const advice = 'use text-muted, or text-ink where muted flattens the hierarchy';
    for (const root of ROOTS) {
      for (const file of walk(join(CLIENT, root), /\.tsx?$/)) {
        const source = readFileSync(file, 'utf8');
        for (const hit of flagged(source)) {
          offenders.push(`${relative(CLIENT, file)}:${lineOf(source, hit.at)}  ${hit.text} — ${advice}`);
        }
      }
    }
    for (const root of CSS_ROOTS) {
      for (const file of walk(join(CLIENT, root), /\.css$/)) {
        const source = readFileSync(file, 'utf8');
        for (const hit of flaggedCss(source)) {
          offenders.push(`${relative(CLIENT, file)}:${lineOf(source, hit.at)}  ${hit.text} — ${advice}`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('knows an icon from text, so the guard cannot go quiet', () => {
    const icon = `<MailIcon className="size-5 text-faint" />`;
    expect(flagged(icon)).toEqual([]);
    const generic = `<Icon aria-hidden className={cn('size-4', 'text-faint')} />`;
    expect(flagged(generic)).toEqual([]);
    const svgChild = `'[&_svg]:text-faint'`;
    expect(flagged(svgChild)).toEqual([]);
    const text = `<p className="text-2xs text-faint">`;
    expect(flagged(text)).toHaveLength(1);
    const variant = `<input className="px-3 placeholder:text-faint" />`;
    expect(flagged(variant)).toHaveLength(1);
    const afterIcon = `<MailIcon className="size-4" /><span className="text-faint">`;
    expect(flagged(afterIcon)).toHaveLength(1);
    const constant = `<MailIcon />;\nconst field = 'px-3 placeholder:text-faint';`;
    expect(flagged(constant)).toHaveLength(1);
  });

  it('catches an arbitrary value and an inline style, on text and not on an icon', () => {
    for (const cls of [
      'text-[var(--ds-faint)]',
      'text-[color:var(--ds-faint)]',
      'text-[var(--color-faint)]',
      'text-(--ds-faint)',
      '[color:var(--ds-faint)]',
      'hover:text-[var(--ds-faint)]',
    ]) {
      expect(flagged(`<p className="text-2xs ${cls}">`)).toHaveLength(1);
      expect(flagged(`<MailIcon className="size-4 ${cls}" />`)).toEqual([]);
      expect(flagged(`const row = '[&_svg]:${cls}';`)).toEqual([]);
    }
    const styled = `<p style={{ color: 'var(--ds-faint)' }}>`;
    expect(flagged(styled)).toHaveLength(1);
    const keyed = `<p style={{ color: tokens.faint }}>`;
    expect(flagged(keyed)).toHaveLength(1);
    const conditional = `<p style={{ color: dim ? 'var(--color-faint)' : undefined }}>`;
    expect(flagged(conditional)).toHaveLength(1);
    const iconStyled = `<MailIcon style={{ color: 'var(--ds-faint)' }} />`;
    expect(flagged(iconStyled)).toEqual([]);
    const literal = "const hint = { color: 'var(--ds-faint)' };";
    expect(flagged(literal)).toHaveLength(1);
  });

  it('leaves marks and other tokens alone', () => {
    // A border is a mark, rail-faint is the dark rail's own token, and a hex
    // beside a `faint` key is not the variable.
    expect(flagged(`<hr className="border-faint" style={{ borderColor: 'var(--ds-faint)' }} />`)).toEqual([]);
    expect(flagged(`<span className="text-rail-faint">`)).toEqual([]);
    expect(flagged(`<span style={{ color: 'var(--ds-rail-faint)' }}>`)).toEqual([]);
    expect(flagged(`const figure = { faint: { color: '#8a919e' } };`)).toEqual([]);
    expect(flagged(`<span className="fill-[var(--ds-faint)]">`)).toEqual([]);
  });

  it('reads a stylesheet: @apply and a colour declaration are caught, a comment and a token definition are not', () => {
    expect(flaggedCss(`.hint {\n  @apply text-faint text-sm;\n}`)).toHaveLength(1);
    expect(flaggedCss(`.hint { @apply px-2 hover:text-faint; }`)).toHaveLength(1);
    expect(flaggedCss(`.hint { @apply text-[var(--ds-faint)]; }`)).toHaveLength(1);
    expect(flaggedCss(`.hint { color: var(--ds-faint); }`)).toHaveLength(1);
    expect(flaggedCss(`.rule { border-color: var(--ds-faint); }`)).toEqual([]);
    expect(flaggedCss(`/* never text-faint, never color: var(--ds-faint) */\n:root { --color-faint: var(--ds-faint); }`)).toEqual([]);
    expect(flaggedCss(`.rail { @apply text-rail-faint; }`)).toEqual([]);
    // Blanking a comment keeps the line a hit is reported on.
    const [hit] = flaggedCss(`/* one\n two */\n.hint { @apply text-faint; }`);
    expect(lineOf(`/* one\n two */\n.hint { @apply text-faint; }`, hit.at)).toBe(3);
  });
});
