'use client';

import type { Editor } from '@tiptap/core';
import { useId, useRef } from 'react';
import type { BlockItem } from '~/core/blocks/types';
import { DEFAULT_SLASH_COMMANDS } from '~/core/editor/extensions/slash-command/default-slash-commands';
import { cn } from '~/lib/classname';
import type { ContentMode } from '../content-mode-switch';
import { pressable } from '../ui/button';
import { Reveal } from '../ui/surfaces';
import { blockLabel, insertBlockBelowSelection } from './insert-block';
import { RailFrame, RailToggle } from './rail-frame';

type Tone = 'content' | 'layout';

// Content is what the email says; layout is how it is arranged. All eleven of
// the library's blocks are here. The tones are the lavender and sky washes,
// never a hue of a component's own.
const GROUPS: { id: Tone; heading: string; titles: string[] }[] = [
  { id: 'content', heading: 'Content', titles: ['Text', 'Heading 1', 'Heading 2', 'Image', 'Logo', 'Button'] },
  { id: 'layout', heading: 'Layout', titles: ['Columns', 'Divider', 'Spacer', 'Section', 'Repeat'] },
];

const tones: Record<Tone, { tile: string; icon: string }> = {
  content: { tile: 'bg-accent-wash text-accent-ink', icon: 'text-accent-ink' },
  layout: { tile: 'bg-sky-wash text-sky-ink', icon: 'text-sky-ink' },
};

/**
 * Why the chips are off, as the sentence the rail shows, or null while they
 * are live. A read-only workspace is said first: switching to Edit would not
 * help there, and the mode is the lesser reason.
 */
export function componentsDisabledReason({ readOnly, mode }: { readOnly: boolean; mode: ContentMode }): string | null {
  if (readOnly) return 'This workspace is read-only, so components cannot be added.';
  if (mode !== 'edit') return 'Switch back to Edit to add components.';
  return null;
}

// What an off chip looks like in either rail: the border drops out, the fill
// is the track, the ink is the disabled one. How it behaves under the pointer
// differs, so that stays with each chip.
const chipOff = 'disabled:border-transparent disabled:bg-track disabled:text-disabled';

function blocksFor(titles: string[]): BlockItem[] {
  const library = DEFAULT_SLASH_COMMANDS[0].commands;
  return titles.flatMap((title) => library.find((block) => block.title === title) ?? []);
}

/**
 * The framed editor's left rail: the blocks a customer can add, as chips, with
 * a click inserting one below the selection. It is the same list and the same
 * insert as the playground's `BlockLibrary`; only the dress differs.
 *
 * Open it is two columns of labelled chips (a single column of compact rows
 * from lg to xl, where the rail is too narrow for two, and a wrapping grid of
 * rows where the layout stacks). Collapsed it is a 72px strip of icon-only
 * chips with the same blocks and the same insert. `disabledReason`, when set,
 * turns every chip off and is the sentence that says why.
 */
export function ComponentsRail({
  editor,
  disabledReason,
  collapsed,
  animate,
  onToggle,
}: {
  editor: Editor | null;
  disabledReason?: string | null;
  collapsed: boolean;
  animate: boolean;
  onToggle: () => void;
}) {
  const hintId = useId();
  const stripHintId = useId();
  const disabled = !editor || Boolean(disabledReason);
  const add = (block: BlockItem) => {
    if (editor) insertBlockBelowSelection(editor, block);
  };

  return (
    <RailFrame
      label="Components"
      side="left"
      collapsed={collapsed}
      animate={animate}
      onToggle={onToggle}
      open={
        // Pinned to the top of the scroll so the chips stay in reach while a
        // long email moves past, and capped to the scroller (`--rail-port`, from
        // the frame) so the pinned box is never taller than what can be seen:
        // a rail pinned at its natural height leaves its foot below the fold
        // wherever the page is scrolled to. The heading and its toggle stay put
        // and the groups scroll under them. The padding sits inside the scroll,
        // so a focus ring at the edge of the chips is not clipped by it.
        <div className="flex flex-col gap-5.5 pt-5 lg:sticky lg:top-0 lg:max-h-(--rail-port)">
          <div className="flex items-center justify-between gap-2 px-4">
            <h2 className="pl-1 font-display text-xl font-bold tracking-display text-ink">Components</h2>
            <RailToggle side="left" expanded label="Collapse components panel" />
          </div>

          <div className="min-h-0 space-y-5.5 px-4 pb-6 lg:overflow-y-auto lg:scroll-py-3 lg:[scrollbar-width:thin]">
            {GROUPS.map((group) => (
              <Group key={group.id} heading={group.heading}>
                {blocksFor(group.titles).map((block) => (
                  <Chip
                    key={block.title}
                    block={block}
                    tone={group.id}
                    disabled={disabled}
                    describedBy={disabledReason ? hintId : undefined}
                    onAdd={add}
                  />
                ))}
              </Group>
            ))}

            <Hint id={hintId} reason={disabledReason} />
          </div>
        </div>
      }
      strip={
        // The same cap as the panel: eleven chips are taller than a laptop's
        // scroller, so the toggle stays put and the chips scroll under it. The
        // top padding is room for the first chip's focus ring inside the scroll.
        <div className="flex flex-col items-center gap-3 pt-5 lg:sticky lg:top-0 lg:max-h-(--rail-port)">
          {/* The panel's copy of the reason is inert while folded, and a
              description cannot be read out of a subtree assistive tech skips,
              so the strip carries the sentence itself. It is mounted only while
              folded: the panel is the one place it is printed otherwise. */}
          {collapsed && disabledReason ? (
            <p id={stripHintId} className="sr-only">
              {disabledReason}
            </p>
          ) : null}
          <RailToggle side="left" expanded={false} label="Expand components panel" />
          <div aria-hidden="true" className="my-1 h-[1.5px] w-8 bg-line" />
          <div className="flex min-h-0 w-full flex-col items-center gap-3 overflow-y-auto pt-2 pb-6 scroll-py-3 [scrollbar-width:thin] [&>*]:shrink-0">
            {GROUPS.flatMap((group) =>
              blocksFor(group.titles).map((block) => (
                <StripChip
                  key={block.title}
                  block={block}
                  tone={group.id}
                  disabled={disabled}
                  reason={disabledReason}
                  describedBy={disabledReason ? stripHintId : undefined}
                  onAdd={add}
                />
              )),
            )}
          </div>
        </div>
      }
    />
  );
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  const headingId = useId();
  return (
    <div role="group" aria-labelledby={headingId} className="flex flex-col gap-2.5">
      <h3 id={headingId} className="pl-1 text-sm font-bold tracking-widest text-muted uppercase">
        {heading}
      </h3>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-2">{children}</div>
    </div>
  );
}

