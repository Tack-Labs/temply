'use client';

import type { FocusPosition } from '@tiptap/core';
import { LayoutTemplateIcon, MailIcon } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { cn } from '~/lib/classname';
import { EMAIL_TRANSFORM, isLibraryUrl, UPLOAD_MIME_TYPES, withTransform } from '~/lib/assets';
import { useMediaQuery } from '~/hooks/use-media-query';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/surfaces';
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

// The playground's panels: the card's corners on a hairline, since each one's
// content brings its own padding, and a bold line for the heading.
const panelClass = 'overflow-hidden rounded-card border border-line bg-raised shadow-sm';
const panelHeading = 'flex items-center gap-2 text-base font-bold text-ink';

// The two rails of the framed editor are slots, not content: each is a box
// whose width comes from a custom property on the layout root, and what sits
// inside is the rail's own business. Keeping the width in a variable is what
// lets a rail be collapsed by changing one value on the root, with the width
// easing between the two.
//   --rail-strip       4.5rem, a collapsed rail's width
//   --rail-left-open   13rem from lg, 16.5rem from xl: the Components rail
//   --rail-right-open  17rem from lg, 20rem from xl: the Email settings rail
//   --rail-left        how wide the rail's card is now: the strip or the open width
//   --rail-right
// The canvas reads the current widths to pad itself: where the window has the
// room, the email sits on the window's centre line and stays put when a rail
// folds, the room a fold frees staying empty; where it has not, the padding
// falls to its minimum and the email takes whatever is between the rails, so
// a fold there does widen it.
// From lg a slot is transparent and holds a floating card: 0.75rem of the app's
// sunken surface on the card's outer edge and above and below it, which the
// slot's width counts on top of the variable. The rails read the strip and the
// open widths too, to size their own faces. Below lg the rails stack around
// the canvas at the full width and none of the variables are read.
const railSlot = 'flex shrink-0 flex-col bg-raised lg:bg-transparent';

// The ease is only switched on once the reader has collapsed or opened a rail:
// a rail restored collapsed on load is put at its width, not travelled to. The
// canvas eases its padding on the same beat, so the email holds still while
// the rail beside it travels.
const railEase = 'transition-[width] duration-base ease-out motion-reduce:transition-none';
const canvasEase = 'transition-[padding] duration-base ease-out motion-reduce:transition-none';

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

        <div className="grid items-start gap-5 lg:grid-cols-[13rem_minmax(0,1fr)_17rem] xl:grid-cols-[16.5rem_minmax(0,1fr)_20rem]">
          <div className="lg:sticky lg:top-4">
            <BlockLibrary editor={model.editor} disabled={readOnly || mode !== 'edit'} />
          </div>
          <div className="min-w-0 space-y-4">
            <ClickHint />
            {/* Editor — same section/header shape as Email details and Brand */}
            <section className={panelClass}>
              <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                <h2 className={panelHeading}>
                  <LayoutTemplateIcon className="size-4 text-muted" />
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
    // From lg the frame is the one thing that scrolls, so its bar sits at the
    // window's edge; the rails are sticky inside it and stay where they are,
    // and the canvas surround runs as long as the email is.
    <div
      data-editor-frame=""
      className={cn(
        'flex flex-1 flex-col lg:min-h-0 lg:flex-row lg:overflow-y-auto lg:[scrollbar-gutter:stable] lg:[--rail-strip:4.5rem] lg:[--rail-left-open:13rem] lg:[--rail-right-open:17rem] xl:[--rail-left-open:16.5rem] xl:[--rail-right-open:20rem]',
        leftCollapsed ? 'lg:[--rail-left:var(--rail-strip)]' : 'lg:[--rail-left:var(--rail-left-open)]',
        rightCollapsed ? 'lg:[--rail-right:var(--rail-strip)]' : 'lg:[--rail-right:var(--rail-right-open)]',
      )}
    >
      {/* LEFT RAIL SLOT. The Components rail is a card floating beside the
          canvas; what it holds scrolls inside it. */}
      <div
        className={cn(
          railSlot,
          left.animate && railEase,
          'border-b-[1.5px] border-line lg:sticky lg:top-0 lg:h-full lg:w-[calc(var(--rail-left)+0.75rem)] lg:self-start lg:border-b-0 lg:py-3 lg:pl-3',
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
          and does not. Each side pads itself to where a 760px email centred
          in the frame would start, less the rail on that side, so the email
          holds the centre line and a fold leaves its room empty; the 16px
          either side of the 760 is slack for rounding. Short of that room the
          padding is the 24px minimum and the email takes the space between
          the rails. The percentages are of the frame's width, so the
          scrollbar at its edge is already left out. */}
      <section
        ref={canvas}
        aria-label="Email canvas"
        className={cn(
          'min-w-0 flex-1 bg-sunken px-6 pt-8 pb-12',
          'lg:pl-[max(1.5rem,calc(50%_-_396px_-_var(--rail-left)_-_0.75rem))] lg:pr-[max(1.5rem,calc(50%_-_396px_-_var(--rail-right)_-_0.75rem))]',
          (left.animate || right.animate) && canvasEase,
        )}
      >
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

      {/* RIGHT RAIL SLOT. The settings scroll inside their card, and the
          status card at their foot stays in view. */}
      <div
        className={cn(
          railSlot,
          right.animate && railEase,
          'border-t-[1.5px] border-line lg:sticky lg:top-0 lg:h-full lg:w-[calc(var(--rail-right)+0.75rem)] lg:self-start lg:border-t-0 lg:py-3 lg:pr-3',
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
    <div className="rounded-xl bg-accent-wash px-4 py-3.5 text-base text-accent-ink">
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
        <h2 className="font-display text-xl font-bold tracking-display text-ink">Make it yours</h2>
        <p className="mt-1 text-base text-muted">Set the inbox details and the look of your email.</p>
      </div>
      {/* Email fields card — same section/header shape as the Brand panel */}
      <section className={panelClass}>
        <header className="border-b border-line px-4 py-2.5">
          <h2 className={panelHeading}>
            <MailIcon className="size-4 text-muted" />
            Email details
          </h2>
        </header>
        <div className="p-4">
        <p className="mb-4 text-base leading-relaxed text-muted">The subject and preview text appear in the inbox. From name, To and Reply to are used for your test email.</p>
        <div className="grid grid-cols-1 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              readOnly={readOnly}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your email subject"
              value={subject}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fromName">From name</Label>
            <Input
              id="fromName"
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Your name or brand"
              value={fromName}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              onChange={(e) => setTo(e.target.value)}
              placeholder="to@example.com"
              type="email"
              value={to}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="replyTo">
              Reply to <span className="font-normal text-muted">(optional)</span>
            </Label>
            <Input
              id="replyTo"
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="replyto@example.com"
              type="email"
              value={replyTo}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Label htmlFor="previewText">Inbox preview text</Label>
          <Input
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

      {template?.short_code ? <Card inset={false} className="p-4">
        <p className="text-base font-bold text-ink">Ready to use this email?</p>
        <p className="mt-1 text-sm text-muted">Publish your changes, then follow the steps to connect it to your app.</p>
        <Button asChild variant="link" size="sm" className="mt-2 px-0">
          <Link href={`/templates/${template.id}/connect`} onClick={async (event) => {
            event.preventDefault();
            if (await model.beforeStage()) window.location.assign(`/templates/${template.id}/connect`);
          }}>Connect your app →</Link>
        </Button>
      </Card> : null}
    </aside>
  );
}
