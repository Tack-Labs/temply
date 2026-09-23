import { contrast } from './contrast';
import type { RendererThemeOptions } from './theme';

export type Corner = 'sharp' | 'soft' | 'round';
export type Density = 'compact' | 'comfortable';
export type BrandKnobs = { accent: string; corner: Corner; density: Density };

const CORNER_RADIUS: Record<Corner, string> = { sharp: '0', soft: '6px', round: '12px' };

/** White or near-black text, whichever contrasts better with the accent. */
export function bestTextOn(bg: string): string {
  return contrast(bg, '#FFFFFF') >= contrast(bg, '#111111') ? '#FFFFFF' : '#111111';
}

/**
 * Applies only the knobs that CHANGED relative to what the theme already
 * expresses. A knob owns a few fields; touching one knob must not stamp the
 * other knobs' canonical values over custom edits — picking a corner used to
 * reset every padding and repaint the button, which read as data loss.
 */
export function applyKnobs(base: RendererThemeOptions, knobs: BrandKnobs): RendererThemeOptions {
  const current = knobsFromTheme(base);
  const next: RendererThemeOptions = { ...base };

  if (knobs.accent.toUpperCase() !== current.accent) {
    next.button = { ...next.button, backgroundColor: knobs.accent, color: bestTextOn(knobs.accent) };
    next.link = { ...next.link, color: knobs.accent };
  }

  if (knobs.corner !== current.corner) {
    const radius = CORNER_RADIUS[knobs.corner];
    next.container = { ...next.container, borderRadius: radius };
    next.button = { ...next.button, borderRadius: radius };
  }

  if (knobs.density !== current.density) {
    const cardPad = knobs.density === 'compact' ? '28px' : '40px';
    const topPad = knobs.density === 'compact' ? '32px' : '50px';
    next.body = { ...next.body, paddingTop: topPad, paddingBottom: topPad };
    next.container = {
      ...next.container,
      paddingTop: cardPad,
      paddingRight: cardPad,
      paddingBottom: cardPad,
      paddingLeft: cardPad,
    };
  }

  return next;
}

/** Approximate the knob values a theme corresponds to, for showing current
 *  state in the UI. Lossy by design. */
export function knobsFromTheme(theme: RendererThemeOptions): BrandKnobs {
  const accent = (theme.button?.backgroundColor ?? '#18181B').toUpperCase();
  const r = parseInt(theme.container?.borderRadius ?? '0', 10) || 0;
  const corner: Corner = r === 0 ? 'sharp' : r <= 8 ? 'soft' : 'round';
  const pad = parseInt(theme.container?.paddingTop ?? '40', 10) || 40;
  const density: Density = pad <= 34 ? 'compact' : 'comfortable';
  return { accent, corner, density };
}
