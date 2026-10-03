/**
 * The pieces the docs' figures draw a mock email with. A mail client paints
 * the canvas the same way in both themes, so what sits on it is painted from
 * the theme-invariant `--ds-canvas-*` tokens, which hold in dark mode where
 * the app's own tokens would flip. The chrome around a canvas — panel,
 * header, caption — uses the app's tokens.
 */
import type { CSSProperties, ReactNode } from 'react';

export const CANVAS: Record<string, CSSProperties> = {
  card: { backgroundColor: 'var(--ds-canvas)', color: 'var(--ds-canvas-ink)', borderRadius: 8, padding: '14px 16px', fontSize: 12.5, lineHeight: 1.5 },
  muted: { color: 'var(--ds-canvas-body)' },
  faint: { color: 'var(--ds-canvas-quiet)' },
  pill: { display: 'inline-block', padding: '0 6px', borderRadius: 999, backgroundColor: 'var(--ds-canvas-accent-wash)', color: 'var(--ds-canvas-accent-ink)', fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: '18px', verticalAlign: 'baseline' },
  logo: { width: 22, height: 22, borderRadius: 6, backgroundColor: 'var(--ds-accent)' },
  heading: { display: 'block', marginTop: 10, height: 9, width: '62%', borderRadius: 999, backgroundColor: 'var(--ds-canvas-ink)' },
  line: { display: 'block', marginTop: 7, height: 6, borderRadius: 999, backgroundColor: 'var(--ds-canvas-accent-bar)' },
  button: { display: 'inline-block', marginTop: 12, padding: '5px 12px', borderRadius: 6, backgroundColor: 'var(--ds-canvas-ink)', color: 'var(--ds-canvas-on-accent)', fontSize: 11, fontWeight: 600 },
};

/** A panel with a header strip, the shape every figure shares. */
export function Panel({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={['flex min-w-0 flex-col overflow-hidden rounded-md border border-line bg-raised', className].filter(Boolean).join(' ')}>
      <div className="border-b border-line px-2.5 py-1.5 text-2xs font-medium text-ink">{title}</div>
      <div className="flex-1 p-2.5">{children}</div>
    </div>
  );
}

/** The mini email every dark-mode column shows: the same card, so the only
 *  difference between columns is what the client did to it. */
export function MiniEmail({ style }: { style?: CSSProperties }) {
  return (
    <div style={{ ...CANVAS.card, ...style }}>
      {/* An image, not a coloured box: the preview keeps images the right way
          round under the inversion, so the figure does too. */}
      <div data-image style={CANVAS.logo} />
      <span style={CANVAS.heading} />
      <span style={{ ...CANVAS.line, width: '92%' }} />
      <span style={{ ...CANVAS.line, width: '70%' }} />
      <span style={CANVAS.button}>Get started →</span>
    </div>
  );
}
