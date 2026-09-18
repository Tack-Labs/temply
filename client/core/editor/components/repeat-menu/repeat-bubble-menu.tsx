import { isTextSelected } from '@/editor/utils/is-text-selected';
import { BubbleMenu, findChildren } from '@tiptap/react';
import { useCallback, useEffect, useRef } from 'react';
import { sticky, type Instance } from 'tippy.js';
import { getRenderContainer } from '../../utils/get-render-container';
import { EditorBubbleMenuProps } from '../text-menu/text-bubble-menu';
import { TooltipProvider } from '../ui/tooltip';
import { getClosestNodeByName } from '@/editor/utils/columns';
import { RepeatMenuContent } from './repeat-menu-content';
import { useEditorGesture } from '@/editor/utils/use-editor-gesture';

export function RepeatBubbleMenu(props: EditorBubbleMenuProps) {
  const { appendTo, editor } = props;

  const getReferenceClientRect = useCallback(() => {
    const renderContainer = editor && getRenderContainer(editor, 'repeat');
    const rect =
      renderContainer?.getBoundingClientRect() ||
      new DOMRect(-1000, -1000, 0, 0);

    return rect;
  }, [editor]);

  // The mirror of the section menu's rule: a Section inside this Repeat,
  // with the caret in it, sends this menu to the bottom edge rather than
  // away, so both blocks keep a menu.
  const sectionIsActiveInside = (e: NonNullable<typeof editor>) => {
    const repeat = getClosestNodeByName(e, 'repeat');
    const sectionChild = repeat ? findChildren(repeat.node, (node) => node.type.name === 'section')[0] : null;
    return !!sectionChild && e.isActive('section');
  };

  // A menu answers a gesture. Until the customer has touched the canvas the
  // caret is only where `autofocus` parked it, and this menu stays down.
  const gestured = useEditorGesture(editor);

  // Placement follows the caret, not the show: the menu is usually already
  // up when the caret moves into the nested block, so a show-time hook would
  // be too late. Every transaction re-asks; setProps is a no-op when unchanged.
  const tippyRef = useRef<Instance | null>(null);
  useEffect(() => {
    if (!editor) return;
    const place = () => {
      const placement = sectionIsActiveInside(editor) ? 'bottom' : 'top';
      const instance = tippyRef.current;
      if (instance && instance.props.placement !== placement) instance.setProps({ placement });
    };
    editor.on('transaction', place);
    return () => {
      editor.off('transaction', place);
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  const bubbleMenuProps: EditorBubbleMenuProps = {
    ...props,
    shouldShow: ({ editor }) => {
      if (!gestured.current || isTextSelected(editor) || !editor.isEditable) {
        return false;
      }

      return editor.isActive('repeat');
    },
    tippyOptions: {
      offset: [0, 8],
      onCreate: (instance: Instance) => {
        tippyRef.current = instance;
      },
      popperOptions: {
        modifiers: [{ name: 'flip', enabled: false }],
      },
      getReferenceClientRect,
      appendTo: () => appendTo?.current,
      plugins: [sticky],
      sticky: 'popper',
      maxWidth: 'auto',
    },
    pluginKey: 'repeatBubbleMenu',
  };

  return (
    <BubbleMenu
      {...bubbleMenuProps}
      className="mly:flex mly:items-stretch mly:rounded-lg mly:border mly:border-gray-200 mly:bg-panel mly:p-0.5 mly:shadow-md"
    >
      <TooltipProvider>
        <RepeatMenuContent editor={editor} />
      </TooltipProvider>
    </BubbleMenu>
  );
}
