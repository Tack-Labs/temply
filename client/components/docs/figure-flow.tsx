/**
 * The four steps from nothing to a sent email, as a strip of numbered cards at
 * `sm` and up and a vertical list below it.
 *
 * The wording is checked against the product, not against the prose: pressing
 * New template seeds a starter email rather than a blank one, edits save
 * themselves into a draft, and a version is kept on publish, not on save, on
 * every plan (`snapshotVersion` in the server's template routes).
 */
import type { ReactNode } from 'react';
import { docsPanel } from '~/components/docs/panel';
import { cn } from '~/lib/classname';

/** Key names inside a card. `bg-surface` because the card itself is raised. */
function Key({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-sm bg-sunken px-1.5 py-0.5 font-mono text-sm text-ink">
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
    title: 'Preview and publish',
    body: <>Check it in Preview, then publish. Every publish keeps a version.</>,
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
            className={cn(docsPanel, 'flex min-w-0 flex-col p-4')}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-wash text-xs font-semibold text-accent-ink">
              {step.n}
            </span>
            <p className="mt-3 text-ui font-semibold text-ink">{step.title}</p>
            <p className="mt-1 text-base leading-relaxed text-pretty text-muted">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
      <figcaption className="mt-4 max-w-xl text-base text-pretty text-muted">
        From there: copy the HTML, or have your app fetch the rendered email
        from the API.
      </figcaption>
    </figure>
  );
}
