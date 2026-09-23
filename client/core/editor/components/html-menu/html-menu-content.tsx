import { cn } from '@/editor/utils/classname';
import { Editor } from '@tiptap/core';
import { CodeXmlIcon, ViewIcon } from 'lucide-react';
import { ShowPopover } from '../show-popover';
import { Divider } from '../ui/divider';
import { TooltipLabel } from '../ui/tooltip';
import { useHtmlState } from './use-html-state';

export function HTMLMenuContent({ editor }: { editor: Editor }) {
  const state = useHtmlState(editor);

  const { activeTab = 'code' } = state;

  return (
    <>
      {/* Which tab is showing used to be said by disabling the one you are
          on, which takes it out of the tab order and leaves a keyboard
          customer one reachable control and no way to tell what it does. It
          is a pressed state instead, which is what it is. */}
      <div
        role="group"
        aria-label="Custom HTML view"
        className="mly:flex mly:items-center mly:h-7 mly:rounded-md mly:bg-soft-gray mly:px-0.5"
      >
        <TooltipLabel label="HTML code">
          <button
            type="button"
            aria-pressed={activeTab === 'code'}
            className={cn(
              'mly:flex mly:size-6 mly:shrink-0 mly:items-center mly:justify-center mly:rounded mly:focus-visible:relative mly:focus-visible:z-10 ',
              activeTab === 'code' && 'mly:bg-panel'
            )}
            onClick={() => {
              editor?.commands?.updateHtmlCodeBlock({
                activeTab: 'code',
              });
            }}
          >
            <CodeXmlIcon className="mly:size-3 mly:shrink-0 mly:stroke-[2.5]" />
          </button>
        </TooltipLabel>
        <TooltipLabel label="Preview">
          <button
            type="button"
            aria-pressed={activeTab === 'preview'}
            className={cn(
              'mly:flex mly:size-6 mly:shrink-0 mly:items-center mly:justify-center mly:rounded mly:focus-visible:relative mly:focus-visible:z-10 ',
              activeTab === 'preview' && 'mly:bg-panel'
            )}
            onClick={() => {
              editor?.commands?.updateHtmlCodeBlock({
                activeTab: 'preview',
              });
            }}
          >
            <ViewIcon className="mly:size-3 mly:shrink-0 mly:stroke-[2.5]" />
          </button>
        </TooltipLabel>
      </div>
      <Divider />
      <ShowPopover
        showIfKey={state.currentShowIfKey}
        onShowIfKeyValueChange={(value) => {
          editor.commands.updateHtmlCodeBlock({
            showIfKey: value,
          });
        }}
        editor={editor}
      />
    </>
  );
}
