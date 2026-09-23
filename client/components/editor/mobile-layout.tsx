'use client';

import type { FocusPosition } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { useEffect, useState } from 'react';
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  EyeIcon,
  GlobeIcon,
  HistoryIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilLineIcon,
  SendIcon,
  Share2Icon,
  Trash2Icon,
} from 'lucide-react';
import Link from 'next/link';
import { AssetPickerDialog } from '~/components/assets/asset-picker-dialog';
import { DeleteEmailDialog } from '~/components/delete-email-dialog';
import { EmailEditor } from '~/components/email-editor';
import { ShareLinkPopover } from '~/components/share-link-popover';
import { Badge } from '~/components/ui/surfaces';
import { Button, pressable } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { VersionHistoryDialog } from '~/components/version-history-dialog';
import { EMAIL_TRANSFORM, isLibraryUrl, UPLOAD_MIME_TYPES, withTransform } from '~/lib/assets';
import { cn } from '~/lib/classname';
import { useVisualViewport } from '~/hooks/use-visual-viewport';
import { SaveStatus } from '../email-editor-sandbox';
import { EditorBottomBar, type IdleTab } from './bottom-bar';
import { DesktopOnlyBanner } from './desktop-only-banner';
import { MobileSheets, type SheetId } from './mobile-sheets';
import { ShellFrameContext } from './shell-context';
import type { TemplateEditorModel } from './use-template-editor';

/** The bars are thumb country: every control in them is a 44px target, which
 *  is taller than the desktop Button sizes go. */
const touchTarget = 'h-11 min-w-11';

/**
 * The phone shell: the email fills the screen, everything else rises from
 * the bottom. Three fixed layers — top bar, read-only canvas, bottom bar —
 * and the bottom bar is always its sections nav: nothing on a read-only
 * canvas can raise a selection for it to answer.
 */
