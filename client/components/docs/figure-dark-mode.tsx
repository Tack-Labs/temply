import { MiniEmail, Panel } from './figure-canvas';

/**
 * The same email under the three kinds of client. The third column is drawn
 * with the filter the Forced dark preview applies — `invert(1)
 * hue-rotate(180deg)`, images counter-filtered — so the figure shows the
 * treatment the preview shows, not an artist's idea of it.
 */
const INVERT = 'invert(1) hue-rotate(180deg)';

export function FigureDarkMode() {
  return (
    <figure className="mt-8 max-w-2xl">
      <div className="grid gap-2.5 sm:grid-cols-3" aria-hidden>
        <Panel title="As designed">
          <MiniEmail />
        </Panel>
        <Panel title="Reads the declaration">
          <MiniEmail />
        </Panel>
        <Panel title="Recoloured">
          <div style={{ filter: INVERT }} className="[&_[data-image]]:[filter:invert(1)_hue-rotate(180deg)]">
            <MiniEmail />
          </div>
        </Panel>
      </div>
      <figcaption className="mt-4 max-w-xl text-sm text-pretty text-muted">
        Two of three show what you designed. The third is the inversion the
        Forced dark preview draws, with the logo kept the right way round.
      </figcaption>
    </figure>
  );
}
