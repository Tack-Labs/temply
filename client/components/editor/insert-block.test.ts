import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import type { Editor, JSONContent } from '@tiptap/core';
import type { BlockItem, CommandProps } from '~/core/blocks/types';
import { DEFAULT_SLASH_COMMANDS } from '~/core/editor/extensions/slash-command/default-slash-commands';
import { makeEditor } from '../../core/editor/test/make-editor';
import { blockLabel, insertBlockBelowSelection } from './insert-block';

const editors: Editor[] = [];
type Frame = () => void;
let frames: Frame[] = [];
let scrolled: { target: Element; options: ScrollIntoViewOptions }[] = [];
const realFrame = globalThis.requestAnimationFrame;
const realScroll = Element.prototype.scrollIntoView;

// The reveal waits a frame for a node view to have a size, and happy-dom has
// no layout, so what is asserted is that it asked, and of which block. Frames
// are held here and run by hand; tiptap's own focus queues one too, so a test
// reads only the frames that came after the block's command.
beforeEach(() => {
  frames = [];
  scrolled = [];
  globalThis.requestAnimationFrame = ((callback: Frame) => frames.push(callback)) as unknown as typeof requestAnimationFrame;
  Element.prototype.scrollIntoView = function (this: Element, options?: boolean | ScrollIntoViewOptions) {
    scrolled.push({ target: this, options: typeof options === 'object' ? options : {} });
  };
});

afterEach(() => {
  globalThis.requestAnimationFrame = realFrame;
  Element.prototype.scrollIntoView = realScroll;
  while (editors.length) editors.pop()?.destroy();
});

const paragraph = (text: string): JSONContent => ({ type: 'paragraph', content: [{ type: 'text', text }] });

function editorWith(...texts: string[]) {
  const editor = makeEditor({ type: 'doc', content: texts.map(paragraph) });
  editors.push(editor);
  return editor;
}

const types = (editor: Editor) => editor.getJSON().content?.map((node) => node.type);
const texts = (editor: Editor) =>
  editor.getJSON().content?.map((node) => node.content?.map((child) => child.text).join('') ?? '');

const library = DEFAULT_SLASH_COMMANDS[0].commands;
const real = (title: string) => library.find((block) => block.title === title) as BlockItem;

/**
 * A block whose command is a spy that also records the document it was handed
 * and leaves the selection where it found it, inside the empty paragraph the
 * insert made for it. Pass a real block to have the spy delegate to it.
 */
function probe(delegate?: BlockItem) {
  const seen: { doc: JSONContent; range: CommandProps['range']; from: number; frame: number }[] = [];
  const command = mock((options: CommandProps) => {
    seen.push({
      doc: options.editor.getJSON(),
      range: options.range,
      from: options.editor.state.selection.from,
      frame: frames.length,
    });
    delegate?.command?.(options);
  });
  return { block: { title: 'Probe', searchTerms: [], command } as BlockItem, command, seen };
}

