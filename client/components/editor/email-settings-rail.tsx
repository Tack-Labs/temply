'use client';

import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  Loader2Icon,
  MailIcon,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';
import { cn } from '~/lib/classname';
import { Button, pressable } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Card } from '../ui/surfaces';
import { TemplateThemePanel } from '../template-theme-panel';
import { summarisePreflight, type PreflightStatus, type PreflightTone } from './preflight-status';
import { RailFrame, RailToggle, useRailExpand } from './rail-frame';
import type { TemplateEditorModel } from './use-template-editor';

/** The part of the editor's model this rail reads and writes. */
export type SettingsRailModel = Pick<
  TemplateEditorModel,
  | 'template'
  | 'readOnly'
  | 'subject'
  | 'setSubject'
  | 'previewText'
  | 'setPreviewText'
  | 'fromName'
  | 'setFromName'
  | 'to'
  | 'setTo'
  | 'replyTo'
  | 'setReplyTo'
  | 'theme'
  | 'setTheme'
  | 'beforeStage'
  | 'preflight'
  | 'preflightChecked'
  | 'preflightExpanded'
  | 'setPreflightExpanded'
>;

// Severity speaks through the washes and inks that carry it everywhere else:
// success confirms, warn deserves a look, danger blocks. The icon sits in a
// raised circle, so it is the tone's ink on the surface, which the contrast
// gate covers, and the card is the ink on its own wash, which it covers too.
// Checking is not a severity and takes none of them: it is the sunken well
// with neutral ink, so the first verdict arrives as a fade from grey and not
// as a green that was never earned.
const tones: Record<PreflightTone, { wash: string; Icon: LucideIcon; iconClass?: string }> = {
  checking: {
    wash: 'bg-sunken text-ink',
    Icon: Loader2Icon,
    iconClass: 'animate-spin text-muted motion-reduce:animate-none',
  },
  success: { wash: 'bg-success-wash text-success-ink', Icon: CheckIcon },
  warn: { wash: 'bg-warn-wash text-warn-ink', Icon: AlertTriangleIcon },
  danger: { wash: 'bg-danger-wash text-danger-ink', Icon: CircleAlertIcon },
};

const colourFade = 'transition-colors duration-base ease-out motion-reduce:transition-none';

/**
 * The framed editor's right rail: the inbox details of the email, the brand,
 * the way to connect it to an app, and what the checks found. Open it is a
 * form at the rail's width; collapsed it is a 72px strip with one chip that
 * opens the form at its subject, and a dot that keeps the checks' verdict in
 * view.
 *
 * Subject and preview text are the template's and lock when the workspace is
 * read only; the rest only address a test send, which a read-only workspace
 * can still make. The brand is all the template's, so all of it locks.
 */
export function EmailSettingsRail({
  model,
  collapsed,
  animate,
  onToggle,
  onOpenPreflight,
}: {
  model: SettingsRailModel;
  collapsed: boolean;
  animate: boolean;
  onToggle: () => void;
  /** Called when the status card opens the preflight panel, so the parent can
   *  bring it into view: the panel is the canvas's, at the top of the email,
   *  and the rail cannot see where the canvas is scrolled to. */
  onOpenPreflight?: () => void;
}) {
  const {
    template, readOnly, subject, setSubject, previewText, setPreviewText, fromName, setFromName,
    to, setTo, replyTo, setReplyTo, theme, setTheme, preflight, preflightChecked, preflightExpanded,
    setPreflightExpanded,
  } = model;
  const helperId = useId();
  const status = summarisePreflight(preflight.issues, preflightChecked);

  return (
    <RailFrame
      label="Email settings"
      side="right"
      collapsed={collapsed}
      animate={animate}
      onToggle={onToggle}
      open={
        <div className="flex flex-1 flex-col">
          {/* From lg the status card below is opaque and pinned over the foot
              of the scroller, so a field focused from the bottom edge would
              land under it. Each control keeps a scroll margin the height of
              the card at its tallest (164px when an error wraps in the narrow
              rail) and the focus ring (5px), so the browser stops short of it.
              It is set here and not as padding on the scroller because that
              would also move where the canvas scrolls its own blocks to. */}
          <div className="flex flex-col gap-5.5 px-6 pt-5 lg:**:scroll-mb-44">
            {/* The collapse button leads here, on the side the rail collapses
                toward; its 44px target is pulled in so the icon lines up
                with the fields' left edge. */}
            <div className="flex items-center gap-1">
              <RailToggle side="right" expanded label="Collapse email settings panel" className="-ml-3" />
              <h2 className="font-display text-xl font-bold tracking-display text-ink">Email settings</h2>
            </div>

            <div className="flex flex-col gap-5">
              <Field id="subject" label="Subject">
                <Input
                  id="subject"
                  readOnly={readOnly}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Your email subject"
                  value={subject}
                />
              </Field>
              <Field id="fromName" label="From name">
                <Input
                  id="fromName"
                  onChange={(event) => setFromName(event.target.value)}
                  placeholder="Your name or brand"
                  value={fromName}
                />
              </Field>
              <Field id="to" label="To">
                <Input
                  id="to"
                  onChange={(event) => setTo(event.target.value)}
                  placeholder="to@example.com"
                  type="email"
                  value={to}
                />
              </Field>
              <Field id="replyTo" label="Reply to" hint="(optional)">
                <Input
                  id="replyTo"
                  onChange={(event) => setReplyTo(event.target.value)}
                  placeholder="replyto@example.com"
                  type="email"
                  value={replyTo}
                />
              </Field>
              <Field id="previewText" label="Inbox preview text">
                <Input
                  id="previewText"
                  aria-describedby={helperId}
                  readOnly={readOnly}
                  onChange={(event) => setPreviewText(event.target.value)}
                  placeholder="Preview text shown in inbox..."
                  value={previewText}
                />
                <p id={helperId} className="pl-1 text-sm text-muted">
                  The grey line after the subject in most inboxes.
                </p>
              </Field>
            </div>

            <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
              <TemplateThemePanel theme={theme} onChange={setTheme} />
            </fieldset>

            {template?.short_code ? (
              <Card inset={false} className="p-4">
                <p className="text-base font-bold text-ink">Ready to use this email?</p>
                <p className="mt-1 text-sm text-muted">
                  Publish your changes, then follow the steps to connect it to your app.
                </p>
                <Button asChild variant="link" size="sm" className="mt-2 px-0">
                  <Link
                    href={`/templates/${template.id}/connect`}
                    onClick={async (event) => {
                      event.preventDefault();
                      if (await model.beforeStage()) window.location.assign(`/templates/${template.id}/connect`);
                    }}
                  >
                    Connect your app →
                  </Link>
                </Button>
              </Card>
            ) : null}
          </div>

          {/* At the foot of the rail, and from lg pinned to the foot of the
              window as the settings scroll past. The surface behind it hides
              what goes under. Stacked below lg it is simply the last thing in
              the flow: pinned there it would sit over the fields on a phone. */}
          <div className="mt-auto bg-raised px-6 pt-4 pb-6 lg:sticky lg:bottom-0">
            <StatusCard
              status={status}
              expanded={preflightExpanded}
              onToggle={() => {
                if (!preflightExpanded) onOpenPreflight?.();
                setPreflightExpanded((current) => !current);
              }}
            />
          </div>
        </div>
      }
      strip={
        // The top padding is on the pinned box, not on the strip around it:
        // pinned at top-0 the box would otherwise sit flush to the scrollport
        // and clip the expand button's focus ring. The left strip does the same.
        <div className="flex h-full flex-col items-center pb-6">
          <div className="sticky top-0 flex flex-col items-center gap-3 pt-5">
            <RailToggle side="right" expanded={false} label="Expand email settings panel" />
            <div aria-hidden="true" className="my-1 h-[1.5px] w-8 bg-line" />
            <SettingsChip />
          </div>
          <div className="sticky bottom-6 mt-auto pt-3">
            <StatusDot status={status} />
          </div>
        </div>
      }
    />
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="pl-1 text-base font-bold text-ink">
        {label}
        {hint ? <span className="ml-1.5 font-normal text-muted">{hint}</span> : null}
      </Label>
      {children}
    </div>
  );
}

