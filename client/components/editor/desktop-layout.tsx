'use client';

import type { FocusPosition } from '@tiptap/core';
import { LayoutTemplateIcon, MailIcon } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { cn } from '~/lib/classname';
import { EMAIL_TRANSFORM, isLibraryUrl, UPLOAD_MIME_TYPES, withTransform } from '~/lib/assets';
import { useMediaQuery } from '~/hooks/use-media-query';
import { Button } from '../ui/button';
import { ReadOnlyNotice } from '../dashboard/billing-banner';
import { AssetPickerDialog } from '../assets/asset-picker-dialog';
import { EmailEditor } from '../email-editor';
import { ContentPreview } from '../content-preview';
import { ContentSource } from '../content-source';
import { PreflightPanel } from '../preflight-panel';
import { Label } from '../ui/label';
import { TemplateThemePanel } from '../template-theme-panel';
import type { TemplateEditorModel } from './use-template-editor';
import { BlockLibrary } from './block-library';
import { componentsDisabledReason, ComponentsRail } from './components-rail';
import { EditorViewSwitch } from './editor-view-switch';
import { EmailSettingsRail } from './email-settings-rail';
import { revealPreflight } from './reveal-preflight';
import { useRailCollapse } from './use-rail-collapse';

// The app-wide input treatment; the global :focus-visible ring supplies focus.
const inputClass =
  'h-9 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink placeholder:text-muted';

const labelClass = 'block text-sm font-medium text-ink';

// The two rails of the framed editor are slots, not content: each is a box
// whose width comes from a custom property on the layout root, and what sits
// inside is the rail's own business. Keeping the width in a variable is what
// lets a rail be collapsed by changing one value on the root, with the width
// easing between the two.
//   --rail-strip       4.5rem, a collapsed rail's width
//   --rail-left-open   13rem from lg, 16.5rem from xl: the Components rail
//   --rail-right-open  17rem from lg, 20rem from xl: the Email settings rail
//   --rail-left        what the slot is wide now: the strip or the open width
//   --rail-right
// The rails read the strip and the open widths too, to size their own faces.
// Below lg the rails stack around the canvas at the full width and none of
// the variables are read.
const railSlot = 'flex shrink-0 flex-col overflow-x-clip bg-raised';

// The ease is only switched on once the reader has collapsed or opened a rail:
// a rail restored collapsed on load is put at its width, not travelled to.
const railEase = 'transition-[width] duration-base ease-out motion-reduce:transition-none';

/**
 * The editor surface for a wide window.
 *
 * With a saved template it is the body of the editor frame: the header and the
 * tab row are drawn above it by the sandbox, and this is the three-column
 * area under them — the left rail, the canvas surround with the email on it,
 * the right rail. The anonymous playground has no template, so none of that
 * applies: it keeps one section with its own header and the old three-column
 * grid, and is told apart by `framed`.
 */
export function DesktopEditorLayout({
  model,
  autofocus,
  imageUploads,
  framed,
}: {
  model: TemplateEditorModel;
  autofocus?: FocusPosition;
  imageUploads: boolean;
  framed: boolean;
}) {
  const { readOnly, mode, pickerOpen, settlePick } = model;

  const picker =
    imageUploads && !readOnly ? (
      <AssetPickerDialog
        open={pickerOpen}
        onOpenChange={(open) => { if (!open) settlePick(null); }}
        onPick={(asset) => settlePick(withTransform(asset.url, EMAIL_TRANSFORM))}
      />
    ) : null;

  if (!framed) {
    return (
      <div className="space-y-6">
        {readOnly ? <ReadOnlyNotice /> : null}

        <div className="grid items-start gap-4 lg:grid-cols-[190px_minmax(0,1fr)_280px] xl:grid-cols-[210px_minmax(0,1fr)_300px]">
          <div className="lg:sticky lg:top-4">
            <BlockLibrary editor={model.editor} disabled={readOnly || mode !== 'edit'} />
          </div>
          <div className="min-w-0 space-y-3">
            <ClickHint />
            {/* Editor — same section/header shape as Email details and Brand */}
            <section className="overflow-hidden rounded-lg border border-line bg-raised">
              <header className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2">
                <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <LayoutTemplateIcon className="size-4 text-faint" />
                  Your email
                  {mode !== 'edit' && (
                    <span className="font-normal text-muted">
                      ({mode === 'preview' ? 'Preview' : mode === 'html' ? 'HTML' : 'Text'})
                    </span>
                  )}
                </h2>
                <EditorViewSwitch model={model} />
              </header>
              <ContentPanes model={model} autofocus={autofocus} imageUploads={imageUploads} />
            </section>
          </div>
          <SettingsAside model={model} />
        </div>

        {picker}
      </div>
    );
  }

  return (
    <FramedLayout model={model} autofocus={autofocus} imageUploads={imageUploads} picker={picker} />
  );
}

