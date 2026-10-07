'use client';

import type { ReactNode } from 'react';
import { Badge, type BadgeTone } from '~/components/ui/surfaces';
import { useReveal } from '~/hooks/use-reveal';
import { cn } from '~/lib/classname';

export type WorkflowTone = Extract<BadgeTone, 'lavender' | 'mint' | 'peach' | 'sky'>;

// The card is the tone's wash and the stage pill that tone's own badge on the
// raised surface, so the pair is the one the contrast gate already holds. The
// words on the wash are ink and ink-soft, which it holds on every wash too.
const washes: Record<WorkflowTone, string> = {
  lavender: 'bg-accent-wash',
  mint: 'bg-success-wash',
  peach: 'bg-peach-wash',
  sky: 'bg-sky-wash',
};

/**
 * One step of the workflow: Build, Check, Ship, Reuse. The stage is a real
 * sequence, which is why it can mark the card instead of a decorative number.
 * It is a list item, so a screen reader hears four steps, and the title is an
 * h3 under the section's one h2.
 *
 * The scroll reveal stages the card in three beats: the wash lifts in, the
 * copy follows, and the picture settles to full size. A card in a grid has no
 * side to slide in from, so the picture's slide is zeroed and only its scale
 * and fade remain.
 */
export function WorkflowCard({
  stage,
  tone,
  title,
  description,
  visual,
}: {
  stage: string;
  tone: WorkflowTone;
  title: string;
  description: string;
  /** The CSS mock that stands in for a screenshot. */
  visual: ReactNode;
}) {
  const ref = useReveal();
  return (
    // The reveal hook hands back a ref for a div, so the card is a div inside
    // the item, and the item (a grid cell) stretches it to the row's height.
    // `min-w-0` lets the card be the width of its column and no wider: a flex
    // item otherwise refuses to shrink below its widest unbreakable picture.
    <li className="flex">
      <div
        ref={ref}
        data-reveal
        className={cn('flex w-full min-w-0 flex-col gap-3.5 rounded-panel p-6 sm:p-8', washes[tone])}
      >
        <div className="reveal-copy flex flex-col items-start gap-3.5">
          <Badge tone={tone} className="bg-raised px-3.5 text-base">
            {stage}
          </Badge>
          <h3 className="font-display text-2xl font-bold tracking-display text-balance text-ink">{title}</h3>
          <p className="max-w-md text-lg text-pretty text-ink-soft">{description}</p>
        </div>
        <div className="reveal-visual mt-auto pt-3.5">{visual}</div>
      </div>
    </li>
  );
}