describe('insertBlockBelowSelection', () => {
  it('puts the block below the top-level block the caret is in, not beside the caret', () => {
    const editor = editorWith('One', 'Two');
    // Inside "One", between its letters.
    editor.commands.setTextSelection(3);
    insertBlockBelowSelection(editor, real('Divider'));
    expect(types(editor)).toEqual(['paragraph', 'horizontalRule', 'paragraph']);
    expect(texts(editor)?.[0]).toBe('One');
    expect(texts(editor)?.at(-1)).toBe('Two');
  });

  it('follows the caret to a later block', () => {
    const editor = editorWith('One', 'Two');
    editor.commands.setTextSelection(7);
    insertBlockBelowSelection(editor, real('Divider'));
    // The divider leaves a paragraph after itself to type into.
    expect(types(editor)).toEqual(['paragraph', 'paragraph', 'horizontalRule', 'paragraph']);
    expect(texts(editor)).toEqual(['One', 'Two', '', '']);
  });

  it('puts the block at the end of the document when nothing has a caret', () => {
    const editor = editorWith('One', 'Two');
    // A selection of the whole document has no depth to be below.
    editor.commands.selectAll();
    expect(editor.state.selection.$from.depth).toBe(0);
    insertBlockBelowSelection(editor, real('Divider'));
    expect(types(editor)).toEqual(['paragraph', 'paragraph', 'horizontalRule', 'paragraph']);
    expect(texts(editor)).toEqual(['One', 'Two', '', '']);
  });

  it('makes an empty paragraph for the command to turn into the block, and hands it a collapsed range there', () => {
    const editor = editorWith('One', 'Two');
    editor.commands.setTextSelection(2);
    const { block, command, seen } = probe();
    insertBlockBelowSelection(editor, block);

    expect(command).toHaveBeenCalledTimes(1);
    const [call] = seen;
    // The paragraph is already in the document, between the two, and the caret
    // is in it: the command gets a position, not a node.
    expect(call.doc.content?.map((node) => node.type)).toEqual(['paragraph', 'paragraph', 'paragraph']);
    expect(call.doc.content?.[1].content).toBeUndefined();
    expect(call.range.from).toBe(call.range.to);
    expect(call.from).toBe(call.range.from);
    const handed = (command.mock.calls[0][0] as CommandProps).editor;
    expect(handed).toBe(editor);
  });

  it('lets the command decide what the paragraph becomes', () => {
    const editor = editorWith('One');
    editor.commands.setTextSelection(2);
    const { block } = probe(real('Divider'));
    insertBlockBelowSelection(editor, block);
    expect(types(editor)).toContain('horizontalRule');
  });

  it('does nothing for an item that is a group, which has no command to run', () => {
    const editor = editorWith('One');
    editor.commands.setTextSelection(2);
    const before = JSON.stringify(editor.getJSON());
    insertBlockBelowSelection(editor, { id: 'group', title: 'Group', searchTerms: [], commands: [] });
    expect(JSON.stringify(editor.getJSON())).toBe(before);
    // Nor does it ask for anything to be revealed.
    expect(scrolled).toHaveLength(0);
    for (const frame of frames) frame();
    expect(scrolled).toHaveLength(0);
  });

  it('asks for the block to be brought into view, a frame after the command, and not before', () => {
    const editor = editorWith('One', 'Two');
    editor.commands.setTextSelection(2);
    const { block, seen } = probe();
    insertBlockBelowSelection(editor, block);

    // The command ran with nothing yet queued for the reveal; one frame was
    // asked for after it. Nothing has moved until the frame runs.
    const queuedBefore = seen[0].frame;
    expect(frames.length - queuedBefore).toBe(1);
    expect(scrolled).toHaveLength(0);

    for (const frame of frames) frame();
    expect(scrolled).toHaveLength(1);
    // The new block is the second of three, and is centred.
    expect(scrolled[0].target).toBe(editor.view.dom.children[1]);
    expect(scrolled[0].options.block).toBe('center');
  });
});

describe('blockLabel', () => {
  it('says what a customer would say for the three titles the editor names differently', () => {
    expect(blockLabel('Heading 1')).toBe('Heading');
    expect(blockLabel('Heading 2')).toBe('Subheading');
    expect(blockLabel('Repeat')).toBe('Repeating list');
  });

  it('leaves every other title as it is', () => {
    for (const title of ['Text', 'Image', 'Logo', 'Button', 'Columns', 'Divider', 'Spacer', 'Section']) {
      expect(blockLabel(title)).toBe(title);
    }
  });

  it('labels every block the rails offer', () => {
    const labels = ['Text', 'Heading 1', 'Heading 2', 'Image', 'Logo', 'Button', 'Columns', 'Divider', 'Spacer', 'Section', 'Repeat']
      .map((title) => blockLabel(real(title).title));
    expect(labels).toEqual([
      'Text', 'Heading', 'Subheading', 'Image', 'Logo', 'Button', 'Columns', 'Divider', 'Spacer', 'Section', 'Repeating list',
    ]);
  });
});
