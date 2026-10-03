'use client';

import type { HTMLAttributes } from 'react';
import { useParallax } from '~/hooks/use-parallax';
import { useReveal } from '~/hooks/use-reveal';

/** Content stays server-rendered; these wrappers own only its scroll effects. */
export function RevealSection(props: HTMLAttributes<HTMLDivElement>) {
  const ref = useReveal();
  return <div {...props} ref={ref} data-reveal />;
}

export function Parallax({
  speed,
  max,
  relative = false,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { speed: number; max: number; relative?: boolean }) {
  const ref = useParallax(speed, max, { relative });
  return <div {...props} ref={ref} style={{ ...style, transform: 'translate3d(0, var(--parallax-y, 0), 0)' }} />;
}
