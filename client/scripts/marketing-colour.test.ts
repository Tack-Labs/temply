import { describe, expect, it } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The marketing page and the docs figures imitate things: an email canvas, a
 * forced-dark mail client, a terminal. Each imitation reaches its colours
 * through a token (`--ds-canvas-*` for a mail client's paint, `--ds-rail-*` for
 * the terminal, the app tokens for the chrome around them), so a retune of the
 * palette reaches them and the contrast gate has something to measure. They
 * were once drawn in literal hex, and the old indigo accent outlived its
 * retirement in about seventy of them. A colour written any other way gets
 * round the token layer just as well, so the guard reads every way this repo
 * could write one: hex, `rgb(`/`hsl(`/`oklch(` and the rest of the functional
 * notations, a CSS named colour in a colour context, and Tailwind's fixed
 * `white`/`black` and palette utilities. One is allowed in these files only
 * where it depicts something that is not ours to retune, and each is named
 * below with what it depicts. An entry that no longer matches anything fails
 * too, so the list cannot outlive the colours it excuses.
 */
const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every file whose pictures have to follow the token layer. */
function scanned(): string[] {
  const files = [join('app', '(marketing)', 'home-client.tsx')];
  for (const name of readdirSync(join(CLIENT, 'components', 'marketing'))) {
    if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(join('components', 'marketing', name));
  }
  for (const name of readdirSync(join(CLIENT, 'components', 'docs'))) {
    if (/^(?:demo|figure)-[\w-]+\.tsx$/.test(name)) files.push(join('components', 'docs', name));
  }
  return files.filter((file) => existsSync(join(CLIENT, file)));
}

/**
 * What is allowed to stay a literal, and why. Keyed by file and then by the
 * lower-case text the guard reports: a hex, a colour name, or a function name
 * with its bracket. Mostly a customer's brand colour, drawn as the thing a
 * customer picks, or the pixels of a photograph.
 */
const ALLOWED_LITERALS: Record<string, Record<string, string>> = {
  'app/(marketing)/home-client.tsx': {
    black: 'the stops of a mask-image, which is read for its alpha and never painted',
  },
  'components/marketing/hero-showreel.tsx': {
    '#b85a33': 'terracotta, the brand colour the film restyles the button to (4.6:1 under a white label)',
    '#0f766e': 'teal, the third swatch in the film\'s colour pill',
    '#d98a63': 'terracotta lifted for the forced-dark rendering, as a mail client would repaint it',
    // The photograph in the email. An image keeps its pixels in every theme and
    // in a forced-dark client alike, so it is not painted from a token.
    '#c7daf0': 'photo: top of the sky',
    '#dde5ee': 'photo: mid sky',
    '#ead9c8': 'photo: horizon haze',
    '#e4cdb6': 'photo: ground haze',
    '#f2b45c': 'photo: the sun',
    '#93a6b8': 'photo: far ridge',
    '#3f4e5d': 'photo: near ridge',
  },
  'components/marketing/showcase-visuals.tsx': {
    '#0f766e': 'Northwind, a saved brand: its base swatch',
    '#2dd4bf': 'Northwind, a saved brand: its light swatch',
    '#ccfbf1': 'Northwind, a saved brand: its wash swatch',
    '#b45309': 'Beacon, a saved brand: its base swatch',
    '#f59e0b': 'Beacon, a saved brand: its light swatch',
    '#fef3c7': 'Beacon, a saved brand: its wash swatch',
  },
  'components/docs/demo-editor.tsx': {
    '#b85a33': 'terracotta, the colour the bubble menu restyles the button to',
    '#0f766e': 'teal, a third swatch in the bubble menu',
  },
};

/** `allowable` hits can be excused by ALLOWED_LITERALS; the rest cannot be. */
type Hit = { at: number; text: string; why: string; allowable: boolean };

