import { isTextSelected } from '@/editor/utils/is-text-selected';
import { BubbleMenu, findChildren } from '@tiptap/react';
import { useCallback, useEffect, useRef } from 'react';
import { sticky, type Instance } from 'tippy.js';
import { getRenderContainer } from '../../utils/get-render-container';
import { EditorBubbleMenuProps } from '../text-menu/text-bubble-menu';
import { TooltipProvider } from '../ui/tooltip';
import { getClosestNodeByName } from '@/editor/utils/columns';
import { SectionMenuContent } from './section-menu-content';
import { useEditorGesture } from '@/editor/utils/use-editor-gesture';

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

  // A bubble menu is a response to a gesture, and opening the template is not
  // one. `autofocus="end"` parks the caret inside whatever the document ends
  // in, so a template finishing in a Section used to open with this menu up
  // over the block above it before the customer had touched anything. The
  // caret stays where it is — a Section with text in it is the right place to
  // land — and the menu waits for the first pointer or key gesture instead.
  const gestured = useEditorGesture(editor);

  // Placement follows the caret, not the show: the menu is usually already
  // up when the caret moves into the nested block, so a show-time hook would
  // be too late. Every transaction re-asks; setProps is a no-op when unchanged.
  const tippyRef = useRef<Instance | null>(null);
  // The menu sits over the block above the section, so a customer who wants
  // to read or click that block needs a way to put the menu down without
  // first having to click through it. Escape is that way, and it is the
  // section that was dismissed rather than the menu: moving the caret to
  // another section, or out of every section and back, is asking again.
  const dismissedSection = useRef<number | null>(null);
  useEffect(() => {
    const place = () => {
      const placement = repeatIsActiveInside(editor) ? 'bottom' : 'top';
      const instance = tippyRef.current;
      if (instance && instance.props.placement !== placement) instance.setProps({ placement });
    };
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !tippyRef.current?.state.isVisible) return;
      // Escape belongs to the innermost thing that is open. This menu holds a
      // Show if popover, a colour popover and four dropdowns, each a Radix
      // layer that answers Escape itself — and Radix listens on `document`
      // too, without stopping propagation, so one keystroke aimed at a
      // dropdown would close it and take the whole menu down behind it. Radix
      // wraps every open popup in a popper wrapper and unmounts it on close,
      // which is the one signal that holds whether the popup is portaled out
      // of this menu (the dropdowns) or rendered inside it (the popovers),
      // and whether or not the focus ever left the canvas.
      if (document.querySelector('[data-radix-popper-content-wrapper]')) return;
      dismissedSection.current = getClosestNodeByName(editor, 'section')?.pos ?? null;
      tippyRef.current.hide();
    };
    editor.on('transaction', place);
    document.addEventListener('keydown', dismiss);
    return () => {
      editor.off('transaction', place);
      document.removeEventListener('keydown', dismiss);
    };
  }, [editor]);

  const bubbleMenuProps: EditorBubbleMenuProps = {
    ...props,
    ...(appendTo ? { appendTo: appendTo.current } : {}),
    shouldShow: ({ editor }) => {
      const activeSectionNode = getClosestNodeByName(editor, 'section');
      // Read here rather than on the editor's own transaction event, which
      // fires after this: the caret coming back to a dismissed section would
      // be judged against the stale answer and the menu would stay down
      // until something else moved.
      if (activeSectionNode?.pos !== dismissedSection.current) dismissedSection.current = null;
      const inlineImageNodeChildren = activeSectionNode
        ? findChildren(activeSectionNode?.node, (node) => {
            return node.type.name === 'inlineImage';
          })?.[0]
        : null;
      const hasActiveInlineImageNodeChildren =
        inlineImageNodeChildren && editor.isActive('inlineImage');

      if (
        !gestured.current ||
        isTextSelected(editor) ||
        hasActiveInlineImageNodeChildren ||
        !editor.isEditable ||
        (activeSectionNode && activeSectionNode.pos === dismissedSection.current)
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
