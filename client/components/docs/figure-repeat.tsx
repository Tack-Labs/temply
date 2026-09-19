import { CANVAS, Panel } from './figure-canvas';

/**
 * A Repeat built once and sent with two items: the editor shows one row and
 * the margin mark, the render shows the rows the list made. The values are
 * the ones the JSON block under it sends.
 */
export function FigureRepeat() {
  const row = (name: string, price: string) => (
    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', borderBottom: '1px solid #eceef3' }}>
      <span>{name}</span>
      <span style={CANVAS.muted}>{price}</span>
    </div>
  );
  return (
    <figure className="mt-8 max-w-2xl">
      <div className="grid gap-2.5 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch" aria-hidden>
        <Panel title="In the editor">
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ ...CANVAS.card, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0' }}>
                <span style={CANVAS.pill}>name</span>
                <span style={CANVAS.pill}>price</span>
              </div>
            </div>
            {/* The margin mark that says "repeat" on the canvas. */}
            <div className="flex flex-col items-center gap-1 pt-1 text-accent-ink">
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m2 9 3-3 3 3" /><path d="M13 18H7a2 2 0 0 1-2-2V6" /><path d="m22 15-3 3-3-3" /><path d="M11 6h6a2 2 0 0 1 2 2v10" />
              </svg>
              <span className="w-px flex-1 rounded-full bg-accent-ink" />
            </div>
          </div>
        </Panel>
        <div className="flex items-center justify-center px-1 text-xs font-medium text-muted">
          <span className="rounded-full border border-line bg-raised px-2 py-0.5">× items</span>
        </div>
        <Panel title="Sent with 2 items">
          <div style={CANVAS.card}>
            {row('Notebook', '£12')}
            {row('Pen', '£3')}
          </div>
        </Panel>
      </div>
      <figcaption className="mt-4 max-w-xl text-sm text-pretty text-muted">
        Build the row once with pills; the list decides how many times it appears.
      </figcaption>
    </figure>
  );
}
