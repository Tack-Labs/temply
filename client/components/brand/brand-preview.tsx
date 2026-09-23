'use client';

import type { RendererThemeOptions } from '@temply/shared/theme';

/**
 * A static, representative email rendered from a brand's theme — page colour,
 * card colour/corner/border/padding, text colour, button, and link. It is not
 * the real renderer, just a faithful-enough preview so a non-designer can see
 * what the knobs do.
 */
export function BrandPreview({ theme }: { theme: RendererThemeOptions }) {
  const page = theme.body?.backgroundColor ?? '#F4F4F5';
  const card = theme.container?.backgroundColor ?? '#FFFFFF';
  const radius = parseInt(theme.container?.borderRadius ?? '0', 10) || 0;
  const borderW = parseInt(theme.container?.borderWidth ?? '0', 10) || 0;
  const borderColor = theme.container?.borderColor ?? '#E4E4E7';
  const pad = parseInt(theme.container?.paddingTop ?? '40', 10) || 40;
  const text = theme.colors?.text ?? '#18181B';
  const btnBg = theme.button?.backgroundColor ?? '#000000';
  const btnText = theme.button?.color ?? '#FFFFFF';
  const btnRadius = parseInt(theme.button?.borderRadius ?? String(radius), 10) || 0;
  const link = theme.link?.color ?? '#346FE4';

  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="flex min-h-[320px] items-start justify-center p-5" style={{ background: page }}>
        <div
          className="w-full"
          style={{
            background: card,
            borderRadius: radius,
            border: borderW > 0 ? `1px solid ${borderColor}` : 'none',
            padding: Math.round(pad * 0.65),
          }}
        >
          <div className="flex items-center gap-2">
            <span className="size-6 shrink-0 rounded-full" style={{ background: btnBg }} />
            <span className="text-[11px] font-semibold" style={{ color: text }}>Your brand</span>
          </div>

          <div className="mt-3 text-[15px] font-semibold leading-snug" style={{ color: text }}>
            Your subject line
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: text, opacity: 0.7 }}>
            This is how an email looks with this brand — the card, colours,
            corners and spacing all come from these settings.
          </p>

          <div className="mt-3.5">
            <span
              className="inline-block text-[11px] font-medium"
              style={{ background: btnBg, color: btnText, borderRadius: btnRadius, padding: '7px 14px' }}
            >
              Get started
            </span>
          </div>

          <p className="mt-3.5 text-[11px]" style={{ color: text, opacity: 0.7 }}>
            Or{' '}
            <span style={{ color: link, textDecoration: 'underline' }}>read the announcement</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
