'use client';

import type { FocusPosition } from '@tiptap/core';
import {
  GlobeIcon,
  LayoutTemplateIcon,
  Loader2Icon,
  MailIcon,
  MoonIcon,
  SendIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '~/lib/classname';
import { EMAIL_TRANSFORM, isLibraryUrl, UPLOAD_MIME_TYPES, withTransform } from '~/lib/assets';
import { Button } from '../ui/button';
import { Badge } from '../ui/surfaces';
import { ReadOnlyNotice } from '../dashboard/billing-banner';
import { AssetPickerDialog } from '../assets/asset-picker-dialog';
import { DeleteEmailDialog } from '../delete-email-dialog';
import { EmailEditor } from '../email-editor';
import { ContentModeSwitch } from '../content-mode-switch';
import { ContentPreview } from '../content-preview';
import { ContentSource } from '../content-source';
import { EditorCheatsheet } from '../editor-cheatsheet';
import { PreviewDataPanel } from '../preview-data-panel';
import { PreflightPanel } from '../preflight-panel';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { VersionHistoryDialog } from '../version-history-dialog';
import { ConfirmPublish } from '../confirm-publish';
import { ShareLinkPopover } from '../share-link-popover';
import { TemplateThemePanel } from '../template-theme-panel';
import { CopyHtmlButton, DownloadButton, SaveStatus, fileSlug } from '../email-editor-sandbox';
import type { TemplateEditorModel } from './use-template-editor';
import { BlockLibrary } from './block-library';

// The app-wide input treatment; the global :focus-visible ring supplies focus.
const inputClass =
  'h-9 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink placeholder:text-muted';

const labelClass = 'block text-sm font-medium text-ink';

export function DesktopEditorLayout({
  model,
  autofocus,
  imageUploads,
}: {
  model: TemplateEditorModel;
  autofocus?: FocusPosition;
  imageUploads: boolean;
}) {
  const {
    template, readOnly,
    subject, setSubject, previewText, setPreviewText, fromName, setFromName, to, setTo, replyTo, setReplyTo,
    theme, setTheme, pageStyle, cardStyle,
    setEditor, editorContent, editorPaneRef, paneClass, paneHeight,
    imageUploader, pickFromLibrary, pickerOpen, settlePick,
    mode, changeMode, pendingMode, forceDark, setForceDark,
    previewKeys, previewData, setPreviewData, hasPreviewData,
    previewHtml, isPreviewPending, htmlSource, textSource,
    preflight, preflightExpanded, setPreflightExpanded,
    saveStatus, autosave, unpublished, publishedLabel, publishStatus, publishBadge,
    isPublishing, publishArmed, sendArmed, handleSend, handleDiscarded, handleRestored,
  } = model;

  return (
    <div className="space-y-6">
      {readOnly ? <ReadOnlyNotice /> : null}

      {/* Toolbar — every control in it acts on a saved template, so on the
          anonymous playground it would render as an empty box. */}
      {template?.id && (
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg border border-line bg-raised p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        {/* The actions sit together; the state of the draft reads as one
            quiet line beside them rather than being threaded between. */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Armed means the first click found errors and opened the checks;
              the second goes through, and wears the colour of what it
              overrides. The label never takes a progress word, so the name a
              reader or a spec finds the button by is the same in flight. */}
          {model.isAdmin ? <ConfirmPublish model={model}>{(publish) => (
            <Button
              variant={publishArmed ? 'danger' : 'primary'}
              disabled={readOnly || isPublishing || (publishStatus === 'published' && !publishArmed)}
              aria-busy={isPublishing}
              onClick={publish}
              title={publishedLabel ?? undefined}
            >
              {isPublishing ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : <GlobeIcon />}
              {publishArmed ? 'Publish anyway' : 'Publish'}
            </Button>
          )}</ConfirmPublish> : null}
          {/* Preview lives in the Content header now, beside what it shows. */}
          <VersionHistoryDialog
            templateId={template.id}
            hasUnpublishedChanges={unpublished}
            onDiscarded={handleDiscarded}
            onRestored={handleRestored}
          />
          <ShareLinkPopover templateId={template.id} initialToken={template.share_token ?? null} />
        </div>
        {/* On a phone the state takes a row of its own under the buttons so
            delete and send stay up on the first row. The save status fades
            rather than unmounts and so keeps its width while hidden; it comes
            after the badge so that width never indents it. The row opens on a
            phone once there is something to read, and a template that has a
            badge keeps one, so it never closes again. The card is a grid with
            no row gap so the closed row costs nothing; the padding inside the
            clipped box is the spacing, and it grows in with the row. The
            badge is keyed on the state so a change of state fades the new
            word in rather than swapping it under the reader. */}
        <div
          className={cn(
            'col-span-2 grid transition-[grid-template-rows,opacity] duration-base ease-out motion-reduce:transition-none sm:row-start-1 sm:grid-rows-[1fr] sm:opacity-100 sm:[grid-column:2/3]',
            publishBadge || saveStatus !== 'idle' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="overflow-hidden">
            <div className="flex items-center gap-2 pt-3 sm:pt-0">
              {publishBadge ? (
                <Badge key={publishStatus} tone={publishBadge.tone} className="fade-in-mount">
                  {publishBadge.label}
                </Badge>
              ) : null}
              <SaveStatus status={saveStatus} onRetry={() => void autosave?.flush()} />
            </div>
          </div>
        </div>

        <div className="col-start-2 row-start-1 flex items-center gap-2 justify-self-end sm:col-start-3">
          {/* Copying the HTML now lives in the Content section's HTML view,
              beside the source it copies — and it copies what is on screen
              instead of rendering the email a second time. */}
          {template?.id && <DeleteEmailDialog templateId={template.id} />}

          {/* Internal-debug delivery — only for a saved template. The
              anonymous playground must not advertise a send capability the
              product does not offer. */}
          <Button onClick={handleSend}>
            <SendIcon />
            {/* "Send anyway" must be readable to mean anything, so the
                armed label stays visible even where "Send" would hide. */}
            <span className={sendArmed ? undefined : 'hidden sm:inline'}>
              {sendArmed ? 'Send anyway' : 'Send a test'}
            </span>
          </Button>
        </div>
      </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[190px_minmax(0,1fr)_280px] xl:grid-cols-[210px_minmax(0,1fr)_300px]">
        <div className="lg:sticky lg:top-4">
          <BlockLibrary editor={model.editor} disabled={readOnly || mode !== 'edit'} />
        </div>
        <div className="min-w-0 space-y-3">
          <div className="rounded-lg bg-accent-wash px-4 py-3 text-sm text-accent-ink">
            Click the email to change its words. Select text or a block to see its formatting options.
          </div>
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
                          <PreviewDataPanel
                            keys={previewKeys}
                            data={previewData}
                            onChange={setPreviewData}
                          />
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

                {/* Not floating in a corner: the bottom right already carries
                    toasts and, in development, Clerk's own badge. */}
                <EditorCheatsheet />
              </div>
            </header>

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
                className={paneClass}
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
              <ContentSource className={paneClass} minHeight={paneHeight} source={htmlSource} />
            )}

            {mode === 'text' && (
              <ContentSource className={paneClass} minHeight={paneHeight} source={textSource} wrap />
            )}
          </section>

        </div>
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
      </div>

      {imageUploads && !readOnly && (
        <AssetPickerDialog
          open={pickerOpen}
          onOpenChange={(open) => { if (!open) settlePick(null); }}
          onPick={(asset) => settlePick(withTransform(asset.url, EMAIL_TRANSFORM))}
        />
      )}
    </div>
  );
}
