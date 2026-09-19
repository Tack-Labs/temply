import { ColumnExtension } from '@/editor/nodes/columns/column';
import { ColumnsExtension } from '@/editor/nodes/columns/columns';
import { SectionExtension } from '@/editor/nodes/section/section';
import { isCustomNodeSelected } from '@/editor/utils/is-custom-node-selected';
import { isTextSelected } from '@/editor/utils/is-text-selected';
import { BubbleMenu, BubbleMenuProps } from '@tiptap/react';
import { LucideIcon } from 'lucide-react';
import { SVGIcon } from '../icons/grid-lines';
import { Divider } from '../ui/divider';
import { TooltipProvider } from '../ui/tooltip';
import { MenuToolbar } from '../ui/menu-toolbar';
import { TextBubbleContent } from './text-bubble-content';
import { RepeatExtension } from '@/editor/nodes/repeat/repeat';
import { TurnIntoBlock } from './turn-into-block';
import { useTurnIntoBlockOptions } from './use-turn-into-block-options';

export interface BubbleMenuItem {
  name?: string;
  isActive?: () => boolean;
  command?: () => void;
  shouldShow?: () => boolean;
  icon?: LucideIcon | SVGIcon;
  className?: string;
  iconClassName?: string;
  nameClassName?: string;
  disbabled?: boolean;

  tooltip?: string;
}

export type EditorBubbleMenuProps = Omit<BubbleMenuProps, 'children'> & {
  // Vendor plumbing (maily): the same field carries the ref callers hand in
  // AND the unwrapped `.current` element spread back in below — only `any`
  // satisfies both shapes without restructuring the pass-through.
  appendTo?: React.RefObject<any>;
};

/**
 * This menu takes no `appendTo`: it hangs off `document.body` and nothing
 * else, for the reason given at the option below. A ref passed here would ride
 * through the spread to `<BubbleMenu>`, where nothing reads it — the silent
 * no-op that clipped Turn into in the first place.
 */
type TextBubbleMenuProps = Omit<EditorBubbleMenuProps, 'appendTo'>;

export function TextBubbleMenu(props: TextBubbleMenuProps) {
  const { editor } = props;

  const turnIntoBlockOptions = useTurnIntoBlockOptions(editor);

  if (!editor) {
    return null;
  }

  const bubbleMenuProps: TextBubbleMenuProps = {
    ...props,
    pluginKey: 'text-menu',
    shouldShow: ({ editor, from, view }) => {
      if (!view || editor.view.dragging) {
        return false;
      }

      const domAtPos = view.domAtPos(from || 0).node as HTMLElement;
      const nodeDOM = view.nodeDOM(from || 0) as HTMLElement;
      const node = nodeDOM || domAtPos;

      if (isCustomNodeSelected(editor, node) || !editor.isEditable) {
        return false;
      }

      const nestedNodes = [
        RepeatExtension.name,
        SectionExtension.name,
        ColumnsExtension.name,
        ColumnExtension.name,
      ];

      const isNestedNodeSelected =
        nestedNodes.some((name) => editor.isActive(name)) &&
        node?.classList?.contains('ProseMirror-selectednode');
      return isTextSelected(editor) && !isNestedNodeSelected;
    },
    tippyOptions: {
      // This menu hangs off the page rather than off the editor's pane, and
      // it is the only one that has to: the popovers it opens are taller
      // than it is, and the Content card clips what leaves it — starting
      // well above the canvas, behind the header and the preflight panel.
      // A Turn into opened on the one-line document every new template
      // starts from flips upwards for want of room below, and inside the
      // pane its first rows were cut off where no click could reach them.
      // The popovers stay inside this menu, so they still take their type
      // from it rather than from the heading the caret is in.
      appendTo: () => document.body,
      popperOptions: {
        placement: 'top-start',
        modifiers: [
          {
            name: 'preventOverflow',
            options: {
              boundary: 'viewport',
              padding: 8,
            },
          },
          {
            name: 'flip',
            options: {
              fallbackPlacements: ['bottom-start', 'top-end', 'bottom-end'],
            },
          },
        ],
      },
      maxWidth: '100%',
    },
  };

  return (
    <BubbleMenu {...bubbleMenuProps}>
      <TooltipProvider>
        <MenuToolbar
          editor={editor}
          label="Text formatting"
          className="mly:flex mly:gap-0.5 mly:rounded-lg mly:border mly:border-gray-200 mly:bg-panel mly:p-0.5 mly:shadow-md"
        >
          <TurnIntoBlock options={turnIntoBlockOptions} />

          <Divider className="mly:mx-0" />

          <TextBubbleContent editor={editor} />
        </MenuToolbar>
      </TooltipProvider>
    </BubbleMenu>
  );
}
