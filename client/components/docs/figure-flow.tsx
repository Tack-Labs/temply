/**
 * The four steps from nothing to a sent email, as a strip of numbered cards at
 * `sm` and up and a vertical list below it.
 *
 * The wording is checked against the product, not against the prose: pressing
 * New template seeds a starter email rather than a blank one, and the version
 * a save keeps is a paid-plan feature (`shouldSnapshot` in the server's billing
 * lib returns false on Free).
 */
import type { ReactNode } from 'react';

/** Key names inside a card. `bg-surface` because the card itself is raised. */
function Key({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-xs border border-line bg-surface px-1 py-0.5 font-mono text-xs text-ink">
      {children}
    </code>
  );
}

const steps: { n: number; title: string; body: ReactNode }[] = [
  {
    n: 1,
    title: 'New template',
    body: <>Templates → New template. A starter template opens in the editor.</>,
  },
  {
    n: 2,
    title: 'Name and brand',
    body: <>The Subject field names it. The Brand panel sets the look.</>,
  },
  {
    n: 3,
    title: 'Compose',
    body: (
      <>
        Type, press <Key>/</Key> for a block, drag blocks into order.
      </>
    ),
  },
  {
    n: 4,
    title: 'Preview and save',
    body: <>Check it in Preview, then save. On Pro, every save keeps a version.</>,
  },
];

export function FigureFlow() {
  return (
    <figure className="mt-8 max-w-2xl">
      <ol className="grid gap-2.5 sm:grid-cols-4">
        {steps.map((step) => (
          // min-w-0 so a long word wraps inside its column instead of pushing
          // the four-across strip wider than the measure.
          <li
            key={step.n}
            className="flex min-w-0 flex-col rounded-md border border-line bg-raised p-3"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-wash text-2xs font-medium text-accent-ink">
              {step.n}
            </span>
            <p className="mt-2 text-base font-medium text-ink">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-pretty text-muted">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
      <figcaption className="mt-4 max-w-xl text-sm text-pretty text-muted">
        From there: copy the HTML, or have your app fetch the rendered email
        from the API.
      </figcaption>
    </figure>
  );
}
