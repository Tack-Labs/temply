'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Loader2Icon } from 'lucide-react';
import { pressable } from '~/components/ui/button';
import { cn } from '~/lib/classname';

export type ContentMode = 'edit' | 'preview' | 'html' | 'text';

const MODES: { value: ContentMode; label: string }[] = [
  { value: 'edit', label: 'Edit' },
  { value: 'preview', label: 'Preview' },
  { value: 'html', label: 'HTML' },
  { value: 'text', label: 'Text' },
];

/**
 * Edit / Preview / HTML / Text for the editor.
 *
 * Previewing is a mode of the editor rather than a window opened from
 * elsewhere: the thing being previewed and the way to reach it belong in one
 * place. Controls belonging to the current view live to the left of the
 * switch, so the switch itself never moves as they appear.
 */
export function ContentModeSwitch({
  mode,
  onModeChange,
  viewControls,
  pending,
}: {
  mode: ContentMode;
  onModeChange: (next: ContentMode) => void;
  /** Controls for the current view; they fade as the view changes. */
  viewControls?: ReactNode;
  /** The view being rendered — its segment spins until the pane swaps. */
  pending?: ContentMode | null;
}) {
  // The controls of the view we are leaving stay on screen while they fade;
  // dropping them the moment the mode changed made them vanish in a frame.
  const [held, setHeld] = useState<ReactNode>(viewControls);
  const showing = Boolean(viewControls);
  useEffect(() => {
    if (viewControls) setHeld(viewControls);
  }, [viewControls]);

  return (
    <div className="flex items-center gap-2">
      <div
        aria-hidden={!showing}
        inert={!showing}
        className={cn(
          'flex items-center gap-1 transition-opacity duration-base ease-out motion-reduce:transition-none',
          showing ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        {held}
      </div>

      <div role="group" aria-label="Content view" className="flex items-center gap-0.5 rounded-full bg-track p-1">
        {MODES.map((entry) => (
          <Segment
            key={entry.value}
            label={entry.label}
            active={entry.value === mode}
            pending={entry.value === pending}
            onClick={() => onModeChange(entry.value)}
          />
        ))}
      </div>
    </div>
  );
}

function Segment({
  label,
  active,
  pending,
  onClick,
}: {
  label: string;
  active: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-busy={pending || undefined}
      onClick={onClick}
      className={cn(
        // One weight for both states: a bolder current segment would widen it
        // and nudge its neighbours each time the mode changed. The fill and
        // the ink carry the state.
        'relative inline-flex h-10 items-center justify-center rounded-full px-[18px] text-ui font-semibold',
        pressable,
        active ? 'bg-raised text-ink shadow-xs' : 'bg-transparent text-ink-soft hover:text-ink'
      )}
    >
      {label}
      {/* Drawn in the padding at the end of the segment, so the label keeps
          its place and the segment keeps its width while the view loads. */}
      {pending ? <Loader2Icon aria-hidden="true" className="absolute right-1 size-3 animate-spin motion-reduce:animate-none" /> : null}
    </button>
  );
}
