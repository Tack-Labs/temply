/**
 * Contrast maths, in one place.
 *
 * This was written three separate times — in the token guard, in the email
 * defaults guard, and again as the CSS filter the preview applies. Three
 * copies of the same formula is how they drift, and the whole point of these
 * checks is that they agree with what the user is shown.
 */

export type RGB = { r: number; g: number; b: number };

export function toRgb(hex: string): RGB {
  const clean = hex.trim().replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function toHex(c: RGB): string {
  const clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  return `#${[c.r, c.g, c.b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

export function luminance(c: RGB): number {
  const channel = (raw: number) => {
    const v = Math.min(255, Math.max(0, raw)) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

export function contrast(a: string | RGB, b: string | RGB): number {
  const l1 = luminance(typeof a === 'string' ? toRgb(a) : a);
  const l2 = luminance(typeof b === 'string' ? toRgb(b) : b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
}

/**
 * `invert(1) hue-rotate(180deg)`, the filter the dark-mode preview applies.
 * At 180 degrees the Filter Effects hue-rotation matrix collapses to these
 * constants. Keeping this beside the checks means a warning shown in the
 * editor describes the same picture the preview draws.
 */
export function forceDark(hex: string | RGB): RGB {
  const c = typeof hex === 'string' ? toRgb(hex) : hex;
  const r = 255 - c.r;
  const g = 255 - c.g;
  const b = 255 - c.b;
  return {
    r: -0.574 * r + 1.43 * g + 0.144 * b,
    g: 0.426 * r + 0.43 * g + 0.144 * b,
    b: 0.426 * r + 1.43 * g - 0.856 * b,
  };
}

/** WCAG AA: 4.5 for body text, 3.0 for large text and non-text marks. */
export const AA_TEXT = 4.5;
export const AA_LARGE = 3.0;

export type ContrastIssue = {
  /** What the reader would be trying to see. */
  subject: string;
  foreground: string;
  background: string;
  ratio: number;
  required: number;
  /** Which rendering it fails in. */
  where: 'as sent' | 'forced dark';
};

/**
 * Checks one foreground/background pair in both the rendering we send and the
 * one an aggressive client would impose, and reports whichever fails.
 */
export function checkPair(
  subject: string,
  foreground: string,
  background: string,
  required: number = AA_TEXT,
): ContrastIssue[] {
  const issues: ContrastIssue[] = [];

  const asSent = contrast(foreground, background);
  if (asSent < required) {
    issues.push({ subject, foreground, background, ratio: asSent, required, where: 'as sent' });
  }

  const dark = contrast(forceDark(foreground), forceDark(background));
  if (dark < required) {
    issues.push({
      subject,
      foreground: toHex(forceDark(foreground)),
      background: toHex(forceDark(background)),
      ratio: dark,
      required,
      where: 'forced dark',
    });
  }

  return issues;
}
