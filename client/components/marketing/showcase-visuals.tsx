/**
 * The four workflow visuals. Every one of them is CSS: no screenshots, no
 * image assets. Each sits on its card's wash as a small white panel, except
 * the last, which is set straight onto the wash.
 *
 * What is drawn as an email (the editor's page, the two renderings of the
 * preview) is painted from the `canvas-*` tokens and the forced-dark repaint
 * from `canvas-dark-*`: a mail client renders the canvas white in both themes,
 * so its contents cannot follow ours, and the card around it does. The only
 * literals left are the swatches of other companies' brands, which are theirs
 * to choose.
 */

import type { ReactNode } from 'react';
import { PUBLIC_API_URL } from '~/lib/site';

/** The white page of an email, lifted off the wash it sits on. A step less
 *  padding on a phone: the button it holds does not wrap, and at 320px the
 *  card leaves it 232px to sit in. */
function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-canvas p-4 text-canvas-ink shadow-md sm:p-5.5 ${className}`}>{children}</div>
  );
}

/* ------------------------------------------------------------------ 1. Build */

export function EditorMock() {
  return (
    <Page>
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-accent" />
          <div className="h-3 w-[46%] rounded-xs bg-canvas-ink" />
        </div>
        <div className="h-2.5 w-[92%] rounded-full bg-canvas-bar" />
        <div className="h-2.5 w-[70%] rounded-full bg-canvas-bar" />
        {/* The selected block hugs the button it holds, with its kind tagged on
            the outline the way the editor labels it. */}
        <div className="relative mt-2 flex justify-center rounded-2xl border-2 border-accent px-3 pt-4.5 pb-3">
          <span className="absolute -top-3 left-2.5 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-canvas-on-accent">
            Button
          </span>
          <span className="inline-flex h-10.5 items-center rounded-full bg-accent px-5 text-ui font-semibold whitespace-nowrap text-canvas-on-accent">
            Open the dashboard
          </span>
        </div>
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ 2. Check */

/** The paint of one pictured email, as classes so each stays a token. */
type Paint = { frame: string; heading: string; bar: string; button: string };

const AS_BUILT: Paint = {
  frame: 'bg-canvas',
  heading: 'text-canvas-ink',
  bar: 'bg-canvas-bar',
  button: 'bg-accent text-canvas-on-accent',
};

const FORCED_DARK: Paint = {
  frame: 'bg-canvas-dark',
  heading: 'text-canvas-dark-ink',
  bar: 'bg-canvas-dark-bar',
  button: 'bg-canvas-dark-accent text-canvas-dark',
};

/** One miniature email, painted twice: as the client renders it, and as a client
 *  that forces dark mode repaints it. The slow emphasis (`mk-alt`) is on the
 *  frame alone: the caption beneath is text on the card's wash and has no room
 *  to fade, so it sits outside the thing that dims. The button is the width of
 *  the email on a phone, where two columns leave it too narrow for its label. */
function MiniEmail({ caption, paint, late = false }: { caption: string; paint: Paint; late?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <div
        className={`mk-alt flex w-full flex-col gap-2 rounded-2xl p-3.5 shadow-md sm:p-4 ${late ? 'mk-alt-late ' : ''}${paint.frame}`}
      >
        <div className={`text-ui font-bold ${paint.heading}`}>Hi Sam</div>
        <div className={`h-2 w-[90%] rounded-full ${paint.bar}`} />
        <div className={`h-2 w-[64%] rounded-full ${paint.bar}`} />
        <div
          className={`mt-1 flex h-8.5 w-full items-center justify-center rounded-full text-xs font-semibold whitespace-nowrap sm:w-28 sm:text-sm ${paint.button}`}
        >
          Get started
        </div>
      </div>
      <span className="text-base font-semibold text-success-ink">{caption}</span>
    </div>
  );
}

export function PreviewMock() {
  return (
    <div className="grid grid-cols-2 gap-3.5">
      {/* The two renderings trade a slow, quiet emphasis: the eye is walked
          from one client to the other without anything demanding attention. */}
      <MiniEmail caption="As built" paint={AS_BUILT} />
      {/* The repaint a forced-dark client applies: inverted surface, lifted
          accent, and the same geometry, which is the point of the check. */}
      <MiniEmail caption="Forced dark" paint={FORCED_DARK} late />
    </div>
  );
}

/* ------------------------------------------------------------------- 3. Ship */

export function ApiMock() {
  return (
    // The rail tokens are theme-independent, so a terminal built from them
    // reads the same in light and dark, which is what a terminal does. Its
    // lowest text colour is rail-muted.
    <div className="overflow-hidden rounded-2xl bg-rail-bg px-5 py-4.5 font-mono text-sm leading-relaxed shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs">
        <span className="min-w-0 break-all text-rail-muted">GET /api/public/v1/templates/:id</span>
        <span className="shrink-0 rounded-full bg-rail-ok px-2.5 py-0.5 font-medium whitespace-nowrap text-rail-bg">
          200 OK
        </span>
      </div>

      {/* Wrapping anywhere beats a hidden horizontal scroll on a block that
          only exists to be read. */}
      <pre className="mt-3 whitespace-pre-wrap text-rail-muted [overflow-wrap:anywhere]">
        <span className="text-rail-muted">$ </span>
        <span className="text-rail-ink">curl </span>
        <span className="text-rail-accent">{PUBLIC_API_URL}/templates/tpl_welcome_01</span>
        {'\n\n'}
        {'{\n'}
        {'  '}
        <span className="text-rail-ink">&quot;id&quot;</span>
        {': '}
        <span className="text-rail-accent">&quot;tpl_welcome_01&quot;</span>
        {',\n  '}
        <span className="text-rail-ink">&quot;subject&quot;</span>
        {': '}
        <span className="text-rail-accent">&quot;Your API key is ready&quot;</span>
        {',\n  '}
        <span className="text-rail-ink">&quot;html&quot;</span>
        {': '}
        <span className="text-rail-accent">&quot;&lt;!doctype html&gt;…&quot;</span>
        {'\n}\n\n'}
        <span className="text-rail-muted">$ </span>
        {/* The prompt came back: a live terminal blinks. */}
        <span aria-hidden className="mk-caret" />
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ 4. Reuse */

const placeholders = [
  '{{first_name}}',
  '{{company}}',
  '{{action_url}}',
  '{{plan_name}}',
  '{{invoice_total}}',
  '{{support_email}}',
];

// Each brand is a ramp rather than a base plus a near-black: a near-black
// swatch vanishes into the surface in dark mode and the trio reads as a pair.
// Temply's ramp is the product's own tokens; the other two are literal because
// they are other companies' colours, which no token of ours speaks for.
const brands = [
  { name: 'Temply', swatches: ['var(--ds-accent)', 'var(--ds-canvas-accent-bar)', 'var(--ds-canvas-accent-wash)'] },
  { name: 'Northwind', swatches: ['#0f766e', '#7fd1c7', '#d6f2ee'] },
  { name: 'Beacon', swatches: ['#d97706', '#ffc57a', '#fff0d6'] },
];

export function VariablesMock() {
  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-xs font-bold tracking-wider text-sky-ink uppercase">Placeholders</p>
      <ul className="flex flex-wrap gap-2">
        {placeholders.map((placeholder) => (
          <li key={placeholder} className="rounded-full bg-raised px-3.5 py-1.5 font-mono text-sm text-ink">
            {placeholder}
          </li>
        ))}
      </ul>

      <p className="text-xs font-bold tracking-wider text-sky-ink uppercase">Saved brands</p>
      <ul className="flex flex-wrap gap-2">
        {brands.map((brand) => (
          <li
            key={brand.name}
            className="flex items-center gap-2.5 rounded-full bg-raised py-1.75 pr-4 pl-3 text-ui font-semibold text-ink"
          >
            <span aria-hidden className="flex">
              {brand.swatches.map((swatch, index) => (
                <span
                  key={swatch}
                  className={`size-3.5 rounded-full ring-2 ring-raised ${index > 0 ? '-ml-1.25' : ''}`}
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </span>
            {brand.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