/**
 * The checks' verdict as a card. Clear, it is a statement and nothing to
 * press: the preflight panel is not on screen, so there is nothing for it to
 * open. With findings it is the disclosure for that panel, so the counts here
 * and the list there are one thing. The wash fades between tones when the
 * findings change under the reader's hands, and the control inside it is
 * the only part that swaps.
 *
 * Until the first check has completed it says so, in the neutral well and
 * with a placeholder where the counts will be. The placeholder is as tall as
 * the line it stands for, so the verdict replaces it without moving the card.
 */
function StatusCard({
  status,
  expanded,
  onToggle,
}: {
  status: PreflightStatus;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { wash, Icon, iconClass } = tones[status.tone];
  const interactive = status.errors + status.warnings > 0;
  const layout = 'flex w-full items-center gap-3 rounded-card px-4.5 py-4 text-left';
  const body = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-raised [&_svg]:size-5">
        <Icon aria-hidden="true" className={iconClass} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-lg font-bold">{status.title}</span>
        {status.tone === 'checking' ? (
          // The text-base line is 22px: 14px of bar and 4px above and below.
          <Skeleton className="my-1 h-3.5 w-28" />
        ) : (
          <span className="text-base">{status.counts}</span>
        )}
      </span>
      {interactive ? (
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 transition-transform duration-base ease-out motion-reduce:transition-none',
            expanded && 'rotate-180',
          )}
        />
      ) : null}
    </>
  );
  return (
    <div data-status={status.tone} className={cn('rounded-card', colourFade, wash)}>
      {interactive ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className={cn(layout, pressable, 'cursor-pointer hover:brightness-95')}
        >
          {body}
        </button>
      ) : (
        <div className={layout}>{body}</div>
      )}
    </div>
  );
}

/** The collapsed rail's stand-in for the card: the same tone and the same counts, as a name. */
function StatusDot({ status }: { status: PreflightStatus }) {
  const { wash, Icon, iconClass } = tones[status.tone];
  return (
    <span
      role="img"
      aria-label={status.spoken}
      className={cn('grid size-12 place-items-center rounded-full [&_svg]:size-5', colourFade, wash)}
    >
      <Icon aria-hidden="true" className={iconClass} />
    </span>
  );
}

/** The strip's one chip: it stands for the whole form, and opens it at the subject. */
function SettingsChip() {
  const expand = useRailExpand();
  const label = 'Email settings: subject, sender and preview text';
  return (
    <button
      type="button"
      aria-label={label}
      // Icon-only, so a pointer gets the name too.
      title={label}
      onClick={() => expand('#subject')}
      className={cn(
        pressable,
        'grid size-12 cursor-pointer place-items-center rounded-xl border-[1.5px] border-line bg-raised text-accent-ink hover:border-line-strong hover:bg-hover [&_svg]:size-5',
      )}
    >
      <MailIcon aria-hidden="true" />
    </button>
  );
}
