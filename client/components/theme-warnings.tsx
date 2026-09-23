'use client';

import { AlertTriangleIcon } from 'lucide-react';
import type { RendererThemeOptions } from '@temply/shared/theme';
import { DEFAULT_RENDERER_THEME } from '@temply/shared/theme';
import { checkPair, type ContrastIssue } from '@temply/shared/contrast';
import { pressable } from '~/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';

/**
 * The colours the renderer applies to text. They are not editable in the Brand
 * panel, but the background under them is, so they have to be part of the
 * check.
 */
const CONTENT_TEXT = {
  Headings: '#111827',
  'Body copy': '#374151',
  'Footer text': '#64748B',
} as const;

export function themeIssues(theme: RendererThemeOptions): ContrastIssue[] {
  const d = DEFAULT_RENDERER_THEME;
  const container = theme.container?.backgroundColor ?? d.container?.backgroundColor ?? '#FFFFFF';
  const link = theme.link?.color ?? d.link?.color ?? '#346FE4';
  const buttonFill = theme.button?.backgroundColor ?? d.button?.backgroundColor ?? '#000000';
  const buttonLabel = theme.button?.color ?? d.button?.color ?? '#FFFFFF';

  return [
    ...Object.entries(CONTENT_TEXT).flatMap(([subject, colour]) =>
      checkPair(subject, colour, container),
    ),
    ...checkPair('Links', link, container),
    ...checkPair('The button label', buttonLabel, buttonFill),
  ];
}

/** Which colour field each finding belongs beside. */
export type ThemeIssueField = 'card-background' | 'link' | 'button-text';

/**
 * One entry per subject — the harsher of the light/forced-dark pair is the
 * one worth acting on.
 */
export function worstPerSubject(issues: ContrastIssue[]): ContrastIssue[] {
  const worst = new Map<string, ContrastIssue>();
  for (const issue of issues) {
    const seen = worst.get(issue.subject);
    if (!seen || issue.ratio < seen.ratio) worst.set(issue.subject, issue);
  }
  return [...worst.values()];
}

export function issuesForField(
  theme: RendererThemeOptions,
  field: ThemeIssueField,
): ContrastIssue[] {
  const subjects: Record<ThemeIssueField, string[]> = {
    'card-background': ['Headings', 'Body copy', 'Footer text'],
    link: ['Links'],
    'button-text': ['The button label'],
  };
  const wanted = subjects[field];
  return worstPerSubject(themeIssues(theme).filter((issue) => wanted.includes(issue.subject)));
}

/**
 * A small warning beside the specific colour that causes a readability
 * problem. The detail lives in a popover, so nobody is confronted with
 * contrast ratios uninvited.
 */
export function ThemeIssueHint({ issues }: { issues: ContrastIssue[] }) {
  if (issues.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="This colour may be hard to read — details"
          className={`inline-flex size-4 items-center justify-center rounded-full text-danger-ink hover:bg-danger-wash ${pressable}`}
        >
          <AlertTriangleIcon className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <p className="text-sm font-medium text-ink">Hard to read with this colour</p>
        <ul className="mt-1.5 space-y-1">
          {issues.map((issue) => (
            <li key={`${issue.subject}-${issue.where}`} className="text-xs text-muted">
              <span className="text-ink">{issue.subject}</span> sit
              {issue.subject.endsWith('s') ? '' : 's'} at{' '}
              <span className="font-mono tabular-nums">{issue.ratio}:1</span> against the background
              {issue.where === 'forced dark' ? ' once a client forces dark mode' : ''}. Aim for{' '}
              <span className="font-mono tabular-nums">{issue.required}:1</span>.
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