function Chip({
  block,
  tone,
  disabled,
  describedBy,
  onAdd,
}: {
  block: BlockItem;
  tone: Tone;
  disabled: boolean;
  describedBy?: string;
  onAdd: (block: BlockItem) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-describedby={describedBy}
      onClick={() => onAdd(block)}
      className={cn(
        pressable,
        'group flex h-12 cursor-pointer flex-row items-center justify-start gap-2.5 rounded-xl border-[1.5px] border-line bg-raised px-2 text-left text-ui font-semibold text-ink hover:border-line-strong hover:bg-hover',
        'xl:h-23 xl:flex-col xl:justify-center xl:gap-2 xl:px-1 xl:text-center xl:leading-tight',
        chipOff,
        'disabled:pointer-events-none',
      )}
    >
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-lg xl:size-9 [&_svg]:size-5',
          tones[tone].tile,
          'group-disabled:bg-raised group-disabled:text-disabled',
        )}
      >
        {block.icon}
      </span>
      <span className="min-w-0">{blockLabel(block.title)}</span>
    </button>
  );
}

function StripChip({
  block,
  tone,
  disabled,
  reason,
  describedBy,
  onAdd,
}: {
  block: BlockItem;
  tone: Tone;
  disabled: boolean;
  /** Why the chip is off, when there is a reason to give. */
  reason?: string | null;
  describedBy?: string;
  onAdd: (block: BlockItem) => void;
}) {
  const label = `Add ${blockLabel(block.title).toLowerCase()}`;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      aria-describedby={describedBy}
      // Icon-only, so a pointer gets the name too; the accessible name is
      // the label above whether or not this shows. Off, it also carries the
      // reason, since the panel that prints it is not on screen: a sighted
      // reader gets ten grey chips and nothing else to go on.
      title={disabled && reason ? `${label}. ${reason}` : label}
      onClick={() => onAdd(block)}
      // Not `pointer-events-none`, which would suppress the tooltip that is
      // the only place a pointer can read the reason. Hover, the pointer
      // cursor and the press scale are kept off it by hand instead.
      className={cn(
        pressable,
        'grid size-12 place-items-center rounded-xl border-[1.5px] border-line bg-raised enabled:cursor-pointer enabled:hover:border-line-strong enabled:hover:bg-hover [&_svg]:size-5',
        tones[tone].icon,
        chipOff,
        'disabled:active:scale-100',
      )}
    >
      {block.icon}
    </button>
  );
}

/**
 * The callout at the foot of the panel. It says how the chips work, and the
 * `@` tip from the playground's library rides along; when the chips are off it
 * says why instead, so a disabled control is never a mystery. The two swap by
 * height, and the reason is held on screen while it closes so the box does not
 * blank before it shrinks. The claim is only what the product does: a click
 * inserts, and nothing here can be dragged.
 */
function Hint({ id, reason }: { id: string; reason?: string | null }) {
  const lastReason = useRef(reason);
  if (reason) lastReason.current = reason;
  return (
    <div className="rounded-xl bg-accent-wash px-4 py-3.5 text-base text-accent-ink">
      <Reveal open={Boolean(reason)}>
        <p id={id}>{reason ?? lastReason.current}</p>
      </Reveal>
      <Reveal open={!reason}>
        <p>Click a component to add it below the selected block.</p>
        <div className="mt-3 border-t border-accent-edge pt-3">
          <p className="font-bold">Make it personal</p>
          <p className="mt-1">
            Type <kbd className="rounded-xs bg-raised px-1 font-mono text-ink">@</kbd> in a line of text to add a detail that changes, like a first name.
          </p>
        </div>
      </Reveal>
    </div>
  );
}
