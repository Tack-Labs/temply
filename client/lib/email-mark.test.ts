import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { JSONContent } from '@tiptap/core';
import { EMAIL_ICON_SRC, EMAIL_MARK_SRC } from './email-mark';
import { STARTER_TEMPLATES } from './starter-templates';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, '..', 'public');
const file = (src: string) => readFileSync(join(PUBLIC, src));

const logos = (node: JSONContent): JSONContent[] => [
  ...(node.type === 'logo' ? [node] : []),
  ...(node.content ?? []).flatMap(logos),
];

describe('the logo new emails start with', () => {
  it('is a small, square PNG, since the blocks that show it give it one number for width and height', () => {
    const png = file(EMAIL_MARK_SRC);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(png.readUInt32BE(20));
    // Every email that shows it fetches it, and 2x of the largest block size is 128px.
    expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(128);
    expect(png.length).toBeLessThan(20 * 1024);
  });

  it('is the logo in every starter and in the editor\'s default document', () => {
    for (const starter of STARTER_TEMPLATES) {
      expect(logos(starter.content).map((logo) => logo.attrs?.src), starter.name).toEqual([EMAIL_MARK_SRC]);
    }
    const document = JSON.parse(readFileSync(join(HERE, 'default-editor-json.json'), 'utf8')) as JSONContent;
    expect(logos(document).map((logo) => logo.attrs?.src)).toEqual([EMAIL_MARK_SRC]);
  });
});

describe('the icon for a slot under 24px', () => {
  // The brand's minimum size for the mark is 24px tall; below it the pack says
  // to use its 32 and 16px app icon files. The inline image starts at 20px.
  it('is a 32 by 32 PNG', () => {
    const png = file(EMAIL_ICON_SRC);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([32, 32]);
  });

  it('is what the slash menu\'s inline image starts with, and the retired violet tile is not', () => {
    const source = readFileSync(join(HERE, '..', 'core', 'blocks', 'image.tsx'), 'utf8');
    expect(source).toContain('src: EMAIL_ICON_SRC');
    expect(source).not.toContain('/brand/mark.png');
  });
});

// Mail already delivered loads these two by URL, and a re-render in place once
// changed the logo in messages people had received. They can go when the
// versions apps pinned before the new logo have passed their retention; remove
// the entries here in the same change.
describe('the earlier logos that delivered mail still loads', () => {
  const FROZEN: Record<string, string> = {
    'brand/mark.png': '40372dafa32119a1ac4024dbf7fb7b72c327071730f1d7a0ae88b51f950a7608',
    'brand/logo.png': '40372dafa32119a1ac4024dbf7fb7b72c327071730f1d7a0ae88b51f950a7608',
  };
  for (const [path, hash] of Object.entries(FROZEN)) {
    it(`${path} is byte for byte what it was`, () => {
      expect(createHash('sha256').update(file(path)).digest('hex')).toBe(hash);
    });
  }
});
