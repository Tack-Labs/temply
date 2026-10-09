import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buttonVariants } from './button';

/**
 * The close button is absolutely placed and takes up no room, so nothing but
 * the header's padding stops a long title running underneath it. On a coarse
 * pointer it grows to 44px and moves in by 8px, and a dialog that pads itself
 * with p-4 has 4px less to spare than the default p-5.
 *
 * This reads the source instead of mounting a Dialog: Radix picks its
 * layout-effect hook when it first loads, and without a document that hook
 * does nothing, so its Portal never mounts. theme-warnings.test.ts loads
 * Popover ahead of every component test here with no DOM yet, which leaves a
 * mounted Dialog empty.
 */
const CLIENT = join(import.meta.dir, '..', '..');
const SOURCE = readFileSync(join(import.meta.dir, 'dialog.tsx'), 'utf8');

/** Tailwind's spacing unit: `p-4` is 16px. */
const UNIT = 4;

/** The pixel value of the first class that starts with `prefix`, e.g. `p-` in `p-4`. */
function space(classes: string, prefix: string): number {
  const found = classes
    .split(/\s+/)
    .find((name) => name.startsWith(prefix) && /^\d+(\.\d+)?$/.test(name.slice(prefix.length)));
  if (!found) throw new Error(`no ${prefix}N in: ${classes}`);
  return Number(found.slice(prefix.length)) * UNIT;
}

/** The string literal that follows `marker` in dialog.tsx. */
function literalAfter(marker: string): string {
  const at = SOURCE.indexOf(marker);
  if (at === -1) throw new Error(`dialog.tsx no longer contains: ${marker}`);
  return /'([^']*)'/.exec(SOURCE.slice(at))![1]!;
}

const contentClasses = literalAfter("'dialog-pop");
const headerClasses = literalAfter("'flex flex-col gap-1");
const closeClasses = /<Button variant="ghost" size="icon-sm" touch className="([^"]*)"/.exec(SOURCE)?.[1] ?? '';
const buttonClasses = buttonVariants({ size: 'icon-sm', touch: true });

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) yield path;
  }
}

/** The padding every dialog in the app ends up with: the default, and each `p-N` a call site swaps in. */
function paddings(): Map<number, string[]> {
  const found = new Map<number, string[]>([[space(contentClasses, 'p-'), ['the default in dialog.tsx']]]);
  for (const root of ['app', 'components']) {
    for (const file of walk(join(CLIENT, root))) {
      const source = readFileSync(file, 'utf8');
      for (const hit of source.matchAll(/<DialogContent\b[^>]*?className="([^"]*)"/g)) {
        const override = /(?<![\w-])p-(\d+(?:\.\d+)?)(?![\w-])/.exec(hit[1]!);
        if (!override) continue;
        const px = Number(override[1]) * UNIT;
        found.set(px, [...(found.get(px) ?? []), relative(CLIENT, file)]);
      }
    }
  }
  return found;
}

describe('Dialog close button', () => {
  it('reads the geometry it is checked against', () => {
    expect(closeClasses).toContain('pointer-coarse:right-2');
    expect(buttonClasses).toContain('pointer-coarse:size-11');
    expect(space(buttonClasses, 'pointer-coarse:size-')).toBe(44);
    expect(space(headerClasses, 'pointer-coarse:pr-')).toBe(48);
  });

  it('keeps 12px or more between a title and the 44px close button, whatever the dialog pads itself with', () => {
    const buttonLeftEdge = space(closeClasses, 'pointer-coarse:right-') + space(buttonClasses, 'pointer-coarse:size-');
    expect(buttonLeftEdge).toBe(52);
    const tight: string[] = [];
    for (const [padding, where] of paddings()) {
      const clear = padding + space(headerClasses, 'pointer-coarse:pr-') - buttonLeftEdge;
      if (clear < 12) tight.push(`p-${padding / UNIT} leaves ${clear}px (${where.join(', ')})`);
    }
    expect(tight, tight.join('\n')).toEqual([]);
  });

  it('finds the compact dialogs that override the padding, so the check above covers them', () => {
    const found = paddings();
    expect([...found.keys()].sort((a, b) => a - b)).toEqual([20, 24]);
    expect(found.get(20)!.length).toBeGreaterThanOrEqual(5);
  });

  // The compact dialogs have only 4px to spare here, no overlap but no more.
  it('keeps the title out from under the 28px button on a fine pointer', () => {
    const buttonLeftEdge = space(closeClasses, 'right-') + space(buttonClasses, 'size-');
    expect(buttonLeftEdge).toBe(48);
    for (const padding of paddings().keys()) {
      expect(padding + space(headerClasses, 'pr-') - buttonLeftEdge).toBeGreaterThanOrEqual(4);
    }
  });
});
