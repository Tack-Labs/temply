import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Button's default size is `md`, the 48px page-level control the redesign
 * draws, where the 32px control every older surface was built around is now
 * `compact`. A `<Button>` with no `size` therefore renders at 48px, which is
 * right for a call to action on a restyled page and wrong in a dense row, a
 * dialog footer or beside a hand-rolled 40px field. So the choice is written
 * down at every call site: a surface nobody has restyled says
 * `size="compact"`, and a bare Button is allowed only where the board draws a
 * 48px control, listed below with where it is drawn. A new bare Button fails
 * here rather than landing at 48px unnoticed.
 */
const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['app', 'components', 'core', 'hooks', 'lib'];

/**
 * Files whose bare Buttons are deliberate, and how many. The count is pinned
 * so a second bare Button in a listed file fails too, and so an entry cannot
 * outlive the Button it excuses.
 */
const BARE_AT_MD: Record<string, { count: number; why: string }> = {
  'components/dashboard/new-template-button.tsx': {
    count: 1,
    why: 'the primary pill in the board\'s home header (app-home.html), and the first-run empty state\'s action',
  },
  'components/dashboard/recent-templates.tsx': {
    count: 1,
    why: '"View all", a 44px link in the board\'s Recent templates row (app-home.html); its className overrides md',
  },
  'components/dashboard/starter-chips.tsx': {
    count: 1,
    why: 'the 44px starter chips (app-home.html); their className overrides md',
  },
  'components/dashboard/template-list.tsx': {
    count: 1,
    why: 'the no-match empty state\'s action, which stands where NewTemplateButton stands in the first-run empty state',
  },
  'components/dashboard/usage-section.tsx': {
    count: 1,
    why: '"Manage plan", a 44px link on the restyled Usage row; its className overrides md',
  },
  'components/ui/surfaces.tsx': {
    count: 1,
    why: 'ErrorState\'s retry, a page-level card whose button takes the default size (surfaces.test.tsx pins h-12); the card also appears inside dialogs and the phone\'s sheets, where the retry is now 48px',
  },
  'components/editor/editor-actions.tsx': {
    count: 4,
    why: 'History, Share, Send a test and Publish, the four 48px buttons in the board\'s editor header (editor.html)',
  },
};

/**
 * Whole trees someone else is still deciding: the marketing header and pages,
 * which the board draws at its own sizes. A prefix match, with no count.
 */
const DECIDED_ELSEWHERE = [
  `components${sep}header.tsx`,
  `components${sep}marketing${sep}`,
  `app${sep}(marketing)${sep}`,
];

type Hit = { at: number; text: string };

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (name.endsWith('.tsx') && !name.endsWith('.test.tsx')) yield path;
  }
}

/**
 * Where a tag or call that starts at `from` ends: the first `close` outside
 * every brace, paren and string. A `>` that follows `=` is an arrow, not the
 * end of a tag. Comments are skipped, because an apostrophe in one would
 * otherwise open a string that never closes. `top` is the same text with
 * everything inside a brace dropped, which is what an attribute name is read
 * from: a `size` inside an `onClick` is not the Button's.
 */
function scan(source: string, from: number, close: '>' | ')'): { end: number; top: string } {
  let depth = 0;
  let quote = '';
  let top = '';
  for (let i = from; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = '';
      if (depth === 0) top += char;
      continue;
    }
    if (char === '/' && source[i + 1] === '/') {
      i = source.indexOf('\n', i);
      if (i === -1) break;
      continue;
    }
    if (char === '/' && source[i + 1] === '*') {
      i = source.indexOf('*/', i) + 1;
      if (i === 0) break;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
    } else if (char === '{' || (close === ')' && char === '(')) {
      depth++;
    } else if (char === '}' || (close === ')' && char === ')' && depth > 0)) {
      depth--;
    } else if (char === close && depth === 0 && !(close === '>' && source[i - 1] === '=')) {
      return { end: i + 1, top };
    }
    if (depth === 0 || char === '{' || char === '}') top += char;
  }
  return { end: source.length, top };
}

/** Button imported from the ui primitive, by any path that ends in `/button`. */
const IMPORTS_BUTTON = /import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s*['"](?:[^'"]*\/)?button['"]/;
const IMPORTS_VARIANTS = /import\s*\{[^}]*\bbuttonVariants\b[^}]*\}\s*from\s*['"](?:[^'"]*\/)?button['"]/;

/**
 * Every `<Button>` and `buttonVariants()` that names no size. A tag that
 * spreads props is left alone: the size may arrive in them, and a wrapper that
 * forwards its props is where that is decided.
 */
