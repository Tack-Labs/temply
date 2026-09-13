import { CANVAS, Panel } from './figure-canvas';

/**
 * One pill in its three places — the editor, the HTML, the inbox — so the
 * word "variable" has a picture before the prose explains placeholders and
 * data. Drawn, `aria-hidden`; the same three states are the paragraph above.
 */
export function FigureVariable() {
  return (
    <figure className="mt-8 max-w-2xl">
      <div className="grid gap-2.5 sm:grid-cols-3" aria-hidden>
        <Panel title="1 · In the editor">
          <div style={CANVAS.card}>
            Hi <span style={CANVAS.pill}>firstName</span>,
          </div>
        </Panel>
        <Panel title="2 · In the HTML">
          <div style={{ ...CANVAS.card, fontFamily: 'ui-monospace, monospace', fontSize: 11.5 }}>
            Hi <span style={{ color: '#4338ca' }}>{'{{firstName}}'}</span>,
          </div>
        </Panel>
        <Panel title="3 · In the inbox">
          <div style={CANVAS.card}>Hi Ada,</div>
          <p className="mt-2 font-mono text-2xs text-muted">{'"firstName": "Ada"'}</p>
        </Panel>
      </div>
      <figcaption className="mt-4 max-w-xl text-sm text-pretty text-muted">
        The pill is a name. It leaves the editor as a placeholder and becomes a
        value only when your data supplies one.
      </figcaption>
    </figure>
  );
}
