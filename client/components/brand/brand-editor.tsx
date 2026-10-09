'use client';
import { useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import type { RendererThemeOptions } from '@temply/shared/theme';
import { BRAND_PRESETS } from '@temply/shared/brand-presets';
import { applyKnobs, knobsFromTheme } from '@temply/shared/brand-knobs';
import { matchThemeToBrand } from '~/lib/theme-match';
import { pressable } from '~/components/ui/button';
import { cn } from '~/lib/classname';
import { BrandKnobsControl } from './brand-knobs';
import { RawThemeFields } from './raw-theme-fields';

export function BrandEditor({ theme, onChange }: { theme: RendererThemeOptions; onChange: (t: RendererThemeOptions) => void }) {
  const [advanced, setAdvanced] = useState(false);
  const knobs = knobsFromTheme(theme);
  // Same recognition the template panel uses: a chip lights up while the
  // theme IS that preset, and goes quiet the moment an edit drifts from it.
  const activePresetId = matchThemeToBrand(theme);
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-base font-bold text-ink">Start from a preset</p>
        <div className="flex flex-wrap gap-2">
          {BRAND_PRESETS.map((p) => {
            const active = p.id === activePresetId;
            return (
              // A chip: the secondary button's pill and border, lit in the
              // accent wash while the theme is that preset.
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(structuredClone(p.theme))}
                className={cn(
                  'flex h-8 items-center gap-2 rounded-full border-[1.5px] px-3 text-sm font-semibold',
                  pressable,
                  active
                    ? 'border-accent bg-accent-wash text-accent-ink'
                    : 'border-line-strong bg-raised text-ink hover:bg-hover',
                )}
              >
                <span className="size-3 rounded-full" style={{ background: p.theme.button?.backgroundColor }} />
                {p.name}
              </button>
            );
          })}
        </div>
      </div>
      <BrandKnobsControl value={knobs} onChange={(k) => onChange(applyKnobs(theme, k))} />
      <div>
        <button type="button" onClick={() => setAdvanced((v) => !v)} aria-expanded={advanced} className="flex min-h-8 items-center gap-1 text-base font-semibold text-muted transition-colors duration-fast ease-out hover:text-ink motion-reduce:transition-none [&_svg]:size-4">
          <ChevronDownIcon className={`transition-transform duration-base ease-out motion-reduce:transition-none ${advanced ? 'rotate-180' : ''}`} />
          {advanced ? 'Hide advanced' : 'Advanced'}
        </button>
        {/* Same 0fr→1fr grid row the template panel uses to animate open. */}
        <div className={`grid transition-[grid-template-rows] duration-base ease-out motion-reduce:transition-none ${advanced ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="mt-3"><RawThemeFields theme={theme} onChange={onChange} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