/**
 * The framed editor's three columns. It is its own component because the rails
 * keep state (collapsed, remembered per browser) and the layout above returns
 * early for the playground, which hooks may not follow.
 */
function FramedLayout({
  model,
  autofocus,
  imageUploads,
  picker,
}: {
  model: TemplateEditorModel;
  autofocus?: FocusPosition;
  imageUploads: boolean;
  picker: React.ReactNode;
}) {
  const { readOnly, mode } = model;
  const left = useRailCollapse('left');
  const right = useRailCollapse('right');
  // Collapsing is a lg-and-up idea: below it the rails stack and their toggles
  // are not drawn, so a rail remembered as collapsed must still show in full.
  // `false` on the server and the first client render, as everywhere else.
  const wide = useMediaQuery('(min-width: 1024px)');
  const leftCollapsed = wide && left.collapsed;
  const rightCollapsed = wide && right.collapsed;
  const canvas = useRef<HTMLElement>(null);

  // Why the chips are off, if they are; the rail words it where they are.
  const disabledReason = componentsDisabledReason({ readOnly, mode });

  return (
    <div
      className={cn(
        'flex flex-1 flex-col lg:flex-row lg:[--rail-strip:4.5rem] lg:[--rail-left-open:13rem] lg:[--rail-right-open:17rem] xl:[--rail-left-open:16.5rem] xl:[--rail-right-open:20rem]',
        leftCollapsed ? 'lg:[--rail-left:var(--rail-strip)]' : 'lg:[--rail-left:var(--rail-left-open)]',
        rightCollapsed ? 'lg:[--rail-right:var(--rail-strip)]' : 'lg:[--rail-right:var(--rail-right-open)]',
      )}
    >
      {/* LEFT RAIL SLOT. The Components rail pins its own head to the top of
          the scroll while the canvas moves past it. */}
      <div
        className={cn(
          railSlot,
          left.animate && railEase,
          'border-b-[1.5px] border-line lg:w-(--rail-left) lg:border-r-[1.5px] lg:border-b-0',
        )}
      >
        <ComponentsRail
          editor={model.editor}
          disabledReason={disabledReason}
          collapsed={leftCollapsed}
          animate={left.animate}
          onToggle={left.toggle}
        />
      </div>

      {/* CANVAS SURROUND. The app's sunken surface, so it follows the app
          theme; the email on it is painted from the template's own theme
          and does not. */}
      <section ref={canvas} aria-label="Email canvas" className="min-w-0 flex-1 bg-sunken px-6 pt-8 pb-12">
        <div className="mx-auto w-full max-w-[760px] space-y-4">
          {readOnly ? <ReadOnlyNotice /> : null}
          <ClickHint />
          {/* The overflow is what rounds the email's own page to the article's
              corners; it also clips the editor's bubble menus to the article,
              as the section around the old editor did. */}
          <article className="overflow-hidden rounded-[28px] bg-raised shadow-md">
            <ContentPanes model={model} autofocus={autofocus} imageUploads={imageUploads} />
          </article>
        </div>
      </section>

      {/* RIGHT RAIL SLOT. The settings flow with the page and scroll with the
          canvas; the status card at their foot stays in view. */}
      <div
        className={cn(
          railSlot,
          right.animate && railEase,
          'border-t-[1.5px] border-line lg:w-(--rail-right) lg:border-t-0 lg:border-l-[1.5px]',
        )}
      >
        <EmailSettingsRail
          model={model}
          collapsed={rightCollapsed}
          animate={right.animate}
          onToggle={right.toggle}
          onOpenPreflight={() => revealPreflight(canvas.current)}
        />
      </div>

      {picker}
    </div>
  );
}

function ClickHint() {
  return (
    <div className="rounded-lg bg-accent-wash px-4 py-3 text-sm text-accent-ink">
      Click the email to change its words. Select text or a block to see its formatting options.
    </div>
  );
}

