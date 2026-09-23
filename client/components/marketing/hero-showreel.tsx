'use client';

/**
 * The hero, as a fourteen-and-a-half-second film. The previous hero handed you
 * the controls; nobody used them, and an editor you have to be taught is a bad
 * first impression. So this one performs instead: a fake cursor builds a small
 * email — add a paragraph, link a word inside it, add an image, add a button,
 * drag the button above the image, restyle the accent — then a mail client
 * forces dark mode on the result, and the loop dissolves and starts over.
 *
 * The scenes, in seconds:
 *
 *    0.0  logo and heading; the cursor arrives
 *    1.7  /Text     → the paragraph slides in
 *    3.0  the cursor clicks a word; a Link chip flashes and the word takes
 *         the accent and an underline (and follows every restyle after)
 *    4.3  /Image    → a placeholder pops in and loads into a photo
 *    6.2  /Button   → the call to action pops in
 *    7.4  the cursor grabs the button and drags it above the image
 *   10.0  a swatch pill appears; one click takes the brand to terracotta
 *   12.7  the cursor leaves and the email holds
 *   13.0  the canvas flips to a forced-dark rendering — the client's doing,
 *         not the cursor's — captioned "dark mode preview"
 *   14.0  the dissolve folds the restore-to-light into the loop seam
 *
 * It is one 14.5s master timeline. Every animated element runs the same duration
 * and infinite iteration count, so the scenes stay in step by construction:
 * there is no clock to drift, no state to resync, and the server render is
 * already the first frame. Only `transform` and `opacity` move (plus two
 * `background-color` cross-fades on the logo mark and the button), which keeps
 * the whole thing on the compositor.
 *
 * The layout is the finished email from the first frame — every block sits in
 * its final box and the timeline hides it until its cue. That is what makes the
 * loop seamless and the drag exact: the swap distance is a row height, known at
 * author time, not something measured at runtime. For the same reason the base
 * styles below describe the *finished* frame (image loaded, blocks in place);
 * the timeline is the only thing that ever hides anything.
 *
 * Canvas contents use literal hex, like the rest of the marketing visuals: a
 * mail client paints the canvas white in both themes, so what sits on it cannot
 * follow ours.
 */

