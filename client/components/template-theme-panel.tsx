'use client';

import { useQuery } from '@tanstack/react-query';
import type { RendererThemeOptions } from '@temply/shared/theme';
import { DEFAULT_RENDERER_THEME } from '@temply/shared/theme';
import { applyKnobs, knobsFromTheme } from '@temply/shared/brand-knobs';
import { ChevronDownIcon, PaletteIcon, RotateCcwIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { BrandSelect } from '~/components/brand/brand-select';
import { BrandKnobsControl } from '~/components/brand/brand-knobs';
import { RawThemeFields } from '~/components/brand/raw-theme-fields';
import { BRAND_PRESETS } from '@temply/shared/brand-presets';
import { brandsQueryOptions } from '~/lib/brands';
import { isFreshTheme, matchThemeToBrand } from '~/lib/theme-match';
import { cn } from '~/lib/classname';

/**
 * Brand settings for the email being edited.
 *
 * They sit beside the email they change. Brand is the one feature that makes a
 * template look like the sender's own, so it has to be reachable from the
 * place someone is already looking — not from a route they would have to know
 * about, and not from state carried in the URL.
 */

type Theme = RendererThemeOptions;

/** Parses a stored brand theme, falling back to the current theme if it's malformed. */
function safeParse(raw: string, fallback: Theme): Theme {
  try {
    return JSON.parse(raw) as Theme;
  } catch {
    return fallback;
  }
}

export function TemplateThemePanel({
  theme,
  onChange,
  className,
  touch,
}: {
  theme: Theme;
  onChange: (next: Theme) => void;
  className?: string;
  /** Sizes the controls that render in a portal — the brand dropdown's rows and
   *  every colour popover — for a thumb. The phone's Brand sheet sets it; a
   *  wrapper class cannot reach past a portal. Everything else the panel draws
   *  is in the sheet's own subtree and is grown there. */
  touch?: boolean;
}) {
  const { data, isError } = useQuery(brandsQueryOptions());
  const brands = data?.brands ?? [];
  const [showAdvanced, setShowAdvanced] = useState(false);

  // The selection starts on whatever the theme already IS: a preset, a saved
  // brand, or — for a template that was edited before — Custom. A fresh
  // template (still on the shipped default theme) adopts the user's default
  // brand once the brands load. "Custom" is not offered as a choice; it only
  // appears, selected, after a config is edited in this session, and belongs
  // to this template alone.
  const [selectedBrandId, setSelectedBrandId] = useState(() => matchThemeToBrand(theme, []));
  const resolvedDefault = useRef(false);
  // What Reset returns to: the theme this editing session opened on, settled
  // only after the default brand (if any) has been adopted — resetting to the
  // shipped default would land somewhere the user has never been.
  const baseline = useRef<{ theme: Theme; brandId: string } | null>(null);

  useEffect(() => {
    if (resolvedDefault.current) return;
    if (!data && !isError) return; // wait until brands (and the default) are known
    resolvedDefault.current = true;

    // A saved-brand theme can only be recognised once the brands arrive.
    const match = matchThemeToBrand(theme, data?.brands ?? [], data?.defaultBrandId ?? null);
    if (match !== 'custom') {
      setSelectedBrandId(match);
      baseline.current = { theme: structuredClone(theme), brandId: match };
      return;
    }

    // Fresh canvas → start from the user's default brand. On the anonymous
    // playground the brands request 401s, but the presets ship with the app,
    // so the signed-out default is the same Classic a new account gets —
    // not the renderer's raw black-and-sharp theme labelled "Custom".
    if (isFreshTheme(theme)) {
      const id = data?.defaultBrandId ?? 'classic';
      const preset = BRAND_PRESETS.find((p) => p.id === id);
      const brand = data?.brands.find((b) => b.id === id);
      const brandTheme = preset?.theme ?? (brand ? safeParse(brand.theme, theme) : null);
      if (brandTheme) {
        setSelectedBrandId(id);
        baseline.current = { theme: structuredClone(brandTheme), brandId: id };
        onChange(structuredClone(brandTheme));
        return;
      }
    }

    setSelectedBrandId('custom');
    baseline.current = { theme: structuredClone(theme), brandId: 'custom' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isError]);

  const handleReset = () => {
    const target = baseline.current ?? {
      theme: DEFAULT_RENDERER_THEME,
      brandId: matchThemeToBrand(DEFAULT_RENDERER_THEME, brands, data?.defaultBrandId ?? null),
    };
    setSelectedBrandId(target.brandId);
    onChange(structuredClone(target.theme));
  };

  const handleBrandChange = (id: string) => {
    setSelectedBrandId(id);
    if (id === 'custom') return;
    // Presets ship with the app; saved brands come from the API. Presets first —
    // their ids ('classic', …) never collide with a saved brand's UUID.
    const preset = BRAND_PRESETS.find((p) => p.id === id);
    if (preset) {
      onChange(structuredClone(preset.theme));
      return;
    }
    const brand = brands.find((b) => b.id === id);
    if (!brand) return;
    onChange(structuredClone(safeParse(brand.theme, theme)));
  };

  const handleEdit = (next: Theme) => {
    setSelectedBrandId('custom');
    onChange(next);
  };

  return (
    <section className={cn('rounded-lg border border-line bg-raised', className)}>
      <header className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <PaletteIcon className="size-4 text-faint" />
          Brand
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
        >
          <RotateCcwIcon />
          Reset
        </Button>
      </header>

      <div className="space-y-4 p-3.5">
        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-ink">Brand</span>
          <BrandSelect
            value={selectedBrandId}
            onValueChange={handleBrandChange}
            brands={brands}
            theme={theme}
            className="w-full"
            touch={touch}
          />
        </div>

        <BrandKnobsControl
          value={knobsFromTheme(theme)}
          onChange={(knobs) => handleEdit(applyKnobs(theme, knobs))}
          touch={touch}
        />

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className="flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-ink [&_svg]:size-3.5"
          >
            <ChevronDownIcon
              className={cn(
                'transition-transform duration-base ease-out motion-reduce:transition-none',
                showAdvanced && 'rotate-180'
              )}
            />
            {showAdvanced ? 'Hide advanced' : 'Advanced'}
          </button>
          {/* The 0fr→1fr grid row is the one way to animate to a height the
              content decides; `overflow-hidden` clips the panel while it grows. */}
          <div
            className={cn(
              'grid transition-[grid-template-rows] duration-base ease-out motion-reduce:transition-none',
              showAdvanced ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            )}
          >
            <div className="overflow-hidden">
              <div className="mt-3">
                <RawThemeFields theme={theme} onChange={handleEdit} touch={touch} />
              </div>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
