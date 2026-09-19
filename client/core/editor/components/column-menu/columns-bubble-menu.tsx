import { BubbleMenu } from '@tiptap/react';
import { useCallback } from 'react';
import { getRenderContainer } from '../../utils/get-render-container';
import { sticky } from 'tippy.js';
import { EditorBubbleMenuProps } from '../text-menu/text-bubble-menu';
import { isTextSelected } from '@/editor/utils/is-text-selected';
import { TooltipProvider } from '../ui/tooltip';
import { MenuToolbar } from '../ui/menu-toolbar';
import { ColumnsMenuContent } from './columns-menu-content';
import { useEditorGesture } from '@/editor/utils/use-editor-gesture';

export function ColumnsBubbleMenu(props: EditorBubbleMenuProps) {
  const { appendTo, editor } = props;

  const getReferenceClientRect = useCallback(() => {
    const renderContainer = editor && getRenderContainer(editor, 'columns');
    const rect =
      renderContainer?.getBoundingClientRect() ||
      new DOMRect(-1000, -1000, 0, 0);

    return rect;
  }, [editor]);

  // A menu answers a gesture. Until the customer has touched the canvas the
  // caret is only where `autofocus` parked it, and this menu stays down.
  const gestured = useEditorGesture(editor);

  if (!editor) {
    return null;
  }

  const bubbleMenuProps: EditorBubbleMenuProps = {
    ...props,
    shouldShow: ({ editor }) => {
      if (
        !gestured.current ||
        isTextSelected(editor) ||
        editor.isActive('section') ||
        editor.isActive('repeat') ||
        !editor.isEditable
      ) {
        return false;
      }

      return editor.isActive('columns');
    },
    tippyOptions: {
      offset: [0, 8],
      popperOptions: {
        modifiers: [{ name: 'flip', enabled: false }],
      },
      getReferenceClientRect,
      appendTo: () => appendTo?.current,
      plugins: [sticky],
      sticky: 'popper',
      maxWidth: 'auto',
    },
    pluginKey: 'columnsBubbleMenu',
  };

  return (
    <BubbleMenu {...bubbleMenuProps}>
      <TooltipProvider>
        <MenuToolbar
          editor={editor}
          label="Columns"
          className="mly:rounded-lg mly:border mly:border-gray-200 mly:bg-panel mly:p-0.5 mly:shadow-md"
        >
          <ColumnsMenuContent editor={editor} />
        </MenuToolbar>
      </TooltipProvider>
    </BubbleMenu>
  );
}
