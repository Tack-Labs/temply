import { BubbleMenu } from '@tiptap/react';

import { EditorBubbleMenuProps } from '../text-menu/text-bubble-menu';
import { useSpacerState } from './use-spacer-state';
import { TooltipProvider } from '../ui/tooltip';
import { MenuToolbar } from '../ui/menu-toolbar';
import { SpacerMenuContent } from './spacer-menu-content';
import { useEditorGesture } from '@/editor/utils/use-editor-gesture';
import { PLACED_INSIDE_THE_PANE } from '@/editor/utils/menu-placement';

export function SpacerBubbleMenu(props: EditorBubbleMenuProps) {
  const { editor } = props;

  const state = useSpacerState(editor);

  // A menu answers a gesture. Until the customer has touched the canvas the
  // caret is only where `autofocus` parked it, and this menu stays down.
  const gestured = useEditorGesture(editor);

  if (!editor) {
    return null;
  }

  const bubbleMenuProps: EditorBubbleMenuProps = {
    ...props,
    shouldShow: ({ editor }) => {
      if (!gestured.current || !editor.isEditable) {
        return false;
      }

      return editor.isActive('spacer');
    },
    tippyOptions: {
      maxWidth: '100%',
      moveTransition: 'mly:transform 0.15s mly:ease-out',
      // A spacer sits flush against the block above it, so the default
      // placement drops the toolbar onto that block — usually straight onto a
      // button. The spacer's own band is empty, so a negative distance pulls
      // the toolbar down into it. Capped at the toolbar's own height so a thin
      // spacer does not push it into whatever follows.
      offset: [0, -Math.min(state.currentHeight, 34)] as [number, number],
      popperOptions: {
        modifiers: PLACED_INSIDE_THE_PANE,
      },
    },
  };

  return (
    <BubbleMenu {...bubbleMenuProps}>
      <TooltipProvider>
        <MenuToolbar
          editor={editor}
          label="Spacer"
          className="mly:flex mly:gap-0.5 mly:rounded-lg mly:border mly:border-gray-200 mly:bg-panel mly:p-0.5 mly:shadow-md"
        >
          <SpacerMenuContent editor={editor} />
        </MenuToolbar>
      </TooltipProvider>
    </BubbleMenu>
  );
}
