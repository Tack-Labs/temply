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
// landmark with two faces in it, the open panel and the 72px strip, both
// mounted so the one leaves as the other arrives. The width is not decided
// here; the slot around the rail eases it, and these read the custom
// properties the layout root sets:
//   --rail-strip       the collapsed width
//   --rail-left-open   the open widths, which differ by side and by
//   --rail-right-open  breakpoint
// and one it sets itself, on the landmark:
//   --rail-port        the height of the scroller the rail sits in; unset
//                      until measured, which a cap reads as no cap
// Each face is a fixed width at lg and up, so the text in the panel does not
// reflow as the slot narrows around it; the slot clips what does not fit. The
// 1.5px taken off is the slot's own border, which sits inside its width.
const openWidth = {
  left: 'lg:w-[calc(var(--rail-left-open)-1.5px)]',
  right: 'lg:w-[calc(var(--rail-right-open)-1.5px)]',
} as const;

const fade = 'transition-opacity duration-base ease-out motion-reduce:transition-none';

const TOGGLE = '[data-rail-toggle]';

/**
 * The nearest ancestor that scrolls vertically, which in the editor is the
 * frame's `main`: the window itself does not scroll there.
 */
function scrollportOf(node: HTMLElement): HTMLElement | null {
  for (let up = node.parentElement; up; up = up.parentElement) {
    const { overflowY } = getComputedStyle(up);
    if (overflowY === 'auto' || overflowY === 'scroll') return up;
  }
  return null;
}

/**
 * Publishes the height of the scroller as `--rail-port` on the landmark, for a
 * rail that pins itself to the top of the scroll and has to fit what it shows
 * inside it. CSS cannot say that height here: the slot the rail sits in is as
 * tall as the whole page, so a percentage is the page's, and the window's
 * height leaves out the header and tab row above the scroller, so `100dvh`
 * less their heights would break the first time either changes. Container
 * query units on the scroller (`container-type: size`, then `cqh`) would
 * remove the measuring; they are untried against a live bubble menu, and
 * would put the container on a `main` the playground shares.
 */
function useScrollport(landmark: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = landmark.current;
    const port = element && scrollportOf(element);
    if (!element || !port) return;
    // A scroller that is not laid out reads 0, and a rail capped to nothing
    // is worse than one that is not capped.
    const publish = () => {
      if (port.clientHeight > 0) element.style.setProperty('--rail-port', `${port.clientHeight}px`);
    };
    publish();
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish);
    watch?.observe(port);
    return () => {
      watch?.disconnect();
      element.style.removeProperty('--rail-port');
    };
  }, [landmark]);
}

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
  const landmark = useRef<HTMLElement>(null);
  const openFace = useRef<HTMLDivElement>(null);
  const stripFace = useRef<HTMLDivElement>(null);
  const focusAfter = useRef<string | null>(null);
  useScrollport(landmark);

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
      <aside ref={landmark} aria-label={label} className="relative flex min-w-0 flex-1 flex-col">
        {/* Collapsed, the panel stops holding the row open, and is clipped to
            the rail's box: taken out of the flow it still adds to what the
            scroller can scroll, so a rail taller than a short email would
            leave the canvas a page of empty space beneath it. */}
        <div
          ref={openFace}
          aria-hidden={collapsed}
          inert={collapsed}
          className={cn(
            'flex flex-1 flex-col',
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
            'absolute inset-y-0 left-0 hidden w-[calc(var(--rail-strip)-1.5px)] lg:block',
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
