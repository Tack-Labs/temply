/**
 * A labelled map of the template editor, so a reader meeting the product for
 * the first time knows what the prose underneath is pointing at. It is drawn
 * the way the desktop editor is framed: the Components rail on the left, the
 * email in the middle under its view switch, the settings on the right. Below
 * `sm` the columns stack, which is also how the phone editor serves them.
 *
 * The drawing is CSS only — no image, no SVG — and is `aria-hidden`, because
 * every label it carries is repeated as real text in the numbered list beside
 * it. The callouts are that list rather than lines drawn onto the picture:
 * leader lines cannot survive a column that reflows from 360px to a 700px
 * measure, a numbered list can.
 */
import type { ReactNode } from 'react';
import { docsPanelRows } from '~/components/docs/panel';
import { cn } from '~/lib/classname';

/** The badge that ties a part of the drawing to its entry in the list. */
function Badge({ n }: { n: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-wash text-xs font-semibold text-accent-ink">
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
    <div className={cn(docsPanelRows, 'overflow-hidden')}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge n={n} />
          <span className="truncate text-xs font-semibold text-ink">{title}</span>
        </div>
        {aside}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

const callouts: { n: number; name: string; what: string }[] = [
  { n: 1, name: 'Components', what: 'the blocks you add, in groups' },
  { n: 2, name: 'Your email', what: 'the email itself, block by block' },
  { n: 3, name: 'Edit / Preview / HTML / Text', what: 'the same email, four ways' },
  { n: 4, name: 'Email details', what: 'subject, sender, preview text' },
  { n: 5, name: 'Brand', what: 'the look this template uses' },
];

/** A block tile in the drawn Components rail: an icon square and a label bar. */
function BlockTile() {
  return (
    <div className="flex items-center gap-1.5 rounded-sm bg-sunken px-1.5 py-1">
      <span className="size-2.5 shrink-0 rounded-xs bg-accent-wash" />
      <span className="h-1.5 flex-1 rounded-full bg-line" />
    </div>
  );
}

export function FigureAnatomy() {
  return (
    <figure className="mt-8 max-w-2xl">
      {/* The drawing. Hidden from assistive tech: it is a picture of the list
          underneath, and reading it twice helps nobody. */}
      <div
        aria-hidden
        className="grid gap-3 rounded-card border border-line bg-surface p-3 sm:grid-cols-[8.5rem_minmax(0,1fr)_8.5rem] sm:items-start sm:p-4"
      >
        <Panel n={1} title="Components">
          <div className="flex flex-col gap-2">
            <span className="h-1.5 w-8 rounded-full bg-line" />
            <BlockTile />
            <BlockTile />
            <BlockTile />
            <span className="mt-1 h-1.5 w-6 rounded-full bg-line" />
            <BlockTile />
            <BlockTile />
          </div>
        </Panel>

        <Panel
          n={2}
          title="Your email"
          aside={
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge n={3} />
              {/* The four-segment switch, drawn the way it sits in the real
                  header: the chosen segment raised, the rest quiet. */}
              <div className="flex items-center gap-0.5 rounded-full bg-track p-0.5">
                <span className="size-3 rounded-full bg-raised shadow-xs" />
                <span className="size-3 rounded-full" />
                <span className="size-3 rounded-full" />
                <span className="size-3 rounded-full" />
              </div>
            </div>
          }
        >
          {/* The canvas: an inset page inside the panel, the way the email sits
              on the editor's own background. */}
          <div className="rounded-md bg-sunken p-3">
            <div className="flex flex-col gap-2 rounded-lg bg-raised p-3 shadow-xs">
              <span className="size-5 rounded-full border border-line bg-accent-wash" />
              <span className="mt-1 h-2.5 w-3/5 rounded-full bg-sunken" />
              <span className="h-1.5 w-full rounded-full bg-sunken" />
              <span className="h-1.5 w-4/5 rounded-full bg-sunken" />
              <span className="h-1.5 w-full rounded-full bg-sunken" />
              <span className="h-1.5 w-2/3 rounded-full bg-sunken" />
              <span className="mt-1 h-5 w-20 rounded-full bg-accent" />
            </div>
          </div>
        </Panel>

        <div className="flex flex-col gap-3">
          <Panel n={4} title="Email details">
            {/* Two field bars, stacked as the rail stacks them. */}
            <div className="flex flex-col gap-2">
              <div className="h-5 rounded-md border border-line bg-sunken" />
              <div className="h-5 rounded-md border border-line bg-sunken" />
            </div>
          </Panel>
          <Panel n={5} title="Brand">
            <div className="flex flex-wrap items-center gap-2">
              {/* Three swatches, then two chips: the colours and the knobs. */}
              <span className="size-5 rounded-full bg-accent" />
              <span className="size-5 rounded-full border border-line bg-accent-wash" />
              <span className="size-5 rounded-full border border-line bg-sunken" />
              <span className="h-4 w-9 rounded-full bg-sunken" />
              <span className="h-4 w-7 rounded-full bg-sunken" />
            </div>
          </Panel>
        </div>
      </div>

      <figcaption className="mt-5">
        <ol className="grid gap-3 sm:grid-cols-2">
          {callouts.map((callout) => (
            <li key={callout.n} className="flex gap-3">
              <span className="mt-0.5">
                <Badge n={callout.n} />
              </span>
              {/* min-w-0 so a long label wraps inside the row rather than
                  widening the grid at 360px. */}
              <p className="min-w-0 text-ui leading-relaxed text-pretty text-muted">
                <strong className="font-semibold text-ink">{callout.name}</strong>: {callout.what}
              </p>
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}
