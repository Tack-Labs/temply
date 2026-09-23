/**
 * One email, three looks — twelve seconds, four to a brand.
 *
 * Three copies of the same card sit stacked on top of each other and cross-fade
 * on one master timeline: same logo, same heading, same two lines, same button,
 * and nothing but the colours, the corner radius and the padding changing
 * between them. That is the point of the section it illustrates — a brand is a
 * look, it holds no content, and applying it copies those settings onto the
 * template rather than linking to them, which is why the card keeps whichever
 * look it was last given.
 *
 * The colours are read out of `shared/brand-presets.ts` rather than retyped, so
 * the figure cannot drift from the presets a reader will actually pick from.
 * They are literal values on the card because a mail client paints the canvas
 * the same way in both themes, so what sits on it cannot follow ours.
 *
 * Same construction as the hero showreel: one 12s timeline, infinite, `opacity`
 * only.
 */

import { BRAND_PRESETS } from '@temply/shared/brand-presets';

/** The mock card is about 45% of a real 600px email, so the preset paddings are
 *  scaled to match. The radius is not scaled — a 10px corner reads as a 10px
 *  corner at any size, which is how the reader recognises it. */
const SCALE = 0.45;

function px(value: string | undefined, fallback: number): number {
  const n = Number.parseFloat(value ?? '');
  return Math.round((Number.isFinite(n) ? n : fallback) * SCALE);
}

/** Every field on RendererThemeOptions is optional, hence the `??` — the presets
 *  themselves always set all of these. */
function look(id: string, name: string) {
  const theme = BRAND_PRESETS.find((preset) => preset.id === id)?.theme;
  return {
    id,
    name,
    page: theme?.body?.backgroundColor ?? '#f4f4f5',
    card: theme?.container?.backgroundColor ?? '#ffffff',
    text: theme?.colors?.text ?? '#18181b',
    button: theme?.button?.backgroundColor ?? '#18181b',
    buttonInk: theme?.button?.color ?? '#ffffff',
    link: theme?.link?.color ?? '#2563eb',
    radius: theme?.container?.borderRadius ?? '6px',
    cardPad: px(theme?.container?.paddingTop, 40),
    pagePad: px(theme?.body?.paddingTop, 50),
  };
}

const LOOKS = [look('classic', 'Classic'), look('warm', 'Warm'), look('slate', 'Slate')];

/* An inline <style> rather than globals.css on purpose: these keyframes belong
   to this one figure, and their `docs-brand-` prefix makes them collision-proof. */
const ANIMATION_CSS = `
.docs-brand-stage { position: relative; min-height: 248px; }

.docs-brand-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.docs-brand-card {
  width: 100%;
  max-width: 256px;
  box-shadow: var(--ds-shadow-canvas);
}

.docs-brand-logo { display: block; width: 20px; height: 20px; border-radius: 999px; }
.docs-brand-head { display: block; margin-top: 14px; height: 9px; width: 62%; border-radius: 3px; }

.docs-brand-line {
  display: block;
  margin-top: 9px;
  height: 6px;
  width: 100%;
  border-radius: 999px;
  opacity: 0.28;
}

.docs-brand-line-short { width: 74%; }

.docs-brand-btn {
  display: inline-flex;
  align-items: center;
  margin-top: 16px;
  height: 30px;
  padding: 0 15px;
  font-size: 11.5px;
  font-weight: 600;
}

.docs-brand-link {
  display: block;
  margin-top: 14px;
  font-size: 10.5px;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.docs-brand-name { position: absolute; inset: 0; text-align: center; }

/* ---- The master timeline. Everything below runs 12s, infinite, in step. ----
   Four seconds a brand, with a 0.6s cross-fade at each hand-over. The card and
   its name carry the same three keyframes, so the label can never name the
   look you are not looking at. */

@keyframes docs-brand-a {
  0%, 29% { opacity: 1; }
  34%, 95% { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes docs-brand-b {
  0%, 29% { opacity: 0; }
  34%, 62% { opacity: 1; }
  67%, 100% { opacity: 0; }
}

@keyframes docs-brand-c {
  0%, 62% { opacity: 0; }
  67%, 95% { opacity: 1; }
  100% { opacity: 0; }
}

.docs-brand-a { opacity: 1; animation: docs-brand-a 12s ease-in-out infinite; }
.docs-brand-b { opacity: 0; animation: docs-brand-b 12s ease-in-out infinite; }
.docs-brand-c { opacity: 0; animation: docs-brand-c 12s ease-in-out infinite; }

/* No performance: the first of the three looks, held still, with its name under
   it — which is what the base styles already describe. */
@media (prefers-reduced-motion: reduce) {
  .docs-brand-a, .docs-brand-b, .docs-brand-c { animation: none !important; }
}
`;

const LAYER_CLASS = ['docs-brand-a', 'docs-brand-b', 'docs-brand-c'];

export function DemoBrands() {
  return (
    <figure className="mt-8 max-w-xl">
      <style>{ANIMATION_CSS}</style>

      <div className="overflow-hidden rounded-lg border border-line bg-raised">
        {/* Decoration: the figcaption below carries the point for anyone not
            looking at it. */}
        <div className="docs-brand-stage" aria-hidden>
          {LOOKS.map((brand, i) => (
            <div
              key={brand.id}
              className={`docs-brand-layer ${LAYER_CLASS[i]}`}
              style={{ backgroundColor: brand.page, padding: `${brand.pagePad}px 16px` }}
            >
              <div
                className="docs-brand-card"
                style={{
                  backgroundColor: brand.card,
                  borderRadius: brand.radius,
                  padding: `${brand.cardPad}px`,
                }}
              >
                <span className="docs-brand-logo" style={{ backgroundColor: brand.button }} />
                <span className="docs-brand-head" style={{ backgroundColor: brand.text }} />
                <span className="docs-brand-line" style={{ backgroundColor: brand.text }} />
                <span
                  className="docs-brand-line docs-brand-line-short"
                  style={{ backgroundColor: brand.text }}
                />
                <span
                  className="docs-brand-btn"
                  style={{
                    backgroundColor: brand.button,
                    color: brand.buttonInk,
                    borderRadius: brand.radius,
                  }}
                >
                  View order
                </span>
                <span className="docs-brand-link" style={{ color: brand.link }}>
                  View in browser
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="relative h-9 border-t border-line" aria-hidden>
          {LOOKS.map((brand, i) => (
            <span
              key={brand.id}
              className={`docs-brand-name ${LAYER_CLASS[i]} py-2.5 font-mono text-xs text-muted`}
            >
              {brand.name}
            </span>
          ))}
        </div>
      </div>

      <figcaption className="mt-3 text-sm text-muted">
        One email under three of the presets — Classic, Warm, and Slate. The
        content never changes; the page and card colours, the button and link
        colour, the corner radius and the padding do. Applying a brand copies
        those settings onto the template, so the email keeps the look it was
        last given.
      </figcaption>
    </figure>
  );
}
