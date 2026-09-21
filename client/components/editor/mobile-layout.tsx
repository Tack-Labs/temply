'use client';

import type { Editor, FocusPosition } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  Undo2Icon,
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
import { clearBlockSelection, selectBlockAt, selectedBlock } from '~/core/editor/commands/block';
import { InputDockContext, type InputDock as InputDockApi, type InputDockSpec } from '~/core/editor/components/ui/input-dock';
import { isEditingText } from '~/core/editor/plugins/block-selection';
import { EMAIL_TRANSFORM, isLibraryUrl, UPLOAD_MIME_TYPES, withTransform } from '~/lib/assets';
import { cn } from '~/lib/classname';
import { useVisualViewport } from '~/hooks/use-visual-viewport';
import { SaveStatus } from '../email-editor-sandbox';
import { bottomBarState, EditorBottomBar, type BottomBarState, type IdleTab } from './bottom-bar';
import { DesktopOnlyBanner } from './desktop-only-banner';
import { MobileSheets, type SheetId } from './mobile-sheets';
import { ShellFrameContext } from './shell-context';
import { StylePanel } from './style-panel';
import { keepFocus } from './text-format-bar';
import type { TemplateEditorModel } from './use-template-editor';

/** The bars are thumb country: every control in them is a 44px target, which
 *  is taller than the desktop Button sizes go. */
const touchTarget = 'h-11 min-w-11';

/** setEditable emits an update on the editor, which every subscriber pays for
 *  and the autosave hears, so it is only ever called on a real change of the
 *  flag — the shell sets it from more than one place and releases it in a
 *  cleanup besides. */
function setEditable(editor: Editor | null, editable: boolean): void {
  if (editor && editor.isEditable !== editable) editor.setEditable(editable);
}

/** Whatever actually scrolls around an element — the shell's canvas, here,
 *  but found rather than assumed so the effect below survives a change of
 *  frame. Falls back to the window, the scroller when no ancestor claims it. */
function scrollParent(el: HTMLElement | null): HTMLElement | Window {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return window;
}

