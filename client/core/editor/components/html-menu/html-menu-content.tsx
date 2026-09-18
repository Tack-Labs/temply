import { cn } from '@/editor/utils/classname';
import { Editor } from '@tiptap/core';
import { CodeXmlIcon, ViewIcon } from 'lucide-react';
import { ShowPopover } from '../show-popover';
import { Divider } from '../ui/divider';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../ui/tooltip';
import { useHtmlState } from './use-html-state';

export function HTMLMenuContent({ editor }: { editor: Editor }) {
  const state = useHtmlState(editor);

  const { activeTab = 'code' } = state;

  return (
    <>
      <div className="mly:flex mly:items-center mly:h-7 mly:rounded-md mly:bg-soft-gray mly:px-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(
                'mly:flex mly:size-6 mly:shrink-0 mly:items-center mly:justify-center mly:rounded mly:focus-visible:relative mly:focus-visible:z-10 ',
                activeTab === 'code' && 'mly:bg-panel'
              )}
              disabled={activeTab === 'code'}
              onClick={() => {
                editor?.commands?.updateHtmlCodeBlock({
                  activeTab: 'code',
                });
              }}
            >
              <CodeXmlIcon className="mly:size-3 mly:shrink-0 mly:stroke-[2.5]" />
            </button>
          </TooltipTrigger>
          <TooltipContent sideOffset={8}>HTML code</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(
                'mly:flex mly:size-6 mly:shrink-0 mly:items-center mly:justify-center mly:rounded mly:focus-visible:relative mly:focus-visible:z-10 ',
                activeTab === 'preview' && 'mly:bg-panel'
              )}
              disabled={activeTab === 'preview'}
              onClick={() => {
                editor?.commands?.updateHtmlCodeBlock({
                  activeTab: 'preview',
                });
              }}
            >
              <ViewIcon className="mly:size-3 mly:shrink-0 mly:stroke-[2.5]" />
            </button>
          </TooltipTrigger>
          <TooltipContent sideOffset={8}>Preview</TooltipContent>
        </Tooltip>
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