export function MobileEditorLayout({
  model,
  autofocus,
  imageUploads,
}: {
  model: TemplateEditorModel;
  autofocus?: FocusPosition;
  imageUploads: boolean;
}) {
  const { editor, template } = model;
  const frame = useVisualViewport();
  // The frame element itself, as state so the sheets (rendered into it) see
  // it once it exists rather than the null a ref holds on first render.
  const [frameEl, setFrameEl] = useState<HTMLElement | null>(null);
  const [sheet, setSheet] = useState<SheetId>(null);

  // False, not true, while `editor` is still null: the lazy chunk that
  // creates it is still loading, and its own "Loading the editor…" already
  // says so — defaulting to empty would show both messages at once for
  // every template until the editor exists to say otherwise.
  const isEmpty = useEditorState({ editor, selector: ({ editor }) => editor?.isEmpty ?? false }) ?? false;

  // Arming is the whole explanation on desktop, where it expands the
  // preflight panel beside the button. Nothing on the phone reads
  // `preflightExpanded`, so the first Publish tap only relabelled a button
  // under the thumb and the first "Send test" tap closed the ⋯ menu and said
  // nothing at all. The sheet is the feedback — its badge already carries the
  // count, so no toast repeats it.
  useEffect(() => {
    if (model.publishArmed || model.sendArmed) setSheet('checks');
  }, [model.publishArmed, model.sendArmed]);

  // The eye sheet is the only thing that puts the model into a rendered mode,
  // and the canvas is `hidden` while the mode is not 'edit' — so the canvas
  // coming back hangs off the eye sheet being gone, not off any one path out
  // of it. Every other route to a sheet — the armed-preflight effect above, a
  // tab, the subject button — can land on top of the eye sheet, and a
  // restore that only ran on its own close would leave the editor off the
  // screen for good.
  useEffect(() => {
    if (sheet !== 'eye' && model.mode !== 'edit') model.changeMode('edit');
  }, [sheet, model]);

  const closeSheet = () => setSheet(null);

  const openTab = (tab: IdleTab) => {
    // The keys are collected on the way into a rendered view, and the Data
    // sheet is not one — so they are re-read here, in the same event that
    // opens it. An effect inside the sheet is a render late, which flashed
    // "No variables yet" on a template that has them.
    if (tab === 'data') model.refreshPreviewKeys();
    setSheet(tab);
  };
  // Which of the bar's four tabs has its own sheet up — the 'eye' sheet id
  // belongs to a trigger elsewhere and expands none of them.
  const idleTabOpen: IdleTab | null =
    sheet === 'details' || sheet === 'brand' || sheet === 'data' || sheet === 'checks' ? sheet : null;
  const errors = model.preflight.issues.filter((issue) => issue.severity === 'error').length;
  const warnings = model.preflight.issues.length - errors;
  /** The draft is not on the server and the phone has to say so somewhere it
   *  is seen: the status itself lives in the ⋯ menu, which stays closed
   *  until tapped. */
  const saveFailed = model.saveStatus === 'error';

  // Phone autofocus would raise the keyboard on arrival; the canvas is the
  // first thing to see, not the first thing to type into.
  void autofocus;

  return (
    <ShellFrameContext.Provider value={frameEl}>
    {/* An app frame, not a page: the shell is fixed to the visual viewport —
    // the part of the screen the keyboard has not taken — and only the canvas
    // inside it scrolls. The bars are ordinary children, so there is nothing
    // to reposition when the keyboard opens or the page is scrolled under it;
    // a fixed bar that chased the keyboard with a measured inset painted in
    // one place and answered taps in another mid-scroll. Until the viewport
    // is measured the frame is the dynamic viewport height. `overflow-clip`,
    // not hidden: a hidden overflow can still be scrolled by script, and
    // ProseMirror scrolls every ancestor to keep the caret in view — which
    // walked the frame up by the keyboard's height a few pixels at a time,
    // with the bars bouncing on it and a bare strip left under them. */}
    <div
      ref={setFrameEl}
      className={cn('fixed inset-x-0 z-30 flex flex-col overflow-clip bg-surface', frame ? '' : 'top-0 h-dvh')}
      style={frame ? { top: frame.top, height: frame.height } : undefined}
    >
      <header className="z-40 flex h-14 shrink-0 items-center gap-1 border-b border-line bg-raised px-2">
        {/* The playground has no template to go back to, and its visitor may
            not even be signed in — the link only belongs on a saved one. */}
        {template?.id ? (
          <Button variant="ghost" size="icon" asChild className={touchTarget} aria-label="Back to templates">
            <Link href="/dashboard/templates">
              <ArrowLeftIcon />
            </Link>
          </Button>
        ) : null}
        {/* The subject is the way into the details sheet, and a pencil says
            so: a bare title reads as a label, not a control. */}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={sheet === 'details'}
          aria-label={`Edit details: ${model.subject || 'Untitled'}`}
          onClick={() => setSheet('details')}
          className={cn('flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 text-left text-sm font-medium text-ink hover:bg-hover', pressable)}
        >
          <span className="truncate">{model.subject || 'Untitled'}</span>
          <PencilLineIcon className="size-3.5 shrink-0 text-muted" aria-hidden />
        </button>
        {/* Not modal: Share, History and Delete open their own layer from
            inside this menu, and a modal menu would leave those layers
            unclickable behind its pointer-event guard. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={touchTarget} aria-label="More">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {/* The save status fades rather than unmounts, so with nothing
                to report the row would open as an empty line above a rule. */}
            {template?.id && (model.unpublished || model.saveStatus !== 'idle') ? (
              <>
                <DropdownMenuLabel>
                  <span className="flex items-center justify-between gap-2">
                    <SaveStatus status={model.saveStatus} onRetry={() => void model.autosave?.flush()} />
                    {model.unpublished ? <Badge tone="warn">Unpublished changes</Badge> : null}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem className={touchTarget} onSelect={() => setSheet('eye')}>
              <EyeIcon />
              Preview
            </DropdownMenuItem>
            {template?.id ? (
              <>
                <DropdownMenuItem
                  className={touchTarget}
                  disabled={model.isPublishing || (!model.unpublished && model.publishedAt !== null && !model.publishArmed)}
                  onSelect={model.handlePublish}
                >
                  {model.isPublishing ? <Loader2Icon className="animate-spin" /> : <GlobeIcon />}
                  {model.publishArmed ? 'Publish anyway' : 'Publish'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {template.short_code ? (
                  <DropdownMenuItem
                    className={touchTarget}
                    onSelect={(event) => {
                      // The menu stays open so the tick that replaces the copy
                      // icon is seen; copying is not leaving the menu.
                      event.preventDefault();
                      void model.copyShortCode();
                    }}
                  >
                    {model.shortCodeCopied ? <CheckIcon /> : <CopyIcon />}
                    <span className="font-mono text-xs">{template.short_code}</span>
                  </DropdownMenuItem>
                ) : null}
                <ShareLinkPopover
                  templateId={template.id}
                  initialToken={template.share_token ?? null}
                  trigger={
                    <DropdownMenuItem className={touchTarget} onSelect={(event) => event.preventDefault()}>
                      <Share2Icon />
                      Share link
                    </DropdownMenuItem>
                  }
                />
                <DropdownMenuItem className={touchTarget} onSelect={() => void model.handleSend()}>
                  <SendIcon />
                  {model.sendArmed ? 'Send anyway' : 'Send test'}
                </DropdownMenuItem>
                <VersionHistoryDialog
                  templateId={template.id}
                  hasUnpublishedChanges={model.unpublished}
                  onDiscarded={model.handleDiscarded}
                  onRestored={model.handleRestored}
                  trigger={
                    <DropdownMenuItem className={touchTarget} onSelect={(event) => event.preventDefault()}>
                      <HistoryIcon />
                      History
                    </DropdownMenuItem>
                  }
                />
                <DropdownMenuSeparator />
                <DeleteEmailDialog
                  templateId={template.id}
                  trigger={
                    <DropdownMenuItem
                      className={cn(touchTarget, 'text-danger-ink [&_svg]:text-danger-ink')}
                      onSelect={(event) => event.preventDefault()}
                    >
                      <Trash2Icon />
                      Delete
                    </DropdownMenuItem>
                  }
                />
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <DesktopOnlyBanner playground={!model.template} />

      {/* A failed save asks for something, so it is `danger` and it is on the
          screen rather than behind a tap: the ⋯ menu that holds the status
          stays closed until asked for. The row is mounted from the start — a
          live region has to be in the tree before its content changes for
          the change to be announced — and collapses to nothing on the rows
          pattern rather than unmounting, so it opens and closes instead of
          appearing. */}
      <div
        role="status"
        className={cn(
          'z-40 grid shrink-0 transition-[grid-template-rows,opacity] duration-base ease-out motion-reduce:transition-none',
          saveFailed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden" aria-hidden={!saveFailed} inert={!saveFailed}>
          <div className="flex items-center gap-2 border-b border-line bg-danger-wash px-2 py-1.5">
            <AlertTriangleIcon className="size-4 shrink-0 text-danger-ink" aria-hidden />
            <span className="min-w-0 flex-1 text-xs text-danger-ink">Not saved. Your changes are on this device only.</span>
            <Button variant="secondary" className={cn(touchTarget, 'text-sm')} onClick={() => void model.autosave?.flush()}>
              Retry
            </Button>
          </div>
        </div>
      </div>

      {/* The canvas: the frame's one scroller. `isolate` keeps the document's
          own stacking (a spacer is z-50 in the editor's CSS) inside it, so no
          block can sit over the bars and take their taps. Read-only, so
          nothing here answers a tap — the canvas is for reading. */}
      <div
        ref={model.editorPaneRef}
        className={cn('isolate min-h-0 flex-1 overflow-y-auto overscroll-contain', model.mode !== 'edit' && 'hidden')}
        style={model.pageStyle}
      >
        <div style={model.cardStyle}>
          <EmailEditor
            allowedMimeTypes={UPLOAD_MIME_TYPES}
            autofocus={false}
            defaultContent={model.editorContent}
            onImageUpload={imageUploads ? model.imageUploader : undefined}
            onPickImage={imageUploads ? model.pickFromLibrary : undefined}
            isLibraryImage={isLibraryUrl}
            setEditor={model.setEditor}
            editable={false}
          />
          {/* With the placeholder gone — tiptap hides it when the editor is
              not editable — an empty document would be a blank rectangle
              that reads as broken. Always mounted and grid-rows'd rather
              than conditionally rendered, so the message rises in rather
              than appearing the instant the lazy editor reports empty. */}
          <div
            className={cn(
              'grid transition-[grid-template-rows,opacity] duration-base ease-out motion-reduce:transition-none',
              isEmpty ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
            )}
          >
            <div className="overflow-hidden" aria-hidden={!isEmpty} inert={!isEmpty}>
              <p className="px-4 py-10 text-center text-sm text-muted">
                Nothing in this email yet. Open it on a desktop to add blocks.
              </p>
            </div>
          </div>
        </div>
      </div>

      <EditorBottomBar checksCount={{ errors, warnings }} openTab={idleTabOpen} onOpenTab={openTab} />
      <MobileSheets model={model} open={sheet} onClose={closeSheet} />

      {imageUploads && (
        <AssetPickerDialog
          open={model.pickerOpen}
          onOpenChange={(open) => {
            if (!open) model.settlePick(null);
          }}
          onPick={(asset) => model.settlePick(withTransform(asset.url, EMAIL_TRANSFORM))}
        />
      )}
    </div>
    </ShellFrameContext.Provider>
  );
}
