import { isTextSelected } from '@/editor/utils/is-text-selected';
import { BubbleMenu, findChildren } from '@tiptap/react';
import { useCallback, useEffect, useRef } from 'react';
import { sticky, type Instance } from 'tippy.js';
import { getRenderContainer } from '../../utils/get-render-container';
import { EditorBubbleMenuProps } from '../text-menu/text-bubble-menu';
import { TooltipProvider } from '../ui/tooltip';
import { getClosestNodeByName } from '@/editor/utils/columns';
import { SectionMenuContent } from './section-menu-content';

export function SectionBubbleMenu(props: EditorBubbleMenuProps) {
  const { appendTo, editor } = props;
  if (!editor) {
    return null;
  }

  const getReferenceClientRect = useCallback(() => {
    const renderContainer = getRenderContainer(editor!, 'section');
    const rect =
      renderContainer?.getBoundingClientRect() ||
      new DOMRect(-1000, -1000, 0, 0);

    return rect;
  }, [editor]);

  // A Repeat inside the section, with the caret in it, wants the same spot
  // above the block that this menu does. Hiding this one — the old answer —
  // left the section with no menu at all once the Repeat was its only
  // child, since every caret position is then inside the Repeat. The menu
  // moves to the section's bottom edge instead, and the two share the block.
  const repeatIsActiveInside = (e: NonNullable<typeof editor>) => {
    const section = getClosestNodeByName(e, 'section');
    const repeatChild = section ? findChildren(section.node, (node) => node.type.name === 'repeat')[0] : null;
    return !!repeatChild && e.isActive('repeat');
  };

  // Placement follows the caret, not the show: the menu is usually already
  // up when the caret moves into the nested block, so a show-time hook would
  // be too late. Every transaction re-asks; setProps is a no-op when unchanged.
  const tippyRef = useRef<Instance | null>(null);
  useEffect(() => {
    const place = () => {
      const placement = repeatIsActiveInside(editor) ? 'bottom' : 'top';
      const instance = tippyRef.current;
      if (instance && instance.props.placement !== placement) instance.setProps({ placement });
    };
    editor.on('transaction', place);
    return () => {
      editor.off('transaction', place);
    };
  }, [editor]);

  const bubbleMenuProps: EditorBubbleMenuProps = {
    ...props,
    ...(appendTo ? { appendTo: appendTo.current } : {}),
    shouldShow: ({ editor }) => {
      const activeSectionNode = getClosestNodeByName(editor, 'section');
      const inlineImageNodeChildren = activeSectionNode
        ? findChildren(activeSectionNode?.node, (node) => {
            return node.type.name === 'inlineImage';
          })?.[0]
        : null;
      const hasActiveInlineImageNodeChildren =
        inlineImageNodeChildren && editor.isActive('inlineImage');

      if (
        isTextSelected(editor) ||
        hasActiveInlineImageNodeChildren ||
        !editor.isEditable
      ) {
        return false;
      }

      return editor.isActive('section');
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
    pluginKey: 'sectionBubbleMenu',
  };

  return (
    <BubbleMenu
      {...bubbleMenuProps}
      className="mly:flex mly:items-stretch mly:rounded-lg mly:border mly:border-gray-200 mly:bg-panel mly:p-0.5 mly:shadow-md"
    >
      <TooltipProvider>
        <SectionMenuContent editor={editor} />
      </TooltipProvider>
    </BubbleMenu>
  );
}