/** What is inside the email's box: the checks, then whichever view is on. */
function ContentPanes({
  model,
  autofocus,
  imageUploads,
}: {
  model: TemplateEditorModel;
  autofocus?: FocusPosition;
  imageUploads: boolean;
}) {
  const {
    readOnly, subject, previewText, fromName, pageStyle, cardStyle,
    setEditor, editorContent, editorPaneRef, paneClass, paneHeight,
    imageUploader, pickFromLibrary,
    mode, forceDark, previewHtml, isPreviewPending, htmlSource, textSource,
    preflight, preflightExpanded, setPreflightExpanded,
  } = model;
  return (
    <>
      <PreflightPanel
        issues={preflight.issues}
        bytes={preflight.bytes}
        expanded={preflightExpanded}
        onToggle={() => setPreflightExpanded((current) => !current)}
      />

      {/* The editor is hidden rather than unmounted: it holds the caret,
          the selection and the undo history, and previewing is a glance. */}
      {/* In dark mode the canvas is dimmed a touch to take the glare off —
          comfort only, the theme's colours still hold: recipients get them
          at full brightness, and so does the preview. The dim is a veil
          over the canvas rather than a filter on it: a filter would also
          dim the bubble menus drawn inside, leaving them a shade darker
          than the menus that float on the page. */}
      <div
        ref={editorPaneRef}
        className={cn(mode !== 'edit' ? 'hidden' : paneClass, 'relative')}
        style={pageStyle}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 hidden rounded-[inherit] bg-black/10 dark:block"
        />
        <div style={cardStyle}>
          <EmailEditor
            allowedMimeTypes={UPLOAD_MIME_TYPES}
            autofocus={autofocus}
            defaultContent={editorContent}
            editable={!readOnly}
            onImageUpload={imageUploads && !readOnly ? imageUploader : undefined}
            onPickImage={imageUploads && !readOnly ? pickFromLibrary : undefined}
            isLibraryImage={isLibraryUrl}
            setEditor={setEditor}
          />
        </div>
      </div>

      {mode === 'preview' && (
        <ContentPreview
          className={cn(paneClass, 'bg-raised')}
          minHeight={paneHeight}
          html={previewHtml}
          isPending={isPreviewPending}
          forceDark={forceDark}
          subject={subject}
          previewText={previewText}
          from={fromName}
        />
      )}

      {mode === 'html' && (
        <ContentSource className={cn(paneClass, 'bg-raised')} minHeight={paneHeight} source={htmlSource} />
      )}

      {mode === 'text' && (
        <ContentSource className={cn(paneClass, 'bg-raised')} minHeight={paneHeight} source={textSource} wrap />
      )}
    </>
  );
}

function SettingsAside({ model }: { model: TemplateEditorModel }) {
  const {
    template, readOnly, subject, setSubject, previewText, setPreviewText, fromName, setFromName,
    to, setTo, replyTo, setReplyTo, theme, setTheme,
  } = model;
  return (
    <aside aria-label="Email settings" className="min-w-0 space-y-4">
      <div className="px-1">
        <h2 className="font-display text-base font-semibold text-ink">Make it yours</h2>
        <p className="mt-1 text-xs text-muted">Set the inbox details and the look of your email.</p>
      </div>
      {/* Email fields card — same section/header shape as the Brand panel */}
      <section className="overflow-hidden rounded-lg border border-line bg-raised">
        <header className="flex items-center gap-1.5 border-b border-line px-3.5 py-2">
          <MailIcon className="size-4 text-faint" />
          <h2 className="text-sm font-medium text-ink">Email details</h2>
        </header>
        <div className="p-3.5">
        <p className="mb-4 text-xs leading-relaxed text-muted">The subject and preview text appear in the inbox. From name, To and Reply to are used for your test email.</p>
        <div className="grid grid-cols-1 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className={labelClass} htmlFor="subject">Subject</Label>
            <input
              className={inputClass}
              id="subject"
              readOnly={readOnly}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your email subject"
              value={subject}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className={labelClass} htmlFor="fromName">From name</Label>
            <input
              className={inputClass}
              id="fromName"
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Your name or brand"
              value={fromName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className={labelClass} htmlFor="to">To</Label>
            <input
              className={inputClass}
              id="to"
              onChange={(e) => setTo(e.target.value)}
              placeholder="to@example.com"
              type="email"
              value={to}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className={labelClass} htmlFor="replyTo">
              Reply to <span className="font-normal text-muted">(optional)</span>
            </Label>
            <input
              className={inputClass}
              id="replyTo"
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="replyto@example.com"
              type="email"
              value={replyTo}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="previewText">
            Inbox preview text
          </label>
          <input
            className={inputClass}
            id="previewText"
            readOnly={readOnly}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder="Preview text shown in inbox..."
            value={previewText}
          />
        </div>
        </div>
      </section>

      {/* Subject and preview text are the template's; the rest of Email
          details only addresses a test send, which a read-only workspace can
          still make. The brand is all the template's, so all of it locks. */}
      <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
        <TemplateThemePanel theme={theme} onChange={setTheme} />
      </fieldset>

      {template?.short_code ? <div className="rounded-xl border border-line bg-raised p-4 text-sm">
        <p className="font-medium text-ink">Ready to use this email?</p>
        <p className="mt-1 text-xs text-muted">Publish your changes, then follow the steps to connect it to your app.</p>
        <Button asChild variant="link" size="sm" className="mt-2 px-0">
          <Link href={`/templates/${template.id}/connect`} onClick={async (event) => {
            event.preventDefault();
            if (await model.beforeStage()) window.location.assign(`/templates/${template.id}/connect`);
          }}>Connect your app →</Link>
        </Button>
      </div> : null}
    </aside>
  );
}
