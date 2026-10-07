'use client';

import { MoonIcon, SlidersHorizontalIcon } from 'lucide-react';
import { cn } from '~/lib/classname';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ContentModeSwitch } from '../content-mode-switch';
import { EditorCheatsheet } from '../editor-cheatsheet';
import { PreviewDataPanel } from '../preview-data-panel';
import { CopyHtmlButton, DownloadButton, fileSlug } from './source-actions';
import type { TemplateEditorModel } from './use-template-editor';

/**
 * Edit / Preview / HTML / Text, the controls that belong to whichever view is
 * showing, and the shortcuts list. The editor's tab row carries it at the
 * right-hand end; the anonymous playground, which has no tab row, carries it
 * in the header of its one section. Copying and downloading live with the
 * source they act on, and copy what is on screen rather than rendering the
 * email a second time.
 */
export function EditorViewSwitch({ model }: { model: TemplateEditorModel }) {
  const {
    mode, changeMode, pendingMode, subject, htmlSource, textSource,
    hasPreviewData, previewKeys, previewData, setPreviewData, forceDark, setForceDark,
  } = model;
  return (
    <div className="flex items-center gap-2">
      <ContentModeSwitch
        mode={mode}
        pending={pendingMode}
        onModeChange={changeMode}
        viewControls={
          mode === 'html' || mode === 'text' ? (
            <>
              <CopyHtmlButton html={mode === 'html' ? htmlSource : textSource} />
              <DownloadButton
                content={mode === 'html' ? htmlSource : textSource}
                filename={`${fileSlug(subject)}.${mode === 'html' ? 'html' : 'txt'}`}
                mimeType={mode === 'html' ? 'text/html' : 'text/plain'}
                label={mode === 'html' ? 'Download HTML' : 'Download text'}
              />
            </>
          ) : mode === 'preview' ? (
            <>
              {hasPreviewData && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Preview data" title="Preview data">
                      <SlidersHorizontalIcon />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 p-3">
                    <PreviewDataPanel keys={previewKeys} data={previewData} onChange={setPreviewData} />
                  </PopoverContent>
                </Popover>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Preview as a client that forces dark mode"
                aria-pressed={forceDark}
                title="Forced dark"
                onClick={() => setForceDark((current) => !current)}
                className={cn(forceDark && 'bg-accent-wash text-accent-ink hover:bg-accent-wash hover:text-accent-ink')}
              >
                <MoonIcon />
              </Button>
            </>
          ) : null
        }
      />

      {/* Not floating in a corner: the bottom right already carries toasts
          and, in development, Clerk's own badge. */}
      <EditorCheatsheet />
    </div>
  );
}
