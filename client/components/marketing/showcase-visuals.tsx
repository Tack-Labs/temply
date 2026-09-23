/**
 * The four showcase visuals. Every one of them is CSS — no screenshots, no
 * image assets — and they all sit in the same frame the hero artifact uses:
 * a bench slab with a mono spec line across the top. The frame is the constant
 * so the thing inside it can be the variable.
 *
 * Anything drawn on the white email canvas uses literal hex, for the same
 * reason the hero showreel does: a mail client renders the canvas white in both
 * themes, so its contents cannot follow ours.
 */

import type { ReactNode } from 'react';
import { PUBLIC_API_URL, SITE_HOST } from '~/lib/site';
import { GripVerticalIcon } from 'lucide-react';

/* Canvas palette — theme-invariant, matching what a mail client actually paints. */
const CANVAS_INK = '#12141a';
const CANVAS_BAR = '#dcdfe5';
const CANVAS_LINE = '#e8eaee';
const CANVAS_ACCENT = '#4f46e5';

function Panel({ spec, meta, children }: { spec: string; meta?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-raised p-4 shadow-lg sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-4 px-1 font-mono text-2xs text-faint">
        <span className="tracking-wide uppercase">{spec}</span>
        {meta ? <span className="truncate">{meta}</span> : null}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ 1. Build */

/** A block with a drag handle in the canvas gutter, the way it reads in the editor. */
function Block({ children, selected = false }: { children: ReactNode; selected?: boolean }) {
  return (
    <div className="relative">
      <GripVerticalIcon
        aria-hidden
        className="absolute top-1/2 -left-5 size-3.5 -translate-y-1/2"
        style={{ color: selected ? CANVAS_ACCENT : '#c3c8d1' }}
      />
      <div
        // Selection hugs the block it is on, which for a button is the pill —
        // a full-bleed outline round a 144px pill reads as an empty box.
        className={selected ? 'w-fit rounded-xs' : 'rounded-xs'}
        style={
          selected
            ? { outline: `2px solid ${CANVAS_ACCENT}`, outlineOffset: '6px' }
            : undefined
        }
      >
        {children}
      </div>
      {selected && (
        <span
          className="absolute -top-2 left-0 -translate-y-full rounded-xs px-1.5 py-0.5 font-mono text-2xs text-white"
          style={{ backgroundColor: CANVAS_ACCENT }}
        >
          Button
        </span>
      )}
    </div>
  );
}

export function EditorMock() {
  return (
    <Panel spec="Editor canvas">
      <div className="rounded-lg bg-sunken p-3 sm:p-6">
        <div
          className="mx-auto w-full max-w-[420px] rounded-md bg-canvas px-7 py-7 shadow-canvas"
          style={{ color: CANVAS_INK }}
        >
          <div className="space-y-7">
            <Block>
              <div className="size-7 rounded-md" style={{ backgroundColor: CANVAS_INK }} />
            </Block>

            <Block>
              <div className="h-3.5 w-3/5 rounded-xs" style={{ backgroundColor: CANVAS_INK }} />
            </Block>

            <Block>
              <div className="space-y-2">
                <div className="h-2 w-full rounded-full" style={{ backgroundColor: CANVAS_BAR }} />
                <div className="h-2 w-[92%] rounded-full" style={{ backgroundColor: CANVAS_BAR }} />
                <div className="h-2 w-3/4 rounded-full" style={{ backgroundColor: CANVAS_BAR }} />
              </div>
            </Block>

            <div className="pt-1">
              <Block selected>
                <div
                  className="flex h-9 w-36 items-center justify-center rounded-md text-xs font-medium text-white"
                  style={{ backgroundColor: CANVAS_ACCENT }}
                >
                  Open the dashboard
                </div>
              </Block>
            </div>

            <Block>
              <div className="h-px w-full" style={{ backgroundColor: CANVAS_LINE }} />
            </Block>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ 2. Check */

/** One miniature email, painted twice: as the client renders it, and as a client
 *  that forces dark mode repaints it. */
function MiniEmail({
  caption,
  bg,
  ink,
  bar,
  line,
  accent,
}: {
  caption: string;
  bg: string;
  ink: string;
  bar: string;
  line: string;
  accent: string;
}) {
  return (
    <div>
      <div
        className="rounded-md border p-4 shadow-canvas"
        style={{ backgroundColor: bg, borderColor: line }}
      >
        <div className="size-5 rounded-sm" style={{ backgroundColor: ink }} />
        <div className="mt-4 h-2.5 w-4/5 rounded-xs" style={{ backgroundColor: ink }} />
        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: bar }} />
          <div className="h-1.5 w-[85%] rounded-full" style={{ backgroundColor: bar }} />
        </div>
        <div className="mt-4 h-6 w-24 rounded-sm" style={{ backgroundColor: accent }} />
        <div className="mt-4 h-px w-full" style={{ backgroundColor: line }} />
        <div className="mt-3 h-1.5 w-2/3 rounded-full" style={{ backgroundColor: bar }} />
      </div>
      <p className="mt-2.5 text-center font-mono text-2xs tracking-wide text-faint uppercase">
        {caption}
      </p>
    </div>
  );
}

export function PreviewMock() {
  return (
    <Panel spec="Preview" meta="same template, two clients">
      <div className="grid grid-cols-2 gap-3 rounded-lg bg-sunken p-3 sm:gap-5 sm:p-6">
        {/* The two renderings trade a slow, quiet emphasis — the eye is walked
            from one client to the other without anything demanding attention. */}
        <div className="mk-alt">
          <MiniEmail
            caption="As built"
            bg="#ffffff"
            ink={CANVAS_INK}
            bar={CANVAS_BAR}
            line={CANVAS_LINE}
            accent={CANVAS_ACCENT}
          />
        </div>
        {/* The repaint a forced-dark client applies — inverted surface, lifted
            accent, and the same geometry, which is the point of the check. */}
        <div className="mk-alt mk-alt-late">
          <MiniEmail
            caption="Forced dark"
            bg="#1b1c20"
            ink="#f3f3f2"
            bar="#3d3e45"
            line="#2f3036"
            accent="#6366f1"
          />
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------- 3. Ship */

export function ApiMock() {
  return (
    <Panel spec="Fetch a template" meta={SITE_HOST}>
      {/* The graphite rail tokens are theme-independent, so a terminal built from
          them reads the same in light and dark — which is what a terminal does. */}
      <div className="overflow-hidden rounded-lg border border-rail-line bg-rail-bg">
        <div className="flex items-center justify-between gap-3 border-b border-rail-line px-4 py-2.5 font-mono text-2xs">
          <span className="tracking-wide text-rail-faint uppercase">GET /api/public/v1/templates/:id</span>
          <span className="flex items-center gap-1.5" style={{ color: '#5fd3a0' }}>
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            200 OK
          </span>
        </div>

        {/* A phone is narrower than the curl line. Wrapping anywhere beats a
            hidden horizontal scroll on a block that only exists to be read. */}
        <div className="overflow-x-auto px-4 py-4 font-mono text-xs leading-relaxed">
          <pre className="whitespace-pre-wrap text-rail-muted [overflow-wrap:anywhere] sm:whitespace-pre">
            <span className="text-rail-faint">$ </span>
            <span className="text-rail-ink">curl </span>
            <span style={{ color: '#a5b4fc' }}>{PUBLIC_API_URL}/templates/tpl_welcome_01</span>
            {' \\\n'}
            <span className="text-rail-faint">    -H </span>
            <span style={{ color: '#a5b4fc' }}>&quot;Authorization: Bearer tply_live_8f2c…9d41&quot;</span>
            {'\n\n'}
            {'{\n'}
            {'  '}
            <span className="text-rail-ink">&quot;id&quot;</span>
            {': '}
            <span style={{ color: '#a5b4fc' }}>&quot;tpl_welcome_01&quot;</span>
            {',\n  '}
            <span className="text-rail-ink">&quot;subject&quot;</span>
            {': '}
            <span style={{ color: '#a5b4fc' }}>&quot;Your API key is ready&quot;</span>
            {',\n  '}
            <span className="text-rail-ink">&quot;html&quot;</span>
            {': '}
            <span style={{ color: '#a5b4fc' }}>&quot;&lt;!doctype html&gt;&lt;html&gt;…&lt;/html&gt;&quot;</span>
            {'\n}\n\n'}
            <span className="text-rail-faint">$ </span>
            {/* The prompt came back: a live terminal blinks. */}
            <span aria-hidden className="mk-caret" />
          </pre>
        </div>
      </div>
    </Panel>
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
const brands = [
  { name: 'Temply', swatches: ['#4f46e5', '#818cf8', '#eef0fe'] },
  { name: 'Northwind', swatches: ['#0f766e', '#2dd4bf', '#ccfbf1'] },
  { name: 'Beacon', swatches: ['#b45309', '#f59e0b', '#fef3c7'] },
];

export function VariablesMock() {
  return (
    <Panel spec="Variables & brands" meta="resolved per request">
      <div className="rounded-lg bg-sunken p-4 sm:p-6">
        <p className="font-mono text-2xs tracking-wide text-faint uppercase">Placeholders</p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {placeholders.map((placeholder) => (
            <li
              key={placeholder}
              className="rounded-sm border border-accent-ink/25 bg-accent-wash px-2 py-1 font-mono text-xs text-accent-ink"
            >
              {placeholder}
            </li>
          ))}
        </ul>

        <div className="my-5 h-px bg-line" />

        <p className="font-mono text-2xs tracking-wide text-faint uppercase">Saved brands</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {brands.map((brand) => (
            <div
              key={brand.name}
              className="flex items-center gap-2.5 rounded-full border border-line bg-raised py-1.5 pr-3.5 pl-2.5 shadow-xs"
            >
              <span aria-hidden className="flex">
                {brand.swatches.map((swatch, index) => (
                  <span
                    key={swatch}
                    className={`size-4 rounded-full ring-2 ring-raised ${index > 0 ? '-ml-1.5' : ''}`}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </span>
              <span className="text-xs font-medium text-ink">{brand.name}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