/**
 * The phone shell: the email fills the screen, everything else rises from
 * the bottom. Three fixed layers — top bar, canvas, bottom bar — and the
 * bottom bar changes face with the selection.
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
  const [styleOpen, setStyleOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // The input dock: a Link, Show-if or Alt-text control in a sheet hands its
  // field here, the sheet closes so the keyboard has nothing to cover, and
  // whichever sheet was open comes back when the field is done with. The
  // Link and {} keys on the text format bar reach the dock too, but with no
  // sheet to come back to — `editing` is what they leave behind instead, so
  // closeDock knows to hand focus back to the editor rather than a sheet.
  // Recorded from `isEditingText`, not the bar's face, because the face
  // (`state` below) has already folded the field surface on top of it by the
  // time closeDock runs.
  const [dock, setDock] = useState<InputDockSpec | null>(null);
  const resumeAfterDock = useRef<{ sheet: SheetId; styleOpen: boolean; editing: boolean } | null>(null);
  const inputDock = useMemo<InputDockApi>(
    () => ({
      open: (spec) => {
        resumeAfterDock.current = { sheet, styleOpen, editing: !sheet && !styleOpen && !!editor && isEditingText(editor) };
        setSheet(null);
        setStyleOpen(false);
        // The Aa panel goes too, and it is the one that cannot see itself out:
        // it only clears when the selection stops being text, and a field
        // surface over a caret leaves that selection exactly where it was. The
        // panel left open holds the bar at its own height behind the field —
        // 382px of bar for a surface that needs 149 — with no way back but
        // closing the field. It is not restored afterwards either: the panel
        // exists to stand in for the keyboard, and closeDock hands the
        // keyboard back.
        setPanelOpen(false);
        setDock(spec);
      },
    }),
    [sheet, styleOpen, editor],
  );
  const closeDock = () => {
    setDock(null);
    const resume = resumeAfterDock.current;
    resumeAfterDock.current = null;
    if (resume) {
      setSheet(resume.sheet);
      setStyleOpen(resume.styleOpen);
    }
    // Focus is what turns `state` back to 'text' — bottomBarState reads
    // editor.isFocused, and the field surface's own input held DOM focus
    // until this closed it. Only for the text-bar path: a Style sheet being
    // resumed instead leaves the editor read-only, and focusing a
    // non-editable view is a bug there, not a fix. `editor.commands.focus()`
    // defers its real work to a rAF itself (tiptap's own focus command),
    // which is what lets it win — it lands after React has committed the
    // field face as inert and the input inside it has already given up
    // focus, rather than racing it. The flag has to go back by hand first:
    // tiptap's focus command reaches for the DOM inside this same tap (iOS
    // raises the keyboard only for a focus made there), which a still-
    // read-only view would swallow.
    if (resume?.editing) {
      setEditable(editor, true);
      editor?.commands.focus();
    }
  };

  // The bar's face follows the selection; useEditorState re-renders on every
  // transaction, which is exactly when the face can change. panelOpen lives
  // here, not inside the bar, because the header's own Done/Publish switch
  // reads `selectionState` too — both faces have to agree the Aa panel is
  // still "text". The field face is derived outside the selector: opening
  // the dock dispatches nothing to the editor, so a `dock` read inside
  // useEditorState would never fire a re-render. `state` folds the field
  // face in on top of `selectionState` and is what the bar itself renders;
  // everything that instead cares about the underlying selection — the
  // header, the keep-visible effect — reads `selectionState` directly, since
  // a field surface covering the bar does not change what is selected.
  const selectionState = useEditorState({ editor, selector: ({ editor }) => bottomBarState(editor, panelOpen) }) ?? 'idle';
  const state: BottomBarState = dock ? 'field' : selectionState;
  const canUndo = useEditorState({ editor, selector: ({ editor }) => editor?.can().undo() ?? false }) ?? false;
  const isEmpty = useEditorState({ editor, selector: ({ editor }) => editor?.isEmpty ?? true }) ?? true;

  // Aa takes the keyboard's place: opening it blurs the editor so the
  // keyboard drops, closing it gives focus back. The SelectionExtension
  // keeps the selection drawn while unfocused, so the panel's own commands
  // (colour, align, the link row) still land on it. Read `panelOpen` from
  // the render closure rather than a state updater — same rule as
  // `closeSheet` below: blur()/focus() dispatch a transaction, which
  // notifies useEditorState's subscribers synchronously, and React can run
  // an updater during another component's render.
  const togglePanel = () => {
    if (panelOpen) editor?.commands.focus();
    else editor?.commands.blur();
    setPanelOpen(!panelOpen);
  };

  // A stale panelOpen would reopen the panel the next time text is entered
  // for an unrelated reason (a fresh tap, Done). It only means anything
  // while the text face is up, so anything that leaves 'text' clears it —
  // reading the selection, not the bar's face, so opening a field surface
  // over a live text selection (the Link row does exactly this) does not
  // itself clear a panel the field surface is about to sit on top of.
  useEffect(() => {
    if (selectionState !== 'text') setPanelOpen(false);
  }, [selectionState]);

  // Whatever is selected stays in view. Several things cover the bottom of
  // the canvas — the keyboard (which shrinks the frame), the Aa panel, the
  // dock (a face of the bar, so the bar's own height already covers it),
  // the Style sheet — and each arrives after the selection was made, so the
  // canvas scrolls to keep the selected block (or the caret, while typing)
  // above whichever of them is lowest on screen. The sheet is read at its
  // laid-out position, not its mid-slide one. Runs a beat late so the
  // keyboard, the sheet and the panel's transition have settled; the frame
  // height is in the deps because that is what the keyboard changes.
  useEffect(() => {
    if (!editor) return;
    if (selectionState === 'idle' && !styleOpen && !dock) return;
    const keepVisible = () => {
      const scroller = scrollParent(editor.view.dom);
      if (!(scroller instanceof HTMLElement)) return;
      const frameRect = frameEl?.getBoundingClientRect();
      const inFrame = (el: HTMLElement | null) => (el && frameRect ? frameRect.top + el.offsetTop : null);
      const sheetEl = styleOpen ? frameEl?.querySelector<HTMLElement>('[role="dialog"]') ?? null : null;
      const bar = document.querySelector<HTMLElement>('[data-editor-bottom-bar]');
      const limit = inFrame(sheetEl) ?? (bar ? bar.getBoundingClientRect().top : window.innerHeight);
      const target = (() => {
        if (selectionState === 'text') {
          const coords = editor.view.coordsAtPos(editor.state.selection.from);
          return { top: coords.top, bottom: coords.bottom };
        }
        const block = selectedBlock(editor);
        const dom = block ? editor.view.nodeDOM(block.pos) : null;
        return dom instanceof HTMLElement ? dom.getBoundingClientRect() : null;
      })();
      if (!target) return;
      const margin = 16;
      const top = scroller.getBoundingClientRect().top + margin;
      const bottom = limit - margin;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const behavior = reduceMotion ? 'auto' : 'smooth';
      // Too tall for the room left: its top edge is what to show.
      if (target.top < top || target.bottom - target.top > bottom - top) {
        scroller.scrollBy({ top: target.top - top, behavior });
      } else if (target.bottom > bottom) {
        scroller.scrollBy({ top: target.bottom - bottom, behavior });
      }
    };
    // Twice: once after the keyboard and the slide have settled, and again
    // after a sheet whose controls wrap has finished growing into its rows.
    const ids = [250, 700].map((delay) => window.setTimeout(keepVisible, delay));
    return () => {
      for (const id of ids) window.clearTimeout(id);
    };
  }, [selectionState, panelOpen, styleOpen, dock, frame?.height, editor, frameEl]);

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
  // tab, the subject button, + — can land on top of the eye sheet, and a
  // restore that only ran on its own close would leave the editor off the
  // screen for good.
  useEffect(() => {
    if (sheet !== 'eye' && model.mode !== 'edit') model.changeMode('edit');
  }, [sheet, model]);

  const closeSheet = () => setSheet(null);

  /** Done ends typing, not the selection: the bar drops back to the block
   *  face. A bare blur would leave a text selection behind and land on idle,
   *  so the block is re-selected. The order reads backwards but is not:
   *  tiptap defers its blur to a rAF, so the NodeSelection dispatched on the
   *  next line lands first and the blur then arrives on top of it. */
  const done = () => {
    if (!editor) return;
    const block = selectedBlock(editor);
    editor.commands.blur();
    if (block) selectBlockAt(editor, block.pos);
  };
  /** A tap on the canvas but outside the document means "nothing selected":
   *  the bar goes back to its tabs, which are otherwise unreachable once a
   *  block has been touched. ProseMirror never sees these taps — they land on
   *  the page margin around the card — so the shell answers them. Not while
   *  the editor is read-only: a sheet or the field surface is over the canvas
   *  then, and both commit against the selection this would throw away. */
  const clearOnCanvasTap = (event: React.MouseEvent) => {
    if (!editor || !editor.isEditable || (event.target as HTMLElement).closest('.ProseMirror')) return;
    editor.commands.blur();
    clearBlockSelection(editor);
  };

  const openTab = (tab: IdleTab) => {
    // The keys are collected on the way into a rendered view, and the Data
    // sheet is not one — so they are re-read here, in the same event that
    // opens it. An effect inside the sheet is a render late, which flashed
    // "No variables yet" on a template that has them.
    if (tab === 'data') model.refreshPreviewKeys();
    setSheet(tab);
  };
  // Which of the bar's four tabs has its own sheet up — the other two sheet
  // ids ('eye', 'add') belong to triggers elsewhere and expand none of them.
  const idleTabOpen: IdleTab | null =
    sheet === 'details' || sheet === 'brand' || sheet === 'data' || sheet === 'checks' ? sheet : null;
  /** Half the screen: enough that the last block can sit above a sheet, the
   *  dock or the Aa panel, none of which the canvas can measure in advance. */
  const scrollTail = Math.max(96, Math.round((frame?.height ?? 0) * 0.55));
  const errors = model.preflight.issues.filter((issue) => issue.severity === 'error').length;
  const warnings = model.preflight.issues.length - errors;
  /** The draft is not on the server and the phone has to say so somewhere it
   *  is seen: the status itself lives in the ⋯ menu, which is closed — and
   *  the ⋯ button is not even on screen while text is being edited. */
  const saveFailed = model.saveStatus === 'error';

  // Phone autofocus would raise the keyboard on arrival; the canvas is the
  // first thing to see, not the first thing to type into.
  void autofocus;

  return (
    <InputDockContext.Provider value={inputDock}>
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
        {/* Undo without focusing: while typing the keyboard stays where it
            is (keepFocus), and from a block selection it must not come up. */}
        <Button
          variant="ghost"
          size="icon"
          className={touchTarget}
          aria-label="Undo"
          disabled={!canUndo}
          onMouseDown={keepFocus}
          onPointerDown={keepFocus}
          onClick={() => editor?.commands.undo()}
        >
          <Undo2Icon />
        </Button>
        {selectionState === 'text' ? (
          // Same race the bar's own Aa and Link buttons guard against: an
          // unprevented mousedown here would focus this button and blur the
          // ProseMirror before onClick runs, dropping `selectionState` out of
          // 'text' (and this button with it) a beat before the click fires.
          <Button variant="primary" className="h-11 px-3" onMouseDown={keepFocus} onPointerDown={keepFocus} onClick={done}>
            Done
          </Button>
        ) : (
          // Not modal: Share, History and Delete open their own layer from
          // inside this menu, and a modal menu would leave those layers
          // unclickable behind its pointer-event guard.
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
        )}
      </header>

      <DesktopOnlyBanner playground={!model.template} />

      {/* A failed save asks for something, so it is `danger` and it is on the
          screen rather than behind a tap: the ⋯ menu that holds the status is
          closed, and while text is being edited that button is replaced by
          Done, which is exactly when the work being lost is being made. The
          row is mounted from the start — a live region has to be in the tree
          before its content changes for the change to be announced — and
          collapses to nothing on the rows pattern rather than unmounting, so
          it opens and closes instead of appearing. */}
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
          block can sit over the bars and take their taps. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the pane; a tap on bare canvas clears the selection, and Escape does the same from the keyboard */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: as above */}
      <div
        ref={model.editorPaneRef}
        onClick={clearOnCanvasTap}
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
              that reads as broken. */}
          {isEmpty ? (
            <p className="px-4 py-10 text-center text-sm text-muted">
              Nothing in this email yet. Open it on a desktop to add blocks.
            </p>
          ) : null}
        </div>
        {/* Room to scroll the last block clear of whatever opens over it — a
            half sheet's worth. It is an element and not padding on the
            scroller because padding is a floor the box cannot shrink past:
            as a padding it stopped the canvas giving up its height when the
            Aa panel grew the bar, and the panel's last rows were then cut
            off by the frame's `overflow-clip`. Inside the scroller the same
            space costs the layout nothing. */}
        <div aria-hidden style={{ height: scrollTail }} />
      </div>

      <EditorBottomBar
        editor={editor}
        state={state}
        checksCount={{ errors, warnings }}
        panelOpen={panelOpen}
        onTogglePanel={togglePanel}
        openTab={idleTabOpen}
        onOpenTab={openTab}
        addOpen={sheet === 'add'}
        onAdd={() => setSheet('add')}
        styleOpen={styleOpen}
        onStyle={() => setStyleOpen(true)}
        dock={dock}
        onCloseDock={closeDock}
      />
      <StylePanel editor={editor} open={styleOpen} onOpenChange={setStyleOpen} returnFocus={!dock} />
      <MobileSheets
        model={model}
        open={sheet}
        onClose={closeSheet}
        returnFocus={!dock}
        // Selecting only. The finding names a block the canvas may have
        // scrolled past, and bringing it into view is the sheet's to do: the
        // scroll has to wait for the sheet that asked for it to be gone.
        onSelectBlockAt={(pos) => {
          if (!editor) return;
          selectBlockAt(editor, pos);
        }}
      />

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
    </InputDockContext.Provider>
  );
}
