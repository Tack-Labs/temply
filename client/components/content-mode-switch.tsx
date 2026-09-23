'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AlignLeftIcon, CodeIcon, EyeIcon, Loader2Icon, PencilIcon } from 'lucide-react';
import { pressable } from '~/components/ui/button';
import { cn } from '~/lib/classname';

export type ContentMode = 'edit' | 'preview' | 'html' | 'text';

const MODES: { value: ContentMode; label: string; icon: ReactNode }[] = [
  { value: 'edit', label: 'Edit', icon: <PencilIcon className="size-3.5" /> },
  { value: 'preview', label: 'Preview', icon: <EyeIcon className="size-3.5" /> },
  { value: 'html', label: 'HTML', icon: <CodeIcon className="size-3.5" /> },
  { value: 'text', label: 'Text', icon: <AlignLeftIcon className="size-3.5" /> },
];

/** 24px segment plus the 2px gap between them. */
const SEGMENT_STEP = 26;

/**
 * Edit / preview / HTML for the Content section.
 *
 * Previewing is a mode of this section rather than a window opened from
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
  const index = MODES.findIndex((entry) => entry.value === mode);

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
        className={cn(
          'flex items-center gap-1 transition-opacity duration-base ease-out motion-reduce:transition-none',
          showing ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        {held}
      </div>

      {/* The selected segment is a single pill that slides, rather than a
          background that blinks from one button to the next. */}
      <div
        role="group"
        aria-label="Content view"
        className="relative flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5"
      >
        <span
          aria-hidden
          className="absolute top-0.5 left-0.5 size-6 rounded-sm bg-accent-wash transition-transform duration-slow ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(${Math.max(index, 0) * SEGMENT_STEP}px)` }}
        />
        {MODES.map((entry) => (
          <Segment
            key={entry.value}
            label={entry.label}
            icon={
              entry.value === pending ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                entry.icon
              )
            }
            active={entry.value === mode}
            onClick={() => onModeChange(entry.value)}
          />
        ))}
      </div>
    </div>
  );
}

function Segment({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        // Above the sliding pill, and transparent so the pill shows through.
        'relative z-10 flex size-6 items-center justify-center rounded-sm bg-transparent',
        pressable,
        active ? 'text-accent-ink' : 'text-muted hover:text-ink'
      )}
    >
      {icon}
    </button>
  );
}
