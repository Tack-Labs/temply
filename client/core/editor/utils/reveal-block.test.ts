import { afterEach, describe, expect, it, mock } from 'bun:test';
import '../test/dom';
import { makeEditor } from '../test/make-editor';
import { revealInsertedBlock } from './reveal-block';

const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] };
const box = (top: number, bottom: number) => () => ({ top, bottom, height: bottom - top }) as DOMRect;
const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));

const realScrollIntoView = HTMLElement.prototype.scrollIntoView;
afterEach(() => {
  HTMLElement.prototype.scrollIntoView = realScrollIntoView;
});

/**
 * An editor whose first block sits at `block` on screen, inside a scroller
 * (unless `scroller` is null) that spans `scroller`. Resolves to whether the
 * block was scrolled into view.
 */
async function scrolled({ block, scroller }: { block: [number, number]; scroller: [number, number] | null }) {
  const editor = makeEditor(doc);
  try {
    const calls = mock((_options?: boolean | ScrollIntoViewOptions) => {});
    HTMLElement.prototype.scrollIntoView = calls;
    const paragraph = editor.view.nodeDOM(0) as HTMLElement;
    paragraph.getBoundingClientRect = box(...block);
    const holder = editor.view.dom.parentElement as HTMLElement;
    if (scroller) {
      holder.style.overflowY = 'auto';
      holder.getBoundingClientRect = box(...scroller);
    }
    revealInsertedBlock(editor);
    await frame();
    await frame();
    return calls.mock.calls.length > 0;
  } finally {
    editor.destroy();
  }
}

describe('revealInsertedBlock', () => {
  it('leaves a block alone that is inside the canvas the customer scrolls', async () => {
    expect(await scrolled({ block: [200, 260], scroller: [100, 600] })).toBe(false);
  });

  it('brings a block into view that is below the canvas, though the window reaches that far', async () => {
    // The window is taller than the canvas in the framed editor: the header, the
    // tabs and the workflow bar are above it. Measured against the window, a
    // block under the canvas's foot would count as in view.
    expect(await scrolled({ block: [620, 680], scroller: [100, 600] })).toBe(true);
  });

  it('brings a block into view that is too near the canvas top for its menu', async () => {
    expect(await scrolled({ block: [120, 180], scroller: [100, 600] })).toBe(true);
  });

  it('measures against the window when nothing around the editor scrolls', async () => {
    expect(await scrolled({ block: [200, 260], scroller: null })).toBe(false);
    expect(await scrolled({ block: [20, 60], scroller: null })).toBe(true);
    expect(await scrolled({ block: [window.innerHeight + 10, window.innerHeight + 60], scroller: null })).toBe(true);
  });
});