export function bareButtons(source: string): Hit[] {
  const hits: Hit[] = [];
  if (IMPORTS_BUTTON.test(source)) {
    for (const open of source.matchAll(/<Button(?=[\s>/])/g)) {
      const { end, top } = scan(source, open.index + '<Button'.length, '>');
      const spreads = /\{\s*\.\.\./.test(source.slice(open.index, end));
      if (!/(?<![\w-])size\s*=/.test(top) && !spreads) hits.push({ at: open.index, text: source.slice(open.index, end) });
    }
  }
  if (IMPORTS_VARIANTS.test(source)) {
    for (const call of source.matchAll(/buttonVariants\(/g)) {
      const { end } = scan(source, call.index + call[0].length, ')');
      const args = source.slice(call.index, end);
      if (!/(?<![\w-])size\s*:/.test(args) && !args.includes('...')) hits.push({ at: call.index, text: args });
    }
  }
  return hits;
}

function lineOf(source: string, at: number): number {
  return source.slice(0, at).split('\n').length;
}

describe('a Button names its size', () => {
  it('no bare Button lands at the 48px default unless the board draws it there', () => {
    const offenders: string[] = [];
    const seen = new Map<string, number>();
    for (const root of ROOTS) {
      for (const file of walk(join(CLIENT, root))) {
        const source = readFileSync(file, 'utf8');
        if (!source.includes('Button')) continue;
        const name = relative(CLIENT, file);
        const hits = bareButtons(source);
        if (hits.length === 0 || DECIDED_ELSEWHERE.some((prefix) => name.startsWith(prefix))) continue;
        seen.set(name, hits.length);
        if (name.split(sep).join('/') in BARE_AT_MD) continue;
        for (const hit of hits) {
          offenders.push(`${name}:${lineOf(source, hit.at)}  ${hit.text.replace(/\s+/g, ' ').slice(0, 90)}`);
        }
      }
    }
    const advice = 'add size="compact" for a dense row, dialog or popover; a call to action the board draws at 48px goes in BARE_AT_MD with where it is drawn';
    expect(offenders, `${advice}\n${offenders.join('\n')}`).toEqual([]);
  });

  it('keeps BARE_AT_MD to the Buttons that are still there', () => {
    const stale: string[] = [];
    for (const [file, { count }] of Object.entries(BARE_AT_MD)) {
      const source = readFileSync(join(CLIENT, file), 'utf8');
      const found = bareButtons(source).length;
      if (found !== count) stale.push(`${file}: lists ${count} bare, found ${found}`);
    }
    expect(stale, stale.join('\n')).toEqual([]);
  });

  it('reads a tag the way JSX does, so the scan cannot go quiet', () => {
    const bare = (source: string) => bareButtons(`import { Button } from '~/components/ui/button';\n${source}`);
    expect(bare('<Button>Save</Button>')).toHaveLength(1);
    expect(bare('<Button variant="primary" onClick={() => save()} disabled={!ready}>Save</Button>')).toHaveLength(1);
    // A multi-line tag, an arrow whose `>` is not the tag's end, and a size on a later line.
    expect(bare('<Button\n  variant="ghost"\n  onClick={() => { go(); }}\n>\n  Go\n</Button>')).toHaveLength(1);
    expect(bare('<Button\n  variant="ghost"\n  onClick={() => { go(); }}\n  size="compact"\n>\n  Go\n</Button>')).toEqual([]);
    expect(bare('<Button asChild variant="link" size="md">x</Button>')).toEqual([]);
    expect(bare('<Button size={dense ? "compact" : "md"}>x</Button>')).toEqual([]);
    // A size inside a handler or in a child is not the Button's own.
    expect(bare('<Button onClick={() => open({ size: 3 })}>x</Button>')).toHaveLength(1);
    expect(bare('<Button><Icon size={4} /></Button>')).toHaveLength(1);
    // An apostrophe in a comment inside the tag opens no string.
    expect(bare("<Button\n  // it's the chip\n  onClick={go}\n>x</Button>")).toHaveLength(1);
    expect(bare("<Button\n  // it's the chip\n  size=\"compact\"\n>x</Button>")).toEqual([]);
    expect(bare('<Button {...props}>x</Button>')).toEqual([]);
    expect(bare('<ButtonGroup><Spacer /></ButtonGroup>')).toEqual([]);
    expect(bare(`const cls = buttonVariants({ variant: 'primary' });`)).toEqual([]);
  });

  it('reads a buttonVariants() call, and only where Button comes from the ui primitive', () => {
    const variants = (source: string) =>
      bareButtons(`import { buttonVariants } from '~/components/ui/button';\n${source}`);
    expect(variants(`const cls = buttonVariants({ variant: 'primary' });`)).toHaveLength(1);
    expect(variants(`const cls = buttonVariants();`)).toHaveLength(1);
    expect(variants(`const cls = buttonVariants({ variant: 'primary', size: 'compact' });`)).toEqual([]);
    expect(bareButtons(`const Button = Other;\n<Button>x</Button>`)).toEqual([]);
    expect(bareButtons(`import { Button } from './base-button';\n<Button>x</Button>`)).toEqual([]);
  });
});
