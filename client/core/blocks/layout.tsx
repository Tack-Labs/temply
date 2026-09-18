import type { BlockItem } from './types';
import { DEFAULT_SPACER_HEIGHT } from '@/editor/nodes/spacer';
import { TextSelection } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  ColumnsIcon,
  Repeat2,
  MoveVertical,
  RectangleHorizontal,
  Minus,
} from 'lucide-react';

/**
 * Where the `columns` node that has just been inserted starts. The insert
 * leaves the caret at the end of what it wrote, which is inside the node or
 * immediately after it, so the node is the one whose span covers that
 * position rather than "the last one in the document" — a second Columns
 * added above an existing one must not answer for the first.
 */
function columnsAround(doc: ProseMirrorNode, pos: number): number | null {
  let found: number | null = null;
  doc.descendants((node, nodePos) => {
    if (found !== null || node.type.name !== 'columns') {
      return found === null;
    }
    // The caret sits at the end of the insert, so where two `columns` nodes
    // meet it is the earlier one that was just written.
    if (nodePos <= pos && pos <= nodePos + node.nodeSize) {
      found = nodePos;
    }
    return false;
  });
  return found;
}

export const columns: BlockItem = {
  title: 'Columns',
  description: 'Add columns to email.',
  searchTerms: ['layout', 'columns'],
  icon: <ColumnsIcon className="mly:h-4 mly:w-4" />,
  command: ({ editor, range }) => {
    // @ts-ignore
    editor
      .chain()
      .focus()
      .deleteRange(range)
      // @ts-ignore
      .setColumns()
      // The caret belongs in the first column, and only the transaction that
      // did the insert knows where that is: a position handed to `focus` in
      // this chain would be read while the chain is being built, against the
      // document as it stood before the columns existed. Left between the
      // columns the caret makes `isActive('columns')` false, and the block a
      // customer has just asked for offers no menu at all.
      .command(({ tr, dispatch }) => {
        const start = columnsAround(tr.doc, tr.selection.from);
        if (start !== null && dispatch) {
          // The node, then its first column, then that column's first block:
          // two positions in from the wrapper, which `near` settles onto the
          // first place text can go.
          tr.setSelection(TextSelection.near(tr.doc.resolve(start + 2)));
        }
        return true;
      })
      .run();
  },
};

export const section: BlockItem = {
  title: 'Section',
  description: 'Add a section to email.',
  searchTerms: ['layout', 'section'],
  icon: <RectangleHorizontal className="mly:h-4 mly:w-4" />,
  command: ({ editor, range }) => {
    // @ts-ignore
    editor.chain().focus().deleteRange(range).setSection().run();
  },
};

export const repeat: BlockItem = {
  title: 'Repeat',
  description: 'Loop over an array of items.',
  searchTerms: ['repeat', 'for', 'loop'],
  icon: <Repeat2 className="mly:h-4 mly:w-4" />,
  command: ({ editor, range }) => {
    // @ts-ignore
    editor.chain().focus().deleteRange(range).setRepeat().run();
  },
};

export const spacer: BlockItem = {
  title: 'Spacer',
  description: 'Add space between blocks.',
  searchTerms: ['space', 'gap', 'divider'],
  icon: <MoveVertical className="mly:h-4 mly:w-4" />,
  command: ({ editor, range }) => {
    // The attribute is a pixel count, not the toolbar's size name: passing
    // 'sm' put `height: smpx` in the stylesheet and collapsed the spacer.
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .setSpacer({ height: DEFAULT_SPACER_HEIGHT })
      .run();
  },
};

export const divider: BlockItem = {
  title: 'Divider',
  description: 'Add a horizontal divider.',
  searchTerms: ['divider', 'line'],
  icon: <Minus className="mly:h-4 mly:w-4" />,
  command: ({ editor, range }) => {
    // @ts-ignore
    editor.chain().focus().deleteRange(range).setHorizontalRule().run();
  },
};
