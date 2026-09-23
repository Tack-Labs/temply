/**
 * The editing loop, as a ten-second film: a line is typed, the slash menu opens
 * and walks down to Button, the button lands on the canvas, and a bubble menu
 * restyles it. It is the paragraph above it, shown rather than described.
 *
 * Built the way the hero showreel is built: one master timeline, every element
 * on the same 10s duration and infinite iteration count, so the beats stay in
 * step by construction — no clock, no state, and the server render is already
 * the first frame. Only `opacity` and `transform` move, which keeps the whole
 * figure on the compositor.
 *
 *    0.0  empty canvas, caret blinking at the start of the line
 *    0.4  the line types itself (a mask uncovers it in character steps)
 *    3.0  the slash menu opens under the line
 *    3.4  the highlight walks Text → Image → Button
 *    5.4  the menu closes and the button block pops in below the text
 *    6.5  a bubble menu appears above the button
 *    7.2  its second swatch is pressed; the button takes the new colour
 *    8.4  the bubble leaves and the finished canvas holds
 *    9.6  the content dissolves, and the loop starts over
 *
 * Canvas contents use literal hex, like the hero showreel and the showcase
 * visuals: a mail client paints the canvas white in both themes, so what sits
 * on it cannot follow ours.
 */

/* An inline <style> rather than globals.css on purpose: these keyframes belong
   to this one figure, and their `docs-editor-` prefix makes them collision-proof. */
