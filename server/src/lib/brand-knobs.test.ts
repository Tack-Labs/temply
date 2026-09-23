import { describe, expect, it } from 'bun:test';
import { applyKnobs, bestTextOn, knobsFromTheme } from '@temply/shared/brand-knobs';
import { BRAND_PRESETS } from '@temply/shared/brand-presets';

const classic = BRAND_PRESETS[0].theme;

describe('bestTextOn', () => {
  it('picks white on a dark accent, black on a light one', () => {
    expect(bestTextOn('#18181B')).toBe('#FFFFFF');
    expect(bestTextOn('#FFE44D')).toBe('#111111');
  });
});

describe('applyKnobs', () => {
  it('sets accent on button + link with a contrasting button text', () => {
    const t = applyKnobs(classic, { accent: '#0F766E', corner: 'round', density: 'compact' });
    expect(t.button?.backgroundColor).toBe('#0F766E');
    expect(t.link?.color).toBe('#0F766E');
    expect(t.button?.color).toBe('#FFFFFF');
    expect(t.container?.borderRadius).toBe('12px');
    expect(t.button?.borderRadius).toBe('12px');
    expect(t.container?.paddingTop).toBe('28px');
    expect(t.body?.paddingTop).toBe('32px');
  });
});

describe('knobsFromTheme', () => {
  it('reads accent/corner/density back from a theme', () => {
    const k = knobsFromTheme(classic);
    expect(k.accent).toBe('#18181B');
    expect(k.corner).toBe('soft'); // radius 6
    expect(k.density).toBe('comfortable'); // pad 40
  });
});

describe('applyKnobs is surgical', () => {
  it('changing only the corner leaves paddings and colours alone', () => {
    // Custom paddings + button text that no knob canonical value produces.
    const custom = {
      ...classic,
      body: { ...classic.body, paddingTop: '77px', paddingBottom: '77px' },
      container: { ...classic.container, paddingTop: '39px', paddingRight: '39px', paddingBottom: '39px', paddingLeft: '39px' },
      button: { ...classic.button, color: '#FFEE00' },
    };
    const k = knobsFromTheme(custom);
    const t = applyKnobs(custom, { ...k, corner: 'round' });

    expect(t.container?.borderRadius).toBe('12px');
    expect(t.button?.borderRadius).toBe('12px');
    // untouched by a corner change:
    expect(t.container?.paddingTop).toBe('39px');
    expect(t.body?.paddingTop).toBe('77px');
    expect(t.button?.color).toBe('#FFEE00');
    expect(t.button?.backgroundColor).toBe(classic.button?.backgroundColor);
  });

  it('changing only the density leaves radius and colours alone', () => {
    const custom = {
      ...classic,
      container: { ...classic.container, borderRadius: '24px' },
      link: { ...classic.link, color: '#AA00AA' },
    };
    const k = knobsFromTheme(custom);
    const t = applyKnobs(custom, { ...k, density: 'compact' });

    expect(t.container?.paddingTop).toBe('28px');
    expect(t.body?.paddingTop).toBe('32px');
    expect(t.container?.borderRadius).toBe('24px');
    expect(t.link?.color).toBe('#AA00AA');
  });

  it('re-applying the current knobs changes nothing', () => {
    const t = applyKnobs(classic, knobsFromTheme(classic));
    expect(t.container?.paddingTop).toBe(classic.container?.paddingTop);
    expect(t.container?.borderRadius).toBe(classic.container?.borderRadius);
    expect(t.button?.color).toBe(classic.button?.color);
  });
});
