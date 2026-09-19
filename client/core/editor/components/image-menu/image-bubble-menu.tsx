import { BubbleMenu } from '@tiptap/react';
import { sticky } from 'tippy.js';
import { EditorBubbleMenuProps } from '../text-menu/text-bubble-menu';
import { TooltipProvider } from '../ui/tooltip';
import { MenuToolbar } from '../ui/menu-toolbar';
import { ImageMenuContent } from './image-menu-content';
import { useEditorGesture } from '@/editor/utils/use-editor-gesture';
import { PLACED_INSIDE_THE_PANE } from '@/editor/utils/menu-placement';

export function ImageBubbleMenu(props: EditorBubbleMenuProps) {
  const { editor } = props;

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

      return editor.isActive('logo') || editor.isActive('image');
    },
    tippyOptions: {
      popperOptions: {
        modifiers: PLACED_INSIDE_THE_PANE,
      },
      plugins: [sticky],
      sticky: 'popper',
      maxWidth: '100%',
    },
  };

  return (
    <BubbleMenu {...bubbleMenuProps}>
      <TooltipProvider>
        <MenuToolbar
          editor={editor}
          label="Image"
          className="mly:flex mly:rounded-lg mly:border mly:border-gray-200 mly:bg-panel mly:p-0.5 mly:shadow-md"
        >
          <ImageMenuContent editor={editor} />
        </MenuToolbar>
      </TooltipProvider>
    </BubbleMenu>
  );
}
