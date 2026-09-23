'use client';

import { AlertTriangleIcon, ChevronDownIcon } from 'lucide-react';
import { useRef } from 'react';
import { GMAIL_CLIP_BYTES, SIZE_WARN_BYTES, type PreflightIssue } from '@temply/shared/preflight';
import { cn } from '~/lib/classname';
import { Badge } from '~/components/ui/surfaces';

/**
 * The preflight findings, as a banner above the content panes — never a
 * modal: the issues are about the work on screen, so covering it up would be
 * the wrong move. Send is never hard-blocked; with error-level findings the
 * first click opens this panel and the second goes through.
 *
 * The container stays quiet — severity lives in the counts and the per-row
 * labels, not in a coloured wash, so three warnings don't shout like a
 * failure. Red is reserved for what blocks a send; amber for what only
 * deserves a look.
 *
 * This is app-UI chrome. It colours itself from the --ds-* tokens like the
 * rest of the dashboard and must never read the template's theme.
 *
 * It arrives and leaves the way the rest of the app does: a fade on first
 * appearance, and a slide shut when the last finding clears — the previous
 * findings stay on screen while the row collapses, so the banner does not
 * blank a frame before it goes.
 */
export function PreflightPanel({
  issues,
  bytes,
  expanded,
  onToggle,
  onSelect,
  collapsible = true,
}: {
  issues: PreflightIssue[];
  /** Byte size of the as-sent render, or null while it is stale or unknown. */
  bytes: number | null;
  expanded: boolean;
  onToggle?: () => void;
  /** Jumps to the finding's spot in the document. Only issues carrying a
   *  `pos` render as a button — a theme or size finding has nowhere to
   *  jump to, so it stays a plain row. */
  onSelect?: (pos: number) => void;
  /** False where the findings are already the whole of what is on screen —
   *  the phone's Checks sheet — so the header is a heading rather than a
   *  control that advertises itself and does nothing. */
  collapsible?: boolean;
}) {
  const shown = issues.length > 0;
  const lastIssues = useRef(issues);
  if (shown) lastIssues.current = issues;
  const display = shown ? issues : lastIssues.current;
  // Never had a finding: nothing to collapse, so nothing is mounted.
  if (display.length === 0) return null;

  const Header = collapsible ? 'button' : 'div';
  const errors = display.filter((issue) => issue.severity === 'error');
  const warnings = display.filter((issue) => issue.severity === 'warn');
  // Findings arrive in check order; the reader wants blockers first.
  const ordered = [...errors, ...warnings];

  const kb = bytes != null ? Math.round(bytes / 1024) : null;
  const limitKb = Math.round(GMAIL_CLIP_BYTES / 1024);

  return (
    <div
      aria-hidden={!shown}
      className={cn(
        'grid transition-[grid-template-rows] duration-base ease-out motion-reduce:transition-none',
        shown ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className="overflow-hidden">
        <div className="border-b border-line p-3">
          <div className="item-motion overflow-hidden rounded-lg border border-line bg-raised shadow-sm">
            {/* The header is the disclosure's whole target, so it answers the
                pointer the way a Row does: a tint, a press, an inset ring.
                Where it toggles nothing it is a plain row instead — the
                summary still belongs above the list. */}
            <Header
              {...(collapsible ? { type: 'button' as const, 'aria-expanded': expanded, onClick: onToggle } : {})}
              className={
                collapsible
                  ? 'flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-hover active:bg-active focus-visible:-outline-offset-2 motion-reduce:transition-none'
                  : 'flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left'
              }
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <AlertTriangleIcon
                  className={cn(
                    'size-4 shrink-0',
                    errors.length > 0 ? 'text-danger-ink' : 'text-warn-ink',
                  )}
                />
                <span className="text-sm font-medium text-ink">Preflight</span>
                {errors.length > 0 && (
                  <Badge tone="danger">
                    {errors.length} error{errors.length === 1 ? '' : 's'}
                  </Badge>
                )}
                {warnings.length > 0 && (
                  <Badge tone="warn">
                    {warnings.length} warning{warnings.length === 1 ? '' : 's'}
                  </Badge>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-3">
                {kb != null && (
                  <span className="text-2xs text-muted tabular-nums">~{kb} KB</span>
                )}
                {collapsible ? (
                  <ChevronDownIcon
                    className={cn(
                      'size-4 text-muted transition-transform duration-base ease-out motion-reduce:transition-none',
                      expanded && 'rotate-180',
                    )}
                  />
                ) : null}
              </span>
            </Header>

            {/* The 0fr→1fr grid row is the one way to animate to a height the
                content decides; `overflow-hidden` clips the list while it grows. */}
            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-base ease-out motion-reduce:transition-none',
                expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden" aria-hidden={!expanded}>
                <div className="border-t border-line">
                  <ul className="divide-y divide-line">
                    {ordered.map((issue) => {
                      const label = (
                        <>
                          <span
                            className={cn(
                              'w-14 shrink-0 text-2xs font-medium tracking-wide uppercase',
                              issue.severity === 'error' ? 'text-danger-ink' : 'text-warn-ink',
                            )}
                          >
                            {issue.severity === 'error' ? 'Error' : 'Warning'}
                          </span>
                          <span className="text-sm text-ink">
                            {issue.message}
                            {issue.detail ? (
                              <span className="text-muted"> — “{issue.detail}”</span>
                            ) : null}
                          </span>
                        </>
                      );
                      // Only a finding with a document position can be jumped
                      // to; the rest (theme, size) render as a plain row.
                      if (onSelect && issue.pos !== undefined) {
                        const pos = issue.pos;
                        return (
                          <li key={issue.id}>
                            <button
                              type="button"
                              onClick={() => onSelect(pos)}
                              className="flex min-h-11 w-full items-baseline gap-3 px-3.5 py-2 text-left transition-colors hover:bg-hover active:bg-active focus-visible:-outline-offset-2 motion-reduce:transition-none"
                            >
                              {label}
                            </button>
                          </li>
                        );
                      }
                      return (
                        <li key={issue.id} className="flex items-baseline gap-3 px-3.5 py-2">
                          {label}
                        </li>
                      );
                    })}
                  </ul>

                  {bytes != null && kb != null && (
                    <div className="border-t border-line px-3.5 py-2.5">
                      <div className="flex items-baseline justify-between gap-3 text-2xs text-muted">
                        <span>Email size</span>
                        <span className="tabular-nums">
                          ~{kb} KB of {limitKb} KB before Gmail clips
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sunken">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            bytes >= GMAIL_CLIP_BYTES
                              ? 'bg-danger'
                              : bytes >= SIZE_WARN_BYTES
                                ? 'bg-warn'
                                : 'bg-accent',
                          )}
                          style={{ width: `${Math.min(100, (bytes / GMAIL_CLIP_BYTES) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
