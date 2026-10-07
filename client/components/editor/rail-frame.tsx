'use client';

import {
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from 'lucide-react';
import { createContext, useCallback, useContext, useLayoutEffect, useRef } from 'react';
import { cn } from '~/lib/classname';
import { Button } from '../ui/button';
import type { RailSide } from './use-rail-collapse';

// What one of the editor's rails is made of, apart from what it holds: a
// floating card with two faces in it, the open panel and the 72px strip, both
// mounted so the one leaves as the other arrives. The width is not decided
// here; the slot around the rail eases it, and these read the custom
// properties the layout root sets:
//   --rail-strip       the collapsed width
//   --rail-left-open   the open widths, which differ by side and by
//   --rail-right-open  breakpoint
// Each face is a fixed width at lg and up, so the text in the panel does not
// reflow as the slot narrows around it; the card clips what does not fit. The
// 3px taken off is the card's own border, which sits inside its width.
const openWidth = {
  left: 'lg:w-[calc(var(--rail-left-open)-3px)]',
  right: 'lg:w-[calc(var(--rail-right-open)-3px)]',
} as const;

const fade = 'transition-opacity duration-base ease-out motion-reduce:transition-none';

const TOGGLE = '[data-rail-toggle]';

const RailContext = createContext<((focus?: string) => void) | null>(null);

/**
 * `animate` is false until the reader has toggled: a rail restored collapsed
 * on load is already at rest, and neither face fades. `inert` goes with
 * `aria-hidden` on the face not shown, since a hidden control that is still
 * focusable is worse than a visible one.
 *
 * Below lg the rails stack around the canvas and cannot collapse: the strip is
 * not drawn and the layout never passes `collapsed`.
 *
 * Focus follows the toggle. A click on a control inside the face being
 * hidden would otherwise leave focus on a node that has just gone inert, so
 * once the faces have swapped it lands on the equivalent control in the other:
 * the toggle, or whatever selector the control asked for. A toggle the reader
 * did not ask for (a stored collapse restored, a window resized past lg)
 * moves nothing.
 */
export function RailFrame({
  label,
  side,
  collapsed,
  animate,
  onToggle,
  open,
  strip,
}: {
  /** The landmark's name; it stays the same in both faces. */
  label: string;
  side: RailSide;
  collapsed: boolean;
  animate: boolean;
  onToggle: () => void;
  open: React.ReactNode;
  strip: React.ReactNode;
}) {
  const openFace = useRef<HTMLDivElement>(null);
  const stripFace = useRef<HTMLDivElement>(null);
  const focusAfter = useRef<string | null>(null);

  useLayoutEffect(() => {
    const selector = focusAfter.current;
    if (!selector) return;
    focusAfter.current = null;
    (collapsed ? stripFace : openFace).current?.querySelector<HTMLElement>(selector)?.focus();
  }, [collapsed]);

  const toggle = useCallback(
    (focus?: string) => {
      focusAfter.current = focus ?? TOGGLE;
      onToggle();
    },
    [onToggle],
  );

  return (
    <RailContext.Provider value={toggle}>
      {/* From lg the landmark is the card that floats over the canvas, as tall
          as the area it sits in: what a rail holds scrolls inside it, never
          the page. Collapsed, the panel stops holding the card open and is
          clipped to it. */}
      <aside
        aria-label={label}
        className="relative flex min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-clip lg:rounded-card lg:border-[1.5px] lg:border-line lg:bg-raised lg:shadow-md"
      >
        <div
          ref={openFace}
          aria-hidden={collapsed}
          inert={collapsed}
          className={cn(
            'flex flex-1 flex-col lg:min-h-0',
            openWidth[side],
            collapsed
              ? 'pointer-events-none opacity-0 lg:absolute lg:inset-y-0 lg:left-0 lg:overflow-clip'
              : 'opacity-100',
            animate && fade,
          )}
        >
          {open}
        </div>
        <div
          ref={stripFace}
          aria-hidden={!collapsed}
          inert={!collapsed}
          className={cn(
            'absolute inset-y-0 left-0 hidden w-[calc(var(--rail-strip)-3px)] lg:block',
            collapsed ? 'opacity-100' : 'pointer-events-none opacity-0',
            animate && fade,
          )}
        >
          {strip}
        </div>
      </aside>
    </RailContext.Provider>
  );
}

const toggleIcons = {
  left: { collapse: PanelLeftCloseIcon, expand: PanelLeftOpenIcon },
  right: { collapse: PanelRightCloseIcon, expand: PanelRightOpenIcon },
} as const;

/**
 * The 44px round control that collapses a rail from its panel or expands it
 * from its strip. It is drawn from lg up only, where there is a column to
 * collapse.
 */
export function RailToggle({
  side,
  expanded,
  label,
  className,
}: {
  side: RailSide;
  /** True on the panel's collapse button, false on the strip's expand one. */
  expanded: boolean;
  label: string;
  className?: string;
}) {
  const toggle = useContext(RailContext);
  const Icon = toggleIcons[side][expanded ? 'collapse' : 'expand'];
  return (
    <Button
      variant="ghost"
      size="icon"
      data-rail-toggle=""
      aria-label={label}
      aria-expanded={expanded}
      onClick={() => toggle?.()}
      className={cn('hidden size-11 text-muted lg:inline-flex [&_svg]:size-5', className)}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}

/**
 * A strip chip that expands the rail when pressed and puts focus on the
 * control it names, rather than on the toggle.
 */
export function useRailExpand(): (focus: string) => void {
  const toggle = useContext(RailContext);
  return useCallback((focus: string) => toggle?.(focus), [toggle]);
}