const ANIMATION_CSS = `
.reel-stage {
  position: relative;
  container-type: inline-size;
  width: 100%;
  max-width: 560px;
  margin-inline: auto;

  /* Row heights are the choreography. The drag distance is one row height, so
     these have to be exact — hence fixed boxes rather than content-sized ones,
     and a second set for the width where the paragraph wraps to three lines. */
  --pad-x: 24px;
  --pad-t: 28px;
  --h-logo: 52px;
  --h-head: 48px;
  --h-para: 88px;   /* three lines; the 440px breakpoint below takes it to two */
  --h-img: 96px;
  --h-btn: 60px;
  --top-para: calc(var(--pad-t) + var(--h-logo) + var(--h-head));
  --top-img: calc(var(--top-para) + var(--h-para));
  --top-btn: calc(var(--top-img) + var(--h-img));

  --canvas-ink: #12141a;
  --canvas-body: #4a5160;
  --canvas-line: #e8eaee;
  --indigo: #4f46e5;
  --terracotta: #c2653d;
  --teal: #0f766e;

  /* Where the cursor stops. X in cqw so the path survives a narrow canvas,
     Y in row arithmetic so it lands on the right block at any width. The three
     insert points sit in the left gutter, where an editor puts its add
     affordance and where the cursor cannot cover the copy it just wrote. */
  --p0x: 58cqw;                       --p0y: calc(var(--top-btn) + var(--h-btn) + 8px);
  --p1x: calc(var(--pad-x) - 12px);   --p1y: calc(var(--top-para) + 16px);
  /* The link word sits a fixed prefix-width into the first paragraph line, so
     its point is px arithmetic, not cqw — the text does not scale with the
     stage. Tip lands inside "workspace", a touch left of its centre. */
  --pLx: calc(var(--pad-x) + 112px);  --pLy: calc(var(--top-para) + 25px);
  --p2x: calc(var(--pad-x) - 12px);   --p2y: calc(var(--top-img) + 16px);
  --p3x: calc(var(--pad-x) - 12px);   --p3y: calc(var(--top-btn) + 16px);
  --p4x: calc(var(--pad-x) + 46px);   --p4y: calc(var(--top-btn) + 32px);
  --p5x: calc(var(--pad-x) + 46px);   --p5y: calc(var(--top-img) + 32px);
  --p6x: calc(100cqw - 46px);         --p6y: calc(var(--top-img) + 28px);
  --p7x: 72cqw;                       --p7y: calc(var(--top-btn) + var(--h-btn) + 6px);
}

/* The paragraph drops to a third line under about a 360px canvas, and the row
   has to be exactly as tall as its content or the drag lands off by a line. */
@media (min-width: 440px) {
  .reel-stage { --h-para: 72px; }
}

@media (min-width: 640px) {
  .reel-stage {
    --pad-x: 40px;
    --pad-t: 36px;
    --h-logo: 56px;
    --h-head: 54px;
    --h-para: 72px;
    --h-img: 108px;
    --h-btn: 64px;
  }
}

.reel-canvas {
  overflow: hidden;
  border-radius: 12px;
  background-color: #ffffff;
  box-shadow: var(--ds-shadow-canvas);
  padding: var(--pad-t) var(--pad-x);
  color: var(--canvas-ink);
}

.reel-row { display: flex; align-items: center; }
.reel-row-logo { height: var(--h-logo); }
.reel-row-head { height: var(--h-head); }
.reel-row-para { height: var(--h-para); overflow: hidden; }
.reel-row-img { height: var(--h-img); }
.reel-row-btn { height: var(--h-btn); }

.reel-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background-color: var(--indigo);
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  line-height: 1;
}

.reel-head {
  margin: 0;
  font-size: 24px;
  line-height: 1.15;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.reel-para {
  margin: 0;
  font-size: 14px;
  line-height: 22px;
  color: var(--canvas-body);
}

/* The word that becomes a hyperlink mid-scene. The base styles are the
   finished frame (linked, accent-coloured); the timeline holds it as plain
   body text until the cursor clicks it, then walks the colour through
   indigo → terracotta → the lighter terracotta the dark preview needs. */
.reel-linkword {
  color: var(--indigo);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: var(--indigo);
}

/* The image block. Grey plate and glyph underneath, a drawn photograph on top;
   the timeline cross-fades one into the other, which is what "loading" looks
   like. The photo is four divs — no asset to fetch, nothing to lay out. */
.reel-img-frame {
  position: relative;
  width: 100%;
  height: calc(var(--h-img) - 16px);
  border-radius: 8px;
  overflow: hidden;
  background-color: #eef0f3;
}

.reel-img-glyph {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #aeb5bf;
  opacity: 0;
}

.reel-img-photo {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #c7daf0 0%, #dde5ee 44%, #ead9c8 72%, #e4cdb6 100%);
}

.reel-img-sun {
  position: absolute;
  right: 15%;
  top: 14%;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background-color: #f2b45c;
  box-shadow: 0 0 22px rgb(242 180 92 / 0.65);
}

.reel-img-ridge {
  position: absolute;
  bottom: 0;
  border-radius: 50% 50% 0 0 / 100% 100% 0 0;
}
.reel-img-ridge-back { left: -12%; right: 30%; height: 62%; background-color: #93a6b8; }
.reel-img-ridge-front { left: 12%; right: -14%; height: 46%; background-color: #3f4e5d; }

.reel-btn-wrap { position: relative; display: inline-flex; }

.reel-btn-shadow {
  position: absolute;
  inset: 0;
  border-radius: 8px;
  box-shadow: 0 14px 26px rgb(18 20 26 / 0.22), 0 3px 8px rgb(18 20 26 / 0.12);
  opacity: 0;
}

.reel-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 40px;
  padding: 0 22px;
  border-radius: 8px;
  background-color: var(--indigo);
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
}

/* The slash-menu ghost: one flash of the affordance, then the block it made.
   One per insert, each parked at its own row. */
.reel-chip {
  position: absolute;
  left: calc(var(--pad-x) - 4px);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 9px;
  border-radius: 6px;
  background-color: #ffffff;
  box-shadow: 0 4px 12px rgb(18 20 26 / 0.1), 0 0 0 1px var(--canvas-line);
  font-size: 11px;
  color: var(--canvas-body);
  white-space: nowrap;
  opacity: 0;
}

.reel-chip-text { top: calc(var(--top-para) + 20px); }
.reel-chip-img { top: calc(var(--top-img) + 20px); }
.reel-chip-btn { top: calc(var(--top-btn) + 20px); }
/* The link chip floats directly above the word it is about to mark. */
.reel-chip-link { left: calc(var(--pad-x) + 64px); top: calc(var(--top-para) - 10px); }

.reel-slash { font-family: var(--font-mono); color: var(--indigo); }

/* The accent picker only exists for the two seconds the cursor needs it. */
.reel-swatches {
  position: absolute;
  right: 12px;
  top: calc(var(--top-img) + 14px);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 999px;
  background-color: #ffffff;
  box-shadow: 0 8px 20px rgb(18 20 26 / 0.14), 0 0 0 1px rgb(18 20 26 / 0.06);
  opacity: 0;
}

.reel-dot { display: block; width: 12px; height: 12px; border-radius: 999px; }
.reel-dot-indigo { background-color: var(--indigo); }
.reel-dot-mid { background-color: var(--terracotta); }
.reel-dot-teal { background-color: var(--teal); }
.reel-dot-slot { position: relative; display: flex; }

.reel-dot-ring {
  position: absolute;
  inset: -4px;
  border-radius: 999px;
  border: 1.5px solid var(--terracotta);
  opacity: 0;
}

/* Names the forced-dark beat while it plays. Sits on the canvas's top-right,
   coloured for the dark frame it only ever appears on. */
.reel-darklabel {
  position: absolute;
  top: 12px;
  right: 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8f95a3;
  opacity: 0;
}

.reel-darklabel-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  border: 1.5px solid #8f95a3;
  border-top-color: transparent;
  transform: rotate(45deg);
}

.reel-cursor {
  position: absolute;
  top: 0;
  left: 0;
  width: 18px;
  height: 20px;
  opacity: 0;
  will-change: transform;
}

/* The press scales about the pointer tip, so a click reads as a click and not
   as the whole arrow shrinking. */
.reel-cursor-inner { display: block; transform-origin: 2px 2px; }

.reel-ripple {
  position: absolute;
  left: -13px;
  top: -13px;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  border: 1.5px solid rgb(18 20 26 / 0.32);
  opacity: 0;
}

/* --- The master timeline. Everything below runs 11s, infinite, in step. --- */

@keyframes reel-content {
  0%, 0.9% { opacity: 0; }
  3.6%, 96.8% { opacity: 1; }
  99.2%, 100% { opacity: 0; }
}

@keyframes reel-cursor {
  0% { opacity: 0; transform: translate3d(var(--p0x), var(--p0y), 0); }
  3.2% { opacity: 1; transform: translate3d(var(--p0x), var(--p0y), 0); }
  8.2% { transform: translate3d(var(--p0x), var(--p0y), 0); }
  11.4% { transform: translate3d(var(--p1x), var(--p1y), 0); }
  16.3% { transform: translate3d(var(--p1x), var(--p1y), 0); }
  19.7% { transform: translate3d(var(--pLx), var(--pLy), 0); }
  26.7% { transform: translate3d(var(--pLx), var(--pLy), 0); }
  29.5% { transform: translate3d(var(--p2x), var(--p2y), 0); }
  40.5% { transform: translate3d(var(--p2x), var(--p2y), 0); }
  43.3% { transform: translate3d(var(--p3x), var(--p3y), 0); }
  50.2% { transform: translate3d(var(--p3x), var(--p3y), 0); }
  52.8% { transform: translate3d(var(--p4x), var(--p4y), 0); }
  56.4% { transform: translate3d(var(--p4x), var(--p4y), 0); animation-timing-function: cubic-bezier(0.5, 0, 0.2, 1); }
  64.1% { transform: translate3d(var(--p5x), var(--p5y), 0); }
  69.1% { opacity: 1; transform: translate3d(var(--p5x), var(--p5y), 0); }
  73.9% { transform: translate3d(var(--p6x), var(--p6y), 0); }
  87.8% { opacity: 1; transform: translate3d(var(--p6x), var(--p6y), 0); }
  91.9% { opacity: 0; transform: translate3d(var(--p7x), var(--p7y), 0); }
  99.2% { opacity: 0; transform: translate3d(var(--p7x), var(--p7y), 0); }
  99.6%, 100% { opacity: 0; transform: translate3d(var(--p0x), var(--p0y), 0); }
}

@keyframes reel-press {
  0%, 12.2% { transform: scale(1); }
  12.6% { transform: scale(0.8); }
  13.9%, 20.4% { transform: scale(1); }
  20.9% { transform: scale(0.8); }
  22.3%, 30.2% { transform: scale(1); }
  30.7% { transform: scale(0.8); }
  31.9%, 44.1% { transform: scale(1); }
  44.6% { transform: scale(0.8); }
  45.8%, 54.3% { transform: scale(1); }
  54.7% { transform: scale(0.86); }
  65.4% { transform: scale(0.86); }
  66.5%, 75.9% { transform: scale(1); }
  76.3% { transform: scale(0.8); }
  77.6%, 100% { transform: scale(1); }
}

@keyframes reel-ripple {
  0%, 12.5% { opacity: 0; transform: scale(0.35); }
  12.9% { opacity: 0.5; transform: scale(0.5); }
  16.1% { opacity: 0; transform: scale(1.9); }
  16.2%, 20.6% { opacity: 0; transform: scale(0.35); }
  21.1% { opacity: 0.5; transform: scale(0.5); }
  24.7% { opacity: 0; transform: scale(1.9); }
  24.8%, 30.5% { opacity: 0; transform: scale(0.35); }
  31% { opacity: 0.5; transform: scale(0.5); }
  34.2% { opacity: 0; transform: scale(1.9); }
  34.3%, 44.4% { opacity: 0; transform: scale(0.35); }
  44.9% { opacity: 0.5; transform: scale(0.5); }
  48.1% { opacity: 0; transform: scale(1.9); }
  48.2%, 76.2% { opacity: 0; transform: scale(0.35); }
  76.6% { opacity: 0.5; transform: scale(0.5); }
  79.8% { opacity: 0; transform: scale(1.9); }
  79.9%, 100% { opacity: 0; transform: scale(0.35); }
}

@keyframes reel-chip-text {
  0%, 11.0% { opacity: 0; transform: translateY(4px) scale(0.96); }
  12.2%, 13.9% { opacity: 1; transform: translateY(0) scale(1); }
  14.7%, 99.2% { opacity: 0; transform: translateY(-3px) scale(0.98); }
  99.6%, 100% { opacity: 0; transform: translateY(4px) scale(0.96); }
}

@keyframes reel-chip-link {
  0%, 20% { opacity: 0; transform: translateY(4px) scale(0.96); }
  21.3%, 23.4% { opacity: 1; transform: translateY(0) scale(1); }
  24.3%, 99.2% { opacity: 0; transform: translateY(-3px) scale(0.98); }
  99.6%, 100% { opacity: 0; transform: translateY(4px) scale(0.96); }
}

@keyframes reel-chip-img {
  0%, 29.2% { opacity: 0; transform: translateY(4px) scale(0.96); }
  30.3%, 31.9% { opacity: 1; transform: translateY(0) scale(1); }
  32.8%, 99.2% { opacity: 0; transform: translateY(-3px) scale(0.98); }
  99.6%, 100% { opacity: 0; transform: translateY(4px) scale(0.96); }
}

@keyframes reel-chip-btn {
  0%, 43.0% { opacity: 0; transform: translateY(4px) scale(0.96); }
  44.1%, 45.8% { opacity: 1; transform: translateY(0) scale(1); }
  46.7%, 99.2% { opacity: 0; transform: translateY(-3px) scale(0.98); }
  99.6%, 100% { opacity: 0; transform: translateY(4px) scale(0.96); }
}

@keyframes reel-para {
  0%, 13.0% { opacity: 0; transform: translateY(10px); }
  15.5%, 99.2% { opacity: 1; transform: translateY(0); }
  99.6%, 100% { opacity: 0; transform: translateY(10px); }
}

/* Plain body text until the click at ~3.0s, a link from then on, and the link
   colour follows the brand: indigo, then terracotta after the restyle, then a
   step lighter so it still reads on the forced-dark canvas. */
@keyframes reel-linkword {
  0%, 21% { color: var(--canvas-body); text-decoration-color: transparent; }
  23%, 76.3% { color: var(--indigo); text-decoration-color: var(--indigo); }
  81.2%, 89.2% { color: var(--terracotta); text-decoration-color: var(--terracotta); }
  91%, 96.8% { color: #d98a63; text-decoration-color: #d98a63; }
  99.2%, 100% { color: var(--canvas-body); text-decoration-color: transparent; }
}

/* The image is the block the button is dragged past, so it carries the other
   half of the swap: down by exactly one button row. */
@keyframes reel-imgrow {
  0%, 31.1% { opacity: 0; transform: translateY(10px); }
  34.0%, 58.4% { opacity: 1; transform: translateY(0); }
  65.4%, 99.2% { opacity: 1; transform: translateY(var(--h-btn)); }
  99.6%, 100% { opacity: 0; transform: translateY(10px); }
}

@keyframes reel-imgpop {
  0%, 31.1% { transform: scale(0.94); animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }
  34.0% { transform: scale(1.02); }
  35.6%, 99.2% { transform: scale(1); }
  99.6%, 100% { transform: scale(0.94); }
}

@keyframes reel-imgload {
  0%, 34.8% { opacity: 1; }
  39.7%, 99.2% { opacity: 0; }
  99.6%, 100% { opacity: 1; }
}

@keyframes reel-imgphoto {
  0%, 34.8% { opacity: 0; transform: scale(1.04); }
  39.7%, 99.2% { opacity: 1; transform: scale(1); }
  99.6%, 100% { opacity: 0; transform: scale(1.04); }
}

@keyframes reel-btnrow {
  0%, 44.9% { opacity: 0; transform: translateY(0); }
  47.8%, 56.8% { opacity: 1; transform: translateY(0); }
  64.6%, 99.2% { opacity: 1; transform: translateY(calc(-1 * var(--h-img))); }
  99.6%, 100% { opacity: 0; transform: translateY(0); }
}

@keyframes reel-btnwrap {
  0%, 44.9% { transform: translateY(0) scale(0.92) rotate(0deg); animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }
  47.8% { transform: translateY(0) scale(1.05) rotate(0deg); }
  50.2%, 54.4% { transform: translateY(0) scale(1) rotate(0deg); }
  56.4%, 64.9% { transform: translateY(-5px) scale(1.04) rotate(-1.3deg); }
  67.8%, 99.2% { transform: translateY(0) scale(1) rotate(0deg); }
  99.6%, 100% { transform: translateY(0) scale(0.92) rotate(0deg); }
}

@keyframes reel-btnshadow {
  0%, 54.4% { opacity: 0; }
  56.4%, 64.9% { opacity: 1; }
  67.4%, 100% { opacity: 0; }
}

@keyframes reel-accent {
  0%, 76.3% { background-color: #4f46e5; }
  81.2%, 99.2% { background-color: #c2653d; }
  99.6%, 100% { background-color: #4f46e5; }
}

@keyframes reel-swatches {
  0%, 71.5% { opacity: 0; transform: translateY(4px) scale(0.96); }
  74.7%, 86.1% { opacity: 1; transform: translateY(0) scale(1); }
  88.6%, 99.2% { opacity: 0; transform: translateY(-3px) scale(0.97); }
  99.6%, 100% { opacity: 0; transform: translateY(4px) scale(0.96); }
}

@keyframes reel-dotpress {
  0%, 76.2% { transform: scale(1); }
  76.8% { transform: scale(0.78); animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }
  78.8% { transform: scale(1.12); }
  80.5%, 100% { transform: scale(1); }
}

@keyframes reel-dotring {
  0%, 77.1% { opacity: 0; }
  79.7%, 99.2% { opacity: 1; }
  99.6%, 100% { opacity: 0; }
}

/* The last beat: a mail client forces dark mode on the finished email. Nobody
   clicks anything — it happens TO the email, which is the point. The canvas
   and text cross-fade to a dark rendering (the terracotta accent rides along
   unchanged, as a real client would leave it), a small caption names what is
   happening, and the restore back to white is folded into the loop's dissolve
   so the seam stays invisible. */
@keyframes reel-darkcanvas {
  0%, 89.2% { background-color: #ffffff; color: var(--canvas-ink); }
  91%, 96.8% { background-color: #171a21; color: #f2f3f5; }
  99.2%, 100% { background-color: #ffffff; color: var(--canvas-ink); }
}

@keyframes reel-darkpara {
  0%, 89.2% { color: var(--canvas-body); }
  91%, 96.8% { color: #a2a8b4; }
  99.2%, 100% { color: var(--canvas-body); }
}

@keyframes reel-darklabel {
  0%, 89.7% { opacity: 0; transform: translateY(3px); }
  91%, 95.8% { opacity: 1; transform: translateY(0); }
  96.8%, 100% { opacity: 0; transform: translateY(3px); }
}

.reel-content { animation: reel-content 14.5s linear infinite; }
.reel-cursor { animation: reel-cursor 14.5s cubic-bezier(0.45, 0, 0.25, 1) infinite; }
.reel-cursor-inner { animation: reel-press 14.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
.reel-ripple { animation: reel-ripple 14.5s cubic-bezier(0.2, 0.6, 0.3, 1) infinite; }
.reel-chip-text { animation: reel-chip-text 14.5s cubic-bezier(0.3, 0, 0.2, 1) infinite; }
.reel-chip-link { animation: reel-chip-link 14.5s cubic-bezier(0.3, 0, 0.2, 1) infinite; }
.reel-linkword { animation: reel-linkword 14.5s ease-in-out infinite; }
.reel-chip-img { animation: reel-chip-img 14.5s cubic-bezier(0.3, 0, 0.2, 1) infinite; }
.reel-chip-btn { animation: reel-chip-btn 14.5s cubic-bezier(0.3, 0, 0.2, 1) infinite; }
.reel-row-para { animation: reel-para 14.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
.reel-row-img { animation: reel-imgrow 14.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; will-change: transform; }
.reel-img-frame { animation: reel-imgpop 14.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
.reel-img-glyph { animation: reel-imgload 14.5s ease-in-out infinite; }
.reel-img-photo { animation: reel-imgphoto 14.5s ease-in-out infinite; }
.reel-row-btn { animation: reel-btnrow 14.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; will-change: transform; }
.reel-btn-wrap { animation: reel-btnwrap 14.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; will-change: transform; }
.reel-btn-shadow { animation: reel-btnshadow 14.5s ease-out infinite; }
.reel-mark, .reel-btn { animation: reel-accent 14.5s ease-in-out infinite; }
.reel-swatches { animation: reel-swatches 14.5s cubic-bezier(0.3, 0, 0.2, 1) infinite; }
.reel-dot-mid { animation: reel-dotpress 14.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
.reel-dot-ring { animation: reel-dotring 14.5s ease-out infinite; }
.reel-canvas { animation: reel-darkcanvas 14.5s ease-in-out infinite; }
.reel-para { animation: reel-darkpara 14.5s ease-in-out infinite; }
.reel-darklabel { animation: reel-darklabel 14.5s ease-in-out infinite; }

/* No performance, no cursor: one finished email — image loaded, blocks in the
   order they were written, brand accent — held still. The base styles already
   describe that frame, so switching the animations off is most of the work. */
@media (prefers-reduced-motion: reduce) {
  .reel-stage :is(.reel-content, .reel-cursor, .reel-cursor-inner, .reel-ripple,
    .reel-chip, .reel-row-para, .reel-row-img, .reel-img-frame, .reel-img-glyph,
    .reel-img-photo, .reel-row-btn, .reel-btn-wrap, .reel-btn-shadow, .reel-mark,
    .reel-btn, .reel-swatches, .reel-dot-mid, .reel-dot-ring, .reel-canvas,
    .reel-para, .reel-darklabel, .reel-linkword) {
    animation: none !important;
  }
  .reel-stage :is(.reel-content, .reel-row-para, .reel-row-img, .reel-img-photo,
    .reel-row-btn) {
    opacity: 1 !important;
    transform: none !important;
  }
  .reel-stage :is(.reel-cursor, .reel-chip, .reel-swatches, .reel-darklabel) {
    display: none !important;
  }
}
`;

