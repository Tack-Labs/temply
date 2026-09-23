/**
 * A labelled map of the template editor, so a reader meeting the product for
 * the first time knows what the prose underneath is pointing at.
 *
 * The drawing is CSS only — no image, no SVG — and is `aria-hidden`, because
 * every label it carries is repeated as real text in the numbered list beside
 * it. The callouts are that list rather than lines drawn onto the picture:
 * leader lines cannot survive a column that reflows from 360px to a 700px
 * measure, a numbered list can.
 */
import type { ReactNode } from 'react';

/** The badge that ties a part of the drawing to its entry in the list. */
function Badge({ n }: { n: number }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-wash text-2xs font-medium text-accent-ink">
      {n}
    </span>
  );
}

/** One panel of the drawn editor: a header strip and a body, like the real one. */
function Panel({
  n,
  title,
  aside,
  children,
}: {
  n: number;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-raised">
      <div className="flex items-center justify-between gap-2 border-b border-line px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <Badge n={n} />
          <span className="truncate text-2xs font-medium text-ink">{title}</span>
        </div>
        {aside}
      </div>
      <div className="p-2.5">{children}</div>
    </div>
  );
}

const callouts: { n: number; name: string; what: string }[] = [
  { n: 1, name: 'Email details', what: 'subject, sender, preview text' },
  { n: 2, name: 'Brand', what: 'the look this template uses' },
  { n: 3, name: 'Content', what: 'the email itself, block by block' },
  { n: 4, name: 'Edit / Preview / HTML', what: 'the same content, three ways' },
];

export function FigureAnatomy() {
  return (
    <figure className="mt-8 grid max-w-2xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] lg:items-center lg:gap-8">
      {/* The drawing. Hidden from assistive tech: it is a picture of the list
          on the right, and reading it twice helps nobody. */}
      <div
        aria-hidden
        className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-2.5 sm:p-3"
      >
        <Panel n={1} title="Email details">
          {/* Two field bars. grid-cols-2 holds at 360px because the bars carry
              no text of their own. */}
          <div className="grid grid-cols-2 gap-2">
            <div className="h-5 rounded-xs border border-line bg-sunken" />
            <div className="h-5 rounded-xs border border-line bg-sunken" />
          </div>
        </Panel>

        <Panel n={2} title="Brand">
          <div className="flex flex-wrap items-center gap-2">
            {/* Three swatches, then three chips — the colours and the knobs. */}
            <span className="size-5 rounded-full bg-accent" />
            <span className="size-5 rounded-full border border-line bg-accent-wash" />
            <span className="size-5 rounded-full border border-line bg-sunken" />
            <span className="ml-1 h-4 w-9 rounded-full bg-sunken" />
            <span className="h-4 w-7 rounded-full bg-sunken" />
            <span className="h-4 w-8 rounded-full bg-sunken" />
          </div>
        </Panel>

        <Panel
          n={3}
          title="Content"
          aside={
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge n={4} />
              {/* The three-segment switch, drawn the way it sits in the real
                  Content header: the selected segment washed, the rest quiet. */}
              <div className="flex items-center gap-0.5 rounded-sm border border-line bg-surface p-0.5">
                <span className="size-3 rounded-xs bg-accent-wash" />
                <span className="size-3 rounded-xs bg-sunken" />
                <span className="size-3 rounded-xs bg-sunken" />
              </div>
            </div>
          }
        >
          {/* The canvas: an inset page inside the panel, the way the email sits
              on the editor's own background. */}
          <div className="rounded-sm bg-sunken p-2.5">
            <div className="flex flex-col gap-2 rounded-xs border border-line bg-raised p-3">
              <span className="size-5 rounded-full border border-line bg-accent-wash" />
              <span className="mt-1 h-2.5 w-3/5 rounded-full bg-sunken" />
              <span className="h-1.5 w-full rounded-full bg-sunken" />
              <span className="h-1.5 w-4/5 rounded-full bg-sunken" />
              <span className="mt-1 h-5 w-20 rounded-full bg-accent" />
            </div>
          </div>
        </Panel>
      </div>

      <figcaption>
        <ol className="flex flex-col gap-3">
          {callouts.map((callout) => (
            <li key={callout.n} className="flex gap-3">
              <span className="mt-0.5">
                <Badge n={callout.n} />
              </span>
              {/* min-w-0 so a long label wraps inside the row rather than
                  widening the grid at 360px. */}
              <p className="min-w-0 text-base leading-relaxed text-pretty text-muted">
                <strong className="font-medium text-ink">{callout.name}</strong>{' '}
                — {callout.what}
              </p>
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}