const ANIMATION_CSS = `
.docs-editor-stage {
  --pad: 22px;
  --h-text: 26px;
  --h-gap: 26px;
  --h-btnrow: 44px;
  /* The menu is three of these tall, and has to finish inside the canvas. */
  --row-menu: 24px;
  position: relative;
  padding: 20px 16px 26px;
  min-height: 210px;
}

.docs-editor-canvas {
  position: relative;
  max-width: 320px;
  margin-inline: auto;
  border-radius: 10px;
  background-color: #ffffff;
  box-shadow: var(--ds-shadow-canvas);
  padding: var(--pad) var(--pad) 24px;
  color: #12141a;
  font-size: 13px;
  line-height: 1.45;
}

.docs-editor-row-text { height: var(--h-text); }
.docs-editor-row-gap { height: var(--h-gap); }
.docs-editor-row-btn { height: var(--h-btnrow); display: flex; align-items: center; }

/* The typed line. The text is always there; a mask the colour of the canvas
   sits on top of it and shrinks away to the right in character-sized steps,
   which is what typing looks like without animating a width. */
.docs-editor-type {
  position: relative;
  display: inline-block;
  white-space: nowrap;
}

.docs-editor-mask {
  position: absolute;
  top: -3px;
  bottom: -3px;
  left: 0;
  right: 0;
  background-color: #ffffff;
  transform-origin: 100% 50%;
  transform: scaleX(1);
}

/* The caret rides a full-width track pinned to the mask's left edge: the track
   translates from -100% to 0 on the same step timing, so the bar at its right
   edge always sits exactly where the mask stops. */
.docs-editor-caret-track { position: absolute; inset: 0; opacity: 1; }

.docs-editor-caret {
  position: absolute;
  right: 0;
  top: -1px;
  bottom: -1px;
  width: 1.5px;
  background-color: #4f46e5;
}

.docs-editor-menu {
  position: absolute;
  left: 20px;
  top: calc(var(--pad) + var(--h-text) + 2px);
  width: 168px;
  padding: 6px;
  border-radius: 8px;
  background-color: #ffffff;
  box-shadow: 0 8px 22px rgb(18 20 26 / 0.14), 0 0 0 1px #e8eaee;
  opacity: 0;
  z-index: 2;
}

.docs-editor-menu-rows { position: relative; }

.docs-editor-menu-hl {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: var(--row-menu);
  border-radius: 6px;
  background-color: #eef0fe;
  opacity: 0;
}

.docs-editor-menu-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--row-menu);
  padding: 0 8px;
  font-size: 11.5px;
  color: #4a5160;
}

.docs-editor-slash { font-family: var(--font-mono); color: #4f46e5; }

.docs-editor-btn-wrap {
  display: inline-flex;
  transform-origin: 0% 50%;
  opacity: 0;
}

.docs-editor-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 16px;
  border-radius: 7px;
  background-color: #4f46e5;
  font-size: 12px;
  font-weight: 500;
}

/* The restyle is a second fill cross-faded over the first, so the colour change
   is an opacity animation rather than a background-color one. */
.docs-editor-btn-alt {
  position: absolute;
  inset: 0;
  border-radius: 7px;
  background-color: #c2653d;
  opacity: 0;
}

.docs-editor-btn-label { position: relative; color: #ffffff; }

.docs-editor-bubble {
  position: absolute;
  left: 20px;
  top: calc(var(--pad) + var(--h-text) + 1px);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 9px;
  border-radius: 999px;
  background-color: #ffffff;
  box-shadow: 0 6px 16px rgb(18 20 26 / 0.14), 0 0 0 1px #e8eaee;
  opacity: 0;
  z-index: 3;
}

.docs-editor-dot { display: block; width: 11px; height: 11px; border-radius: 999px; }
.docs-editor-dot-indigo { background-color: #4f46e5; }
.docs-editor-dot-mid { background-color: #c2653d; }
.docs-editor-dot-teal { background-color: #0f766e; }
.docs-editor-dot-slot { position: relative; display: flex; }

.docs-editor-dot-ring {
  position: absolute;
  inset: -4px;
  border-radius: 999px;
  border: 1.5px solid #c2653d;
  opacity: 0;
}

/* ---- The master timeline. Everything below runs 10s, infinite, in step. ---- */

@keyframes docs-editor-content {
  0%, 1% { opacity: 0; }
  3%, 96% { opacity: 1; }
  99%, 100% { opacity: 0; }
}

@keyframes docs-editor-mask {
  0%, 3.5% { transform: scaleX(1); animation-timing-function: steps(26, end); }
  24%, 99% { transform: scaleX(0); }
  99.5%, 100% { transform: scaleX(1); }
}

@keyframes docs-editor-caret-track {
  0%, 3.5% { opacity: 1; transform: translateX(-100%); animation-timing-function: steps(26, end); }
  24%, 29% { opacity: 1; transform: translateX(0); }
  31%, 99% { opacity: 0; transform: translateX(0); }
  99.5%, 100% { opacity: 1; transform: translateX(-100%); }
}

/* 1s against a 10s master: exactly ten blinks per loop, so it cannot drift. */
@keyframes docs-editor-blink {
  0%, 45% { opacity: 1; }
  50%, 95% { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes docs-editor-menu {
  0%, 29.5% { opacity: 0; transform: translateY(4px) scale(0.97); }
  33%, 54% { opacity: 1; transform: translateY(0) scale(1); }
  57%, 99% { opacity: 0; transform: translateY(-3px) scale(0.98); }
  99.5%, 100% { opacity: 0; transform: translateY(4px) scale(0.97); }
}

/* Text → Image → Button, one row height at a time. */
@keyframes docs-editor-hl {
  0%, 33% { opacity: 0; transform: translateY(0); }
  36%, 41% { opacity: 1; transform: translateY(0); }
  44%, 48% { opacity: 1; transform: translateY(var(--row-menu)); }
  51%, 55% { opacity: 1; transform: translateY(calc(var(--row-menu) * 2)); }
  57%, 99% { opacity: 0; transform: translateY(calc(var(--row-menu) * 2)); }
  99.5%, 100% { opacity: 0; transform: translateY(0); }
}

@keyframes docs-editor-btn {
  0%, 55% { opacity: 0; transform: scale(0.9); animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }
  59% { opacity: 1; transform: scale(1.04); }
  62%, 99% { opacity: 1; transform: scale(1); }
  99.5%, 100% { opacity: 0; transform: scale(0.9); }
}

@keyframes docs-editor-bubble {
  0%, 64% { opacity: 0; transform: translateY(4px) scale(0.96); }
  67.5%, 84% { opacity: 1; transform: translateY(0) scale(1); }
  87%, 99% { opacity: 0; transform: translateY(-3px) scale(0.97); }
  99.5%, 100% { opacity: 0; transform: translateY(4px) scale(0.96); }
}

@keyframes docs-editor-dotpress {
  0%, 71.5% { transform: scale(1); }
  72.5% { transform: scale(0.75); animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }
  74.5% { transform: scale(1.15); }
  76.5%, 100% { transform: scale(1); }
}

@keyframes docs-editor-dotring {
  0%, 72.5% { opacity: 0; }
  75%, 84% { opacity: 1; }
  87%, 100% { opacity: 0; }
}

@keyframes docs-editor-fill {
  0%, 74% { opacity: 0; }
  78%, 99% { opacity: 1; }
  99.5%, 100% { opacity: 0; }
}

.docs-editor-content { animation: docs-editor-content 10s ease-in-out infinite; }
.docs-editor-mask { animation: docs-editor-mask 10s ease-in-out infinite; }
.docs-editor-caret-track { animation: docs-editor-caret-track 10s ease-in-out infinite; }
.docs-editor-caret { animation: docs-editor-blink 1s steps(1, end) infinite; }
.docs-editor-menu { animation: docs-editor-menu 10s ease-in-out infinite; }
.docs-editor-menu-hl { animation: docs-editor-hl 10s ease-in-out infinite; }
.docs-editor-btn-wrap { animation: docs-editor-btn 10s ease-in-out infinite; }
.docs-editor-bubble { animation: docs-editor-bubble 10s ease-in-out infinite; }
.docs-editor-dot-mid { animation: docs-editor-dotpress 10s ease-in-out infinite; }
.docs-editor-dot-ring { animation: docs-editor-dotring 10s ease-in-out infinite; }
.docs-editor-btn-alt { animation: docs-editor-fill 10s ease-in-out infinite; }

/* No performance: the finished canvas, held still — the line typed, the button
   on it, in the colour the restyle left it. The menus and the caret were only
   ever the story of how it got there, so they go. */
@media (prefers-reduced-motion: reduce) {
  .docs-editor-stage :is(.docs-editor-content, .docs-editor-mask,
    .docs-editor-caret-track, .docs-editor-caret, .docs-editor-menu,
    .docs-editor-menu-hl, .docs-editor-btn-wrap, .docs-editor-bubble,
    .docs-editor-dot-mid, .docs-editor-dot-ring, .docs-editor-btn-alt) {
    animation: none !important;
  }
  .docs-editor-stage :is(.docs-editor-content, .docs-editor-btn-wrap) {
    opacity: 1 !important;
    transform: none !important;
  }
  .docs-editor-stage :is(.docs-editor-mask, .docs-editor-caret-track,
    .docs-editor-menu, .docs-editor-bubble) {
    display: none !important;
  }
  .docs-editor-btn-alt { opacity: 1 !important; }
}
`;

