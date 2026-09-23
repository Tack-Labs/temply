'use client';
import { useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import type { RendererThemeOptions } from '@temply/shared/theme';
import { BRAND_PRESETS } from '@temply/shared/brand-presets';
import { applyKnobs, knobsFromTheme } from '@temply/shared/brand-knobs';
import { matchThemeToBrand } from '~/lib/theme-match';
import { pressable } from '~/components/ui/button';
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
        <p className="mb-1.5 text-xs font-medium text-ink">Start from a preset</p>
        <div className="flex flex-wrap gap-2">
          {BRAND_PRESETS.map((p) => {
            const active = p.id === activePresetId;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(structuredClone(p.theme))}
                className={`flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs ${pressable} ${
                  active
                    ? 'border-accent bg-accent-wash text-accent-ink'
                    : 'border-line text-ink hover:bg-hover'
                }`}
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
        <button type="button" onClick={() => setAdvanced((v) => !v)} aria-expanded={advanced} className="flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-ink [&_svg]:size-3.5">
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
