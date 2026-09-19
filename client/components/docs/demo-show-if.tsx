/**
 * Show if, as an eight-second film: one key flips, one block comes and goes,
 * and everything around it stays exactly where it was.
 *
 * Same construction as the hero showreel — one master timeline, every element
 * on the same 8s duration and infinite iteration count, only `opacity` and
 * `transform` moving. The collapse is `scaleY(0)` from the block's top edge
 * rather than a height change, so the footer line below it never moves: the
 * figure is about a block disappearing, not about the page resettling.
 *
 *    0.0  isMember is ticked; the members-only block is on the canvas
 *    2.4  the tick goes; the block folds up from its top edge and fades
 *    3.2  the canvas holds without it
 *    5.2  the tick returns and the block unfolds
 *    6.0  the canvas holds with it, and the loop starts over
 *
 * Canvas contents use literal hex, like the hero showreel and the showcase
 * visuals: a mail client paints the canvas white in both themes, so what sits
 * on it cannot follow ours.
 */

/* An inline <style> rather than globals.css on purpose: these keyframes belong
   to this one figure, and their `docs-showif-` prefix makes them collision-proof. */
const ANIMATION_CSS = `
.docs-showif-stage {
  position: relative;
  padding: 20px 16px 24px;
  min-height: 190px;
}

.docs-showif-canvas {
  position: relative;
  max-width: 320px;
  margin-inline: auto;
  border-radius: 10px;
  background-color: #ffffff;
  box-shadow: var(--ds-shadow-canvas);
  padding: 20px;
  color: #12141a;
  font-size: 12.5px;
  line-height: 1.5;
}

.docs-showif-para { margin: 0; color: #4a5160; }

/* Fixed height, so the block folding away leaves its space behind instead of
   pulling the footer up. */
.docs-showif-slot { height: 56px; margin-top: 12px; }

.docs-showif-block {
  height: 100%;
  border-radius: 7px;
  background-color: #eef0fe;
  padding: 10px 12px;
  transform-origin: 50% 0%;
  transform: scaleY(1);
  opacity: 1;
}

.docs-showif-block-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #4338ca;
}

.docs-showif-block-line {
  display: block;
  margin-top: 8px;
  height: 6px;
  width: 72%;
  border-radius: 999px;
  background-color: #c3c8f0;
}

.docs-showif-footer {
  margin: 12px 0 0;
  font-size: 11px;
  color: #8a919e;
}

.docs-showif-box {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 4px;
}

.docs-showif-check { display: flex; opacity: 1; }

/* ----- The master timeline. Everything below runs 8s, infinite, in step. ----- */

@keyframes docs-showif-check {
  0%, 30% { opacity: 1; transform: scale(1); }
  34%, 64% { opacity: 0; transform: scale(0.8); }
  68%, 100% { opacity: 1; transform: scale(1); }
}

@keyframes docs-showif-block {
  0%, 33% { opacity: 1; transform: scaleY(1); }
  40%, 66% { opacity: 0; transform: scaleY(0); }
  73%, 100% { opacity: 1; transform: scaleY(1); }
}

.docs-showif-check { animation: docs-showif-check 8s ease-in-out infinite; }
.docs-showif-block { animation: docs-showif-block 8s ease-in-out infinite; }

/* No performance: the key is true and the block is there — the state the base
   styles already describe, which is why switching the animations off is all
   this takes. */
@media (prefers-reduced-motion: reduce) {
  .docs-showif-check, .docs-showif-block { animation: none !important; }
}
`;

export function DemoShowIf() {
  return (
    <figure className="mt-8 max-w-xl">
      <style>{ANIMATION_CSS}</style>

      <div className="overflow-hidden rounded-lg border border-line bg-raised">
        {/* The data the render is given, above the email it produces. */}
        <div
          className="flex items-center gap-2 border-b border-line px-4 py-2.5"
          aria-hidden
        >
          <span className="docs-showif-box border border-line bg-surface">
            <span className="docs-showif-check text-accent-ink">
              <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4.5 12.5l5 5 10-11"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>
          <span className="font-mono text-xs text-muted">isMember</span>
        </div>

        <div className="docs-showif-stage bg-sunken" aria-hidden>
          <div className="docs-showif-canvas">
            <p className="docs-showif-para">
              Thanks for reading — here is what shipped this month.
            </p>

            <div className="docs-showif-slot">
              <div className="docs-showif-block">
                <span className="docs-showif-block-label">Members only</span>
                <span className="docs-showif-block-line" />
              </div>
            </div>

            <p className="docs-showif-footer">You are receiving this from Temply.</p>
          </div>
        </div>
      </div>

      <figcaption className="mt-3 text-sm text-muted">
        The same template, rendered twice: with{' '}
        <span className="font-mono text-xs text-ink">isMember</span> true the
        members-only block is in the email, and without it the block is dropped
        and everything else stays put.
      </figcaption>
    </figure>
  );
}
