/**
 * The Temply mark: three bars tapering downward — a T that is also a stack of
 * templates. Inherits its colour from `currentColor` so each surface sets it
 * with a text class (accent on light chrome, the rail's active ink on the
 * graphite sidebar). Decorative wherever it sits beside the wordmark. The
 * viewBox hugs the bars, so the box is the glyph and sits exactly on the
 * gutter of whatever is beside it; with whitespace inside it the mark sat a
 * few pixels in. Size it by the bars you want: size-4.5 draws them 18px wide.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="6 7 36 36.5" fill="currentColor" aria-hidden className={className}>
      <rect x="6" y="7" width="36" height="9.5" rx="3.5" />
      <rect x="13" y="20.5" width="22" height="9.5" rx="3.5" />
      <rect x="19" y="34" width="10" height="9.5" rx="3.5" />
    </svg>
  );
}
