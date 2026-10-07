import { useId } from 'react';

// The pack's temply-mark.svg, path data as shipped. It is copied, never retyped:
// the slice is cut at a fixed angle and a hand-edited number bends it.
const MARK_PATH = 'M24 0L336 0A24 24 0 0 1 360 24L360 76A24 24 0 0 1 336 100L24 100A24 24 0 0 1 0 76L0 24A24 24 0 0 1 24 0ZM132 120L228 120A16 16 0 0 1 244 136L244 173.12A16 16 0 0 1 231.42 188.75L135.42 209.75A16 16 0 0 1 116 194.12L116 136A16 16 0 0 1 132 120ZM128.58 231.25L224.58 210.25A16 16 0 0 1 244 225.88L244 304A16 16 0 0 1 228 320L132 320A16 16 0 0 1 116 304L116 246.88A16 16 0 0 1 128.58 231.25Z';

/**
 * The Temply mark: a T cut by one slanted slice, drawn as a single path so the
 * gradient runs across the whole shape. The gradient reads the static
 * `--brand-*` tokens, which are the same in light and dark, so the mark follows
 * neither theme and wants no colour class; `variant="mono"` is for the place
 * that must be one colour and takes `currentColor`. Every instance carries its
 * own gradient id: a page shows several marks, and a gradient defined inside an
 * SVG that is `display: none` paints nothing for the visible one that points
 * at it. Decorative wherever it sits beside the wordmark. The viewBox hugs the
 * shape, so the box is the glyph and sits exactly on the gutter of whatever is
 * beside it. The shape is 9:8, not square: size it by its height.
 */
export function BrandMark({
  className,
  variant = 'gradient',
}: {
  className?: string;
  variant?: 'gradient' | 'mono';
}) {
  // React's ids carry punctuation (`:r1:`, `«r1»`) that `url(#…)` does not
  // resolve the same way in every browser, so only the word characters stay.
  const gradient = `brand-mark-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg viewBox="0 0 360 320" aria-hidden className={className}>
      {variant === 'gradient' ? (
        <>
          <defs>
            <linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1="0" y1="30" x2="290" y2="250">
              <stop offset="0" style={{ stopColor: 'var(--brand-coral)' }} />
              <stop offset="0.45" style={{ stopColor: 'var(--brand-pink)' }} />
              <stop offset="1" style={{ stopColor: 'var(--brand-purple)' }} />
            </linearGradient>
          </defs>
          <path fill={`url(#${gradient})`} d={MARK_PATH} />
        </>
      ) : (
        <path fill="currentColor" d={MARK_PATH} />
      )}
    </svg>
  );
}
