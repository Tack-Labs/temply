import type { PreflightIssue } from '@temply/shared/preflight';

/** `checking` is not a verdict: it is the state before the checks have run. */
export type PreflightTone = 'checking' | 'success' | 'warn' | 'danger';

export type PreflightStatus = {
  tone: PreflightTone;
  /** The card's heading. The tone is never the only thing that says it. */
  title: string;
  errors: number;
  warnings: number;
  /** Both counts, always, once there is a verdict: "0 errors · 0 warnings"
   *  reads as a clear bill, and a count that comes and goes would shift what
   *  the eye scans for. Empty while checking, when any count would be a
   *  claim nothing has measured. */
  counts: string;
  /** The same facts as one phrase, for the collapsed strip's dot, which has
   *  no text of its own. */
  spoken: string;
};

const count = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

/**
 * What the editor's checks come to, in the three words the rail has for it.
 * Error is the only severity that is red; a warning is amber; neither is
 * green. The checks are advice, not a gate: a send or a publish goes through
 * after one acknowledgement, so no title may promise that it will not. It
 * reads the same `issues` the preflight panel lists, so the card and the
 * panel cannot disagree.
 *
 * `checked` is whether a check has completed. The editor starts with an empty
 * list and fills it half a second later, so without this an empty list would
 * be green for the first beat of every load. There is no default: a caller
 * that forgot it would get that false all-clear back.
 */
export function summarisePreflight(issues: PreflightIssue[], checked: boolean): PreflightStatus {
  if (!checked) {
    return { tone: 'checking', title: 'Checking', errors: 0, warnings: 0, counts: '', spoken: 'Checking' };
  }
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warn').length;
  const tone: Exclude<PreflightTone, 'checking'> = errors > 0 ? 'danger' : warnings > 0 ? 'warn' : 'success';
  const title = { success: 'All clear', warn: 'Worth a look', danger: 'Needs fixing' }[tone];
  return {
    tone,
    title,
    errors,
    warnings,
    counts: `${count(errors, 'error')} · ${count(warnings, 'warning')}`,
    spoken: `${title}, ${count(errors, 'error')}, ${count(warnings, 'warning')}`,
  };
}
