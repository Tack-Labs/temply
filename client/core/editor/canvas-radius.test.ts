import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `mly:rounded-md` reads the editor's own radius scale (--mly-radius-md, 10px,
 * set in core/styles/index.css for the panels and popovers around the page).
 * The email draws its corners from literals in render/engine.tsx, so a canvas
 * element that borrows a scale step is wrong by however far the two have
 * drifted, and nothing on screen says so. Canvas elements name their radius
 * as a literal (`rounded-[6px]`), `rounded-none` or `rounded-full`.
 *
 * Only the files below are checked: the nodes and menus beside them are chrome,
 * and use the scale on purpose. This reads the source because a mounted editor
 * has no way to tell a scale step from a literal that happens to match it.
 */
const CORE = join(import.meta.dir, '..');
const read = (path: string) => readFileSync(join(CORE, path), 'utf8');

/** A corner utility that resolves through the scale: a named size, or the bare default. */
const SCALE = /mly:(?:[\w-]+:)*rounded(?:-(?:t|r|b|l|s|e|tl|tr|bl|br|ss|se|es|ee))?(?:-(?:xs|sm|md|lg|xl|2xl|3xl|4xl))?(?![\w[-])/g;

const scaleUtilities = (source: string) => source.match(SCALE) ?? [];

/** The first string literal containing `anchor`, so a file that mixes canvas and chrome can be checked in part. */
function literalContaining(source: string, anchor: string): string {
  const found = source.match(new RegExp(`'[^'\\n]*${anchor}[^'\\n]*'`));
  if (!found) throw new Error(`no class string containing ${anchor}`);
  return found[0];
}

describe('the scale pattern', () => {
  it('catches every spelling that resolves through the scale', () => {
    for (const utility of ['mly:rounded', 'mly:rounded-sm', 'mly:rounded-md', 'mly:rounded-lg', 'mly:rounded-xl', 'mly:rounded-t-lg', 'mly:rounded-md!', 'mly:hover:rounded-md']) {
      expect(scaleUtilities(`class="a ${utility} b"`), utility).toHaveLength(1);
    }
  });

  it('lets a literal, square and pill corner through', () => {
    for (const utility of ['mly:rounded-[6px]', 'mly:rounded-t-[10px]', 'mly:rounded-none', 'mly:rounded-none!', 'mly:rounded-full', 'mly:rounded-full!']) {
      expect(scaleUtilities(`class="a ${utility} b"`), utility).toEqual([]);
    }
  });
});

describe('canvas elements keep the email radii, not the editor scale', () => {
  it('draws the inline code span with a literal radius', () => {
    expect(scaleUtilities(read('editor/extensions/temply-kit.tsx'))).toEqual([]);
  });

  it('draws the link card, its image and its badge with literal radii', () => {
    expect(scaleUtilities(read('editor/nodes/link-card.tsx'))).toEqual([]);
  });

  it("starts the button from the renderer's square corner", () => {
    const base = literalContaining(read('editor/nodes/button/button-view.tsx'), 'mly:inline-flex mly:items-center');
    expect(scaleUtilities(base)).toEqual([]);
    expect(base).toContain('mly:rounded-none');
  });
});
