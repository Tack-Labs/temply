import type { TemplateListItem } from './template-search';
import { nextStep, sortByStage, stageOf } from './template-stage';

export type NextStepKind = 'waiting' | 'staging' | 'returned' | 'draft';

/**
 * What the banner says about the template it picked. The time is not in it:
 * a relative phrase reads the reader's clock, so the banner fills it in after
 * hydration, between `lead` and `tail`, counting from `stamp`.
 */
export type NextStepCopy = {
  kind: NextStepKind;
  title: string;
  /** What happened, up to where the time goes: "Staged". */
  lead: string;
  stamp: string | null;
  /** The sentence after the time, empty when there is none. */
  tail: string;
  button: string;
  href: string;
};

/**
 * The one template that most needs a look: the first of the list ranked by
 * stage (sign-off, then staging, then a draft), or nothing when every
 * template is live. It takes the whole list, not the rows a page draws, so a
 * template waiting on sign-off is found however long ago it was touched.
 */
export function pickNextStep<Row extends TemplateListItem>(rows: Row[]): Row | null {
  const first = sortByStage(rows)[0] as Row | undefined;
  return first && stageOf(first) !== 'live' ? first : null;
}

/**
 * The words and the destination. The button only ever navigates: the labels
 * `nextStep` gives a draft or a staged copy ("Move to staging", "Ask for
 * sign-off") are actions, and a button that says so while only opening a page
 * would mislead. Only its review label is borrowed, since that one is a page.
 * Nobody is named: the row carries the id of who asked for sign-off, not who
 * they are.
 */
export function nextStepCopy(row: TemplateListItem, isAdmin: boolean): NextStepCopy {
  const title = row.title || 'Untitled';
  const stage = stageOf(row);
  const review = `/templates/${row.id}/review`;

  if (stage === 'waiting') {
    return {
      kind: 'waiting',
      title: isAdmin ? `${title} is ready for your sign-off` : `${title} is waiting for sign-off`,
      lead: 'Moved to sign-off',
      stamp: row.review_requested_at ?? null,
      tail: '',
      button: nextStep('waiting', isAdmin).label,
      href: review,
    };
  }
  if (stage === 'staging' && row.returned_at) {
    return {
      kind: 'returned',
      title: `${title} was sent back`,
      lead: 'Sent back',
      stamp: row.returned_at,
      tail: 'Make the changes, then ask for sign-off again.',
      button: 'Open',
      href: review,
    };
  }
  if (stage === 'staging') {
    return {
      kind: 'staging',
      title: `${title} is in staging`,
      lead: 'Staged',
      stamp: row.staged_at ?? null,
      tail: 'Ask for sign-off when it is ready.',
      button: 'Open',
      href: review,
    };
  }
  return {
    kind: 'draft',
    title: `${title} has unpublished changes`,
    lead: 'Edited',
    stamp: row.updated_at,
    tail: '',
    button: 'Open',
    href: `/templates/${row.id}`,
  };
}