export function DemoEditor() {
  return (
    <figure className="mt-8 max-w-xl">
      <style>{ANIMATION_CSS}</style>

      <div className="overflow-hidden rounded-lg border border-line bg-raised">
        {/* Decoration: the figcaption below says everything a reader who is not
            looking at it needs. */}
        <div className="docs-editor-stage bg-sunken" aria-hidden>
          <div className="docs-editor-canvas">
            <div className="docs-editor-content">
              <div className="docs-editor-row-text">
                <span className="docs-editor-type">
                  Your invoice for March is ready.
                  <span className="docs-editor-mask" />
                  <span className="docs-editor-caret-track">
                    <span className="docs-editor-caret" />
                  </span>
                </span>
              </div>

              <div className="docs-editor-row-gap" />

              <div className="docs-editor-row-btn">
                <span className="docs-editor-btn-wrap">
                  <span className="docs-editor-btn">
                    <span className="docs-editor-btn-alt" />
                    <span className="docs-editor-btn-label">View invoice</span>
                  </span>
                </span>
              </div>
            </div>

            <div className="docs-editor-menu">
              <div className="docs-editor-menu-rows">
                <span className="docs-editor-menu-hl" />
                <div className="docs-editor-menu-row">
                  <span className="docs-editor-slash">/</span>Text
                </div>
                <div className="docs-editor-menu-row">
                  <span className="docs-editor-slash">/</span>Image
                </div>
                <div className="docs-editor-menu-row">
                  <span className="docs-editor-slash">/</span>Button
                </div>
              </div>
            </div>

            <div className="docs-editor-bubble">
              <span className="docs-editor-dot docs-editor-dot-indigo" />
              <span className="docs-editor-dot-slot">
                <span className="docs-editor-dot-ring" />
                <span className="docs-editor-dot docs-editor-dot-mid" />
              </span>
              <span className="docs-editor-dot docs-editor-dot-teal" />
            </div>
          </div>
        </div>
      </div>

      <figcaption className="mt-3 text-sm text-muted">
        The editing loop, on repeat: a line is typed on the canvas,{' '}
        <span className="font-mono text-xs text-ink">/</span> opens the slash
        menu, Button inserts a button block, and the bubble menu that appears
        with it changes the button&apos;s colour.
      </figcaption>
    </figure>
  );
}
