import { updateAttributes } from '@/editor/utils/update-attribute';
import { selectedNodeOfType } from '@/editor/utils/selected-node';
import { Command, Node, mergeAttributes } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';

export const DEFAULT_COLUMN_WIDTH = 'auto';

export type AllowedColumnVerticalAlign = 'top' | 'middle' | 'bottom';
export const DEFAULT_COLUMN_VERTICAL_ALIGN: AllowedColumnVerticalAlign = 'top';

interface ColumnAttributes {
  verticalAlign: AllowedColumnVerticalAlign;
  backgroundColor: string;
  borderRadius: number;
  align: string;
  borderWidth: number;
  borderColor: string;

  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;

  showIfKey: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    column: {
      updateColumn: (attrs: Partial<ColumnAttributes>) => ReturnType;
    };
  }
}

export const ColumnExtension = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,

  addAttributes() {
    return {
      columnId: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('data-column-id') || uuidv4(),
        renderHTML: (attributes) => {
          if (!attributes.columnId) {
            return {
              'data-column-id': uuidv4(),
            };
          }

          return {
            'data-column-id': attributes.columnId,
          };
        },
      },
      width: {
        default: DEFAULT_COLUMN_WIDTH,
        parseHTML: (element) =>
          element.style.width.replace(/['"]+/g, '') || DEFAULT_COLUMN_WIDTH,
        renderHTML: (attributes) => {
          if (!attributes.width || attributes.width === DEFAULT_COLUMN_WIDTH) {
            return {};
          }

          return {
            style: `width: ${attributes.width}%;max-width:${attributes.width}%`,
          };
        },
      },
      verticalAlign: {
        default: DEFAULT_COLUMN_VERTICAL_ALIGN,
        parseHTML: (element) => element?.style?.verticalAlign || 'top',
        renderHTML: (attributes) => {
          const { verticalAlign } = attributes;
          if (
            !verticalAlign ||
            verticalAlign === DEFAULT_COLUMN_VERTICAL_ALIGN
          ) {
            return {};
          }

          if (verticalAlign === 'middle') {
            return {
              style: `display: flex;flex-direction: column;justify-content: center;`,
            };
          } else if (verticalAlign === 'bottom') {
            return {
              style: `display: flex;flex-direction: column;justify-content: flex-end;`,
            };
          }
        },
      },
    };
  },

  addCommands() {
    return {
      // `updateAttributes` resolves a selection to "the last node of this
      // type inside it", which for a caret in one column is that column —
      // right — but for the `columns` wrapper itself node-selected (a
      // NodeSelection spanning the whole block, not a caret inside one
      // column) silently picks whichever column sorts last, changing one
      // column while the control reads as acting on the whole block.
      // Selecting the wrapper means the whole block was selected, so the
      // write fans out to every column in it instead; a single `column`
      // active keeps writing to just that one.
      updateColumn: (attrs) =>
        ((props) => {
          const { tr, state, dispatch } = props;
          const columns = selectedNodeOfType(state, 'columns');
          if (columns) {
            if (dispatch) {
              let pos = state.selection.from + 1;
              columns.forEach((child) => {
                tr.setNodeMarkup(pos, null, { ...child.attrs, ...attrs });
                pos += child.nodeSize;
              });
              dispatch(tr);
            }
            return true;
          }
          return updateAttributes(this.name, attrs)(props);
        }) satisfies Command,
    };
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'column',
        class: 'hide-scrollbars',
      }),
      0,
    ];
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="column"]',
      },
    ];
  },
});