export function HeroShowreel() {
  return (
    <div>
      <style>{ANIMATION_CSS}</style>

      {/* One picture as far as a screen reader is concerned: the blocks below
          are a depiction of an email being built, not content to read. */}
      <div
        className="reel-stage"
        role="img"
        aria-label="Building an email in Temply: a text block, an image and a button are added, the button is dragged above the image, the accent colour is switched to terracotta, and the finished email is previewed as a dark-mode mail client would render it."
      >
        <div className="reel-canvas">
          <div className="reel-content">
            <div className="reel-row reel-row-logo">
              <span className="reel-mark">A</span>
            </div>

            <div className="reel-row reel-row-head">
              <h3 className="reel-head">Welcome to Temply</h3>
            </div>

            <div className="reel-row reel-row-para">
              <p className="reel-para">
                Hi Sam — your <span className="reel-linkword">workspace</span> is
                ready. Everything you build here goes out looking exactly like
                this.
              </p>
            </div>

            <div className="reel-row reel-row-img">
              <span className="reel-img-frame">
                <span className="reel-img-glyph">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect
                      x="3"
                      y="5"
                      width="18"
                      height="14"
                      rx="2.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <circle cx="8.5" cy="10" r="1.6" fill="currentColor" />
                    <path
                      d="M4 17l4.5-4.5 3.5 3.5 3-2.5L20 17"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>

                {/* The "loaded" photograph: a sky, a sun and two ridges. */}
                <span className="reel-img-photo">
                  <span className="reel-img-sun" />
                  <span className="reel-img-ridge reel-img-ridge-back" />
                  <span className="reel-img-ridge reel-img-ridge-front" />
                </span>
              </span>
            </div>

            <div className="reel-row reel-row-btn">
              <span className="reel-btn-wrap">
                {/* The lift shadow is its own element so the drag animates
                    opacity instead of box-shadow. */}
                <span className="reel-btn-shadow" />
                <span className="reel-btn">Get started</span>
              </span>
            </div>
          </div>
        </div>

        <span className="reel-chip reel-chip-text">
          <span className="reel-slash">/</span>
          Text
        </span>
        <span className="reel-chip reel-chip-link">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Link
        </span>
        <span className="reel-chip reel-chip-img">
          <span className="reel-slash">/</span>
          Image
        </span>
        <span className="reel-chip reel-chip-btn">
          <span className="reel-slash">/</span>
          Button
        </span>

        <span className="reel-swatches">
          <span className="reel-dot reel-dot-indigo" />
          <span className="reel-dot-slot">
            <span className="reel-dot-ring" />
            <span className="reel-dot reel-dot-mid" />
          </span>
          <span className="reel-dot reel-dot-teal" />
        </span>

        <span className="reel-darklabel">
          <span className="reel-darklabel-dot" />
          dark mode preview
        </span>

        <span className="reel-cursor">
          <span className="reel-ripple" />
          <svg
            className="reel-cursor-inner"
            width="18"
            height="20"
            viewBox="0 0 12 14"
            fill="none"
            aria-hidden
          >
            <path
              d="M1 1 L1 11.4 L3.7 8.9 L5.6 12.8 L7.6 11.9 L5.7 8.1 L9.4 8.1 Z"
              fill="#12141a"
              stroke="#ffffff"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
          </svg>
        </span>

      </div>
    </div>
  );
}