/** `#abc`, `#aabbcc` and their alpha forms. Not an entity (`&#39;`) or an anchor (`#features`). */
const HEX = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
/** The retired accent, in a variable, a class, a comment or an identifier. */
const INDIGO = /indigo/gi;
/** Functional notations that name a colour outright. `color-mix(` and `var(` are the token layer's own and do not match. */
const COLOUR_FUNCTION = /(?<![\w-])(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch)\(/gi;
/** Tailwind's fixed `white` and `black`, which no token speaks for, under any variant or opacity. */
const FIXED_UTILITY =
  /(?<![\w-])(?:bg|text|border(?:-[xytrblse])?|ring|outline|fill|stroke|shadow|from|via|to|divide|decoration|accent|caret)-(?:white|black)(?![\w-])/g;
/** Tailwind's default palette, `bg-emerald-500` and the like, which is the same bypass with more steps. */
const PALETTE_UTILITY =
  /(?<![\w-])(?:bg|text|border(?:-[xytrblse])?|ring|outline|fill|stroke|shadow|from|via|to|divide|decoration|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|violet|purple|fuchsia|pink|rose)-\d{2,3}(?![\w-])/g;

/** CSS named colours, less `transparent` and `currentcolor`, which are not a choice of colour, and `indigo`, which INDIGO already refuses. */
const NAMED = (
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood ' +
  'cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray ' +
  'darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
  'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue ' +
  'firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew ' +
  'hotpink indianred ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
  'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
  'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue ' +
  'mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred ' +
  'midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
  'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple ' +
  'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue ' +
  'slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white ' +
  'whitesmoke yellow yellowgreen'
).split(' ');
const NAME = new RegExp(`(?<![\\w-])(${NAMED.join('|')})(?![\\w(-])`, 'gi');

/**
 * A named colour is a word that is also prose, so it counts only where CSS is
 * being written: the value of a colour-bearing property (`color: white`,
 * `backgroundColor: 'red'`, `fill="white"`), or inside a gradient, `color-mix`
 * or `drop-shadow`. A `white` in a comment or in a sentence is not one.
 */
const DECLARATION = new RegExp(
  '(?<![\\w-])(?:(?:[a-z]+-)*(?:color|background|border|outline|shadow|fill|stroke|mask)(?:-[a-z]+)*' +
    '|[a-z]+(?:Color|Background|Border|Outline|Shadow|Fill|Stroke|Mask)\\w*)' +
    '\\s*[:=]\\s*(?:\\{\\s*)?(?:([\'"`])([^\'"`\\n]*)\\1|([^;}\\n]*))',
  'g',
);
const COLOUR_ARGUMENTS = /(?<![\w-])(?:(?:repeating-)?(?:linear|radial|conic)-gradient|color-mix|drop-shadow)\([^;\n]*/g;

/** The source with every comment blanked to spaces, so offsets and line numbers still line up. */
function withoutComments(source: string): string {
  const blank = (text: string) => text.replace(/[^\n]/g, ' ');
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(?<![:\w"'`])\/\/[^\n]*/g, blank);
}

function namedColours(source: string): Hit[] {
  const code = withoutComments(source);
  const found = new Map<number, Hit>();
  const scan = (text: string, offset: number) => {
    for (const hit of text.matchAll(NAME)) {
      const at = offset + hit.index;
      found.set(at, { at, text: hit[1].toLowerCase(), why: 'a named colour', allowable: true });
    }
  };
  for (const declaration of code.matchAll(DECLARATION)) {
    const value = declaration[2] ?? declaration[3] ?? '';
    scan(value, declaration.index + declaration[0].length - value.length - (declaration[1] ? 1 : 0));
  }
  for (const call of code.matchAll(COLOUR_ARGUMENTS)) scan(call[0], call.index);
  return [...found.values()];
}

function lineOf(source: string, at: number): number {
  return source.slice(0, at).split('\n').length;
}

/** Everything in a source that breaks the rule, before the allowlist is applied. */
function literals(source: string): Hit[] {
  const hits: Hit[] = [];
  const add = (pattern: RegExp, why: string, allowable: boolean, text = (match: string) => match.toLowerCase()) => {
    for (const hit of source.matchAll(pattern)) hits.push({ at: hit.index, text: text(hit[0]), why, allowable });
  };
  add(HEX, 'a literal colour', true);
  add(COLOUR_FUNCTION, 'a colour function', true);
  add(FIXED_UTILITY, 'a fixed white or black utility', true);
  add(PALETTE_UTILITY, 'a default-palette utility', true);
  add(INDIGO, 'the retired indigo accent; use the accent tokens', false, (match) => match);
  hits.push(...namedColours(source));
  return hits;
}

describe('marketing and docs pictures paint from tokens', () => {
  it('has no literal colour, indigo or fixed utility outside the allowlist', () => {
    const offenders: string[] = [];
    for (const file of scanned()) {
      const source = readFileSync(join(CLIENT, file), 'utf8');
      const allowed = ALLOWED_LITERALS[file.split('\\').join('/')] ?? {};
      for (const hit of literals(source)) {
        if (hit.allowable && hit.text in allowed) continue;
        const advice = hit.allowable
          ? 'use a --ds-canvas-* / --ds-rail-* / --ds-on-accent / app token, or list it in ALLOWED_LITERALS if it depicts something that is not ours to retune'
          : '';
        offenders.push(`${relative(CLIENT, join(CLIENT, file))}:${lineOf(source, hit.at)}  ${hit.text} — ${hit.why}${advice ? `; ${advice}` : ''}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('keeps no allowlist entry that the file no longer carries', () => {
    const stale: string[] = [];
    for (const [file, entries] of Object.entries(ALLOWED_LITERALS)) {
      const path = join(CLIENT, file);
      const present = existsSync(path)
        ? new Set(literals(readFileSync(path, 'utf8')).map((hit) => hit.text))
        : new Set<string>();
      for (const literal of Object.keys(entries)) {
        if (!present.has(literal)) stale.push(`${file}  ${literal} — no longer in the file; delete the entry`);
      }
    }
    expect(stale, stale.join('\n')).toEqual([]);
  });

  it('reads a hex from an anchor or an entity, so the guard cannot go quiet or noisy', () => {
    expect(literals(`<a href="#features">`)).toEqual([]);
    expect(literals(`<a href="#blocks">`)).toEqual([]);
    expect(literals(`it&#39;s`)).toEqual([]);
    expect(literals(`color: #4F46E5;`).map((hit) => hit.text)).toEqual(['#4f46e5']);
    expect(literals(`fill="#fff"`).map((hit) => hit.text)).toEqual(['#fff']);
    expect(literals(`border: 1px solid #e8eaee80`).map((hit) => hit.text)).toEqual(['#e8eaee80']);
    expect(literals(`--indigo: var(--ds-accent);`)).toHaveLength(1);
    expect(literals(`<p className="text-rail-muted">`)).toEqual([]);
    expect(literals(`<MailIcon className="size-4 text-faint" />`)).toEqual([]);
  });

  it('reads a functional colour notation, and nothing the token layer owns', () => {
    for (const written of [
      'box-shadow: 0 0 22px rgb(242 180 92 / 0.65);',
      'border: 1px solid rgba(0, 0, 0, 0.2)',
      'background: hsl(210 40% 98%)',
      'background: HSLA(210, 40%, 98%, 0.5)',
      'fill: oklch(0.7 0.1 200)',
    ]) {
      expect(literals(written), written).toHaveLength(1);
    }
    expect(literals('box-shadow: 0 0 4px color-mix(in srgb, var(--ds-accent) 25%, transparent)')).toEqual([]);
    expect(literals('border-color: var(--ds-line)')).toEqual([]);
    expect(literals('the rgb values in a swatch')).toEqual([]);
  });

  it('reads a fixed white or black utility under any variant or opacity, and nothing like one', () => {
    for (const written of [
      'bg-accent text-white',
      'border-white',
      'hover:bg-black/50',
      'dark:text-white',
      'ring-black',
      'bg-emerald-500',
      'text-red-600',
    ]) {
      expect(literals(`<p className="${written}">`), written).toHaveLength(1);
    }
    for (const written of ['text-on-accent', 'whitespace-nowrap', 'bg-canvas', 'text-canvas-ink', 'border-line', 'text-white-ish']) {
      expect(literals(`<p className="${written}">`), written).toEqual([]);
    }
  });

  it('reads a named colour where CSS is written, and not where English is', () => {
    for (const written of [
      'color: white;',
      'box-shadow: 0 1px 2px black, 0 2px 4px red',
      `style={{ backgroundColor: 'red' }}`,
      '<rect fill="white" />',
      'maskImage: \'linear-gradient(to bottom, transparent, black 20%)\'',
      'background: linear-gradient(white, var(--ds-surface))',
    ]) {
      expect(literals(written).length, written).toBeGreaterThan(0);
    }
    for (const written of [
      '/* the white email canvas */',
      '// a near-black swatch',
      '<p>The canvas is white in both themes.</p>',
      'white-space: nowrap;',
      'color: var(--ds-ink);',
      'border: 1px solid transparent',
      'fill="currentColor"',
      'stroke="none"',
    ]) {
      expect(literals(written), written).toEqual([]);
    }
  });

  it('names the colour and the line of a named hit', () => {
    const source = `.a {\n  color: var(--ds-ink);\n  background: Tomato;\n}\n`;
    const [hit] = literals(source);
    expect(hit.text).toBe('tomato');
    expect(lineOf(source, hit.at)).toBe(3);
  });

  it('reports the line a literal sits on', () => {
    const source = `const a = 1;\nconst b = '#123456';\n`;
    const [hit] = literals(source);
    expect(lineOf(source, hit.at)).toBe(2);
  });
});
