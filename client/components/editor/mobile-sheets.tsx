'use client';

import { useEffect, useState } from 'react';
import { BracesIcon } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { ContentPreview } from '~/components/content-preview';
import { ContentSource } from '~/components/content-source';
import { PreflightPanel } from '~/components/preflight-panel';
import { PreviewDataPanel } from '~/components/preview-data-panel';
import { TemplateThemePanel } from '~/components/template-theme-panel';
import { EmptyState, ErrorState } from '~/components/ui/surfaces';
import { cn } from '~/lib/classname';
import { CopyHtmlButton, DownloadButton, fileSlug } from '../email-editor-sandbox';
import { BottomSheet } from './bottom-sheet';
import type { TemplateEditorModel } from './use-template-editor';

export type SheetId = 'details' | 'brand' | 'data' | 'checks' | 'eye' | null;

const inputClass =
  'h-11 w-full rounded-md border border-line bg-raised px-3 text-base text-ink placeholder:text-faint';

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type={type}
        className={inputClass}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/**
 * The five bottom sheets that hold everything a phone editor cannot fit
 * beside the canvas. Each one is a thin shell around a panel the desktop
 * layout already owns — the phone changes where a control lives, never what
 * it does.
 */
export function MobileSheets({
  model,
  open,
  onClose,
  returnFocus,
}: {
  model: TemplateEditorModel;
  open: SheetId;
  onClose: () => void;
  /** Passed through to every sheet; see BottomSheet. */
  returnFocus?: boolean;
}) {
  const [eyeTab, setEyeTab] = useState<'preview' | 'html' | 'text'>('preview');
  const close = (o: boolean) => {
    if (!o) onClose();
  };

  // The tab only re-asks for a render on its own click; reopening the sheet
  // on whatever tab was last selected, or opening it the first time, would
  // otherwise show `model.mode` still on 'edit' underneath. changeMode
  // no-ops when the signature already matches, so this costs nothing on the
  // path the click already covers.
  useEffect(() => {
    if (open === 'eye') model.changeMode(eyeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eyeTab]);

  return (
    <>
      <BottomSheet returnFocus={returnFocus} open={open === 'details'} onOpenChange={close} title="Email details">
        <div className="space-y-4 py-1">
          <Field id="m-subject" label="Subject" value={model.subject} onChange={model.setSubject} placeholder="Your email subject" />
          <Field id="m-from" label="From name" value={model.fromName} onChange={model.setFromName} placeholder="Your name or brand" />
          <Field id="m-to" label="To" value={model.to} onChange={model.setTo} placeholder="to@example.com" type="email" />
          <Field id="m-reply" label="Reply to" value={model.replyTo} onChange={model.setReplyTo} placeholder="replyto@example.com" type="email" />
          <Field id="m-preview" label="Preview text" value={model.previewText} onChange={model.setPreviewText} placeholder="Preview text shown in inbox…" />
        </div>
      </BottomSheet>

      <BottomSheet returnFocus={returnFocus} open={open === 'brand'} onOpenChange={close} title="Brand" height="full">
        {/* The brand card comes across from the desktop as it is, controls
            sized for a mouse — 32px buttons, a 16px slider. The ones it draws
            inline are grown here; the brand dropdown's rows and the colour
            popovers render in portals no wrapper class can reach, so they take
            `touch` instead. */}
        <div className="[&_button]:min-h-11 [&_input]:min-h-11">
          <TemplateThemePanel theme={model.theme} onChange={model.setTheme} touch className="border-0 bg-transparent shadow-none" />
        </div>
      </BottomSheet>

      <BottomSheet returnFocus={returnFocus} open={open === 'data'} onOpenChange={close} title="Sample data">
        {model.hasPreviewData ? (
          /* The panel is the desktop popover's: 28px fields and steppers, a
             14px checkbox. Grown to the shell's 44px row here, not in the
             shared panel. */
          <div className="[&_button]:min-h-11 [&_button]:min-w-11 [&_input[type=checkbox]]:size-6 [&_input[type=text]]:min-h-11 [&_label]:min-h-11">
            <PreviewDataPanel keys={model.previewKeys} data={model.previewData} onChange={model.setPreviewData} />
          </div>
        ) : (
          <EmptyState
            icon={BracesIcon}
            title="No variables yet"
            description="Add a {{variable}} or a show-if condition to the email and its sample values appear here."
          />
        )}
      </BottomSheet>

      <BottomSheet returnFocus={returnFocus} open={open === 'checks'} onOpenChange={close} title="Checks">
        {model.preflight.issues.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            Nothing to fix
            {model.preflight.bytes !== null
              ? ` — ~${Math.round(model.preflight.bytes / 1024)} KB of 102 KB.`
              : '.'}
          </p>
        ) : (
          // No onSelect: a read-only canvas has nothing to jump a finding
          // to, so every row renders plain rather than as a dead button.
          <PreflightPanel
            issues={model.preflight.issues}
            bytes={model.preflight.bytes}
            expanded
            collapsible={false}
          />
        )}
      </BottomSheet>

      <BottomSheet returnFocus={returnFocus} open={open === 'eye'} onOpenChange={close} title="Preview" showTitle={false} height="full">
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-2 border-b border-line bg-raised px-4 pb-2">
          <div role="tablist" aria-label="View" className="flex gap-1">
            {(['preview', 'html', 'text'] as const).map((tab) => (
              <button
                type="button"
                key={tab}
                role="tab"
                aria-selected={eyeTab === tab}
                // Only the tab changes here: the effect below covers the mode,
                // and asking for it twice put two renders of the same email on
                // the wire before the first had answered.
                onClick={() => setEyeTab(tab)}
                className={cn(
                  'h-11 rounded-md px-3 text-sm font-medium transition-colors duration-fast ease-out motion-reduce:transition-none',
                  eyeTab === tab ? 'bg-accent-wash text-accent-ink' : 'text-muted hover:bg-hover hover:text-ink',
                )}
              >
                {tab === 'preview' ? 'Preview' : tab === 'html' ? 'HTML' : 'Text'}
              </button>
            ))}
          </div>
          {eyeTab !== 'preview' ? (
            /* Copy and download arrive as the desktop's 28px icon squares. */
            <div className="flex items-center gap-1 [&_button]:size-11">
              <CopyHtmlButton
                html={eyeTab === 'html' ? model.htmlSource : model.textSource}
                label={eyeTab === 'html' ? 'Copy HTML' : 'Copy text'}
              />
              <DownloadButton
                content={eyeTab === 'html' ? model.htmlSource : model.textSource}
                filename={`${fileSlug(model.subject)}.${eyeTab === 'html' ? 'html' : 'txt'}`}
                mimeType={eyeTab === 'html' ? 'text/html' : 'text/plain'}
                label={eyeTab === 'html' ? 'Download HTML' : 'Download text'}
              />
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={model.forceDark}
              onClick={() => model.setForceDark((v) => !v)}
              className={cn('h-11', model.forceDark && 'bg-accent-wash text-accent-ink hover:bg-accent-wash hover:text-accent-ink')}
            >
              Forced dark
            </Button>
          )}
        </div>
        <div className="-mx-4">
          {model.previewError ? (
            /* The desktop stays on the edit pane when a render fails, so the
               work is still on screen and the toast is enough. The sheet has
               covered the canvas, so an empty pane would be all there is. */
            <div className="item-motion px-4 pt-4">
              <ErrorState
                title="Could not render this email"
                description={model.previewError}
                onRetry={() => model.changeMode(eyeTab)}
              />
            </div>
          ) : eyeTab === 'preview' ? (
            <ContentPreview
              className={cn('min-h-[60dvh]', model.paneClass)}
              html={model.previewHtml}
              isPending={model.isPreviewPending}
              forceDark={model.forceDark}
              subject={model.subject}
              previewText={model.previewText}
              from={model.fromName}
            />
          ) : (
            <ContentSource
              className={cn('min-h-[60dvh]', model.paneClass)}
              source={eyeTab === 'html' ? model.htmlSource : model.textSource}
              wrap={eyeTab === 'text'}
            />
          )}
        </div>
      </BottomSheet>
    </>
  );
}
