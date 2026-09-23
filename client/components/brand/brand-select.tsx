'use client';

import type { RendererThemeOptions } from '@temply/shared/theme';
import { BRAND_PRESETS } from '@temply/shared/brand-presets';
import { DropdownSelect, type DropdownOption } from '~/components/ui/dropdown-select';

type Theme = RendererThemeOptions;

/** The three colours that read as "this brand" at a glance — the same triplet
 *  the brands page prints on each card. */
function BrandSwatches({ theme }: { theme: Theme }) {
  const colors = [
    theme.body?.backgroundColor,
    theme.button?.backgroundColor,
    theme.link?.color,
  ];
  return (
    <span aria-hidden className="flex shrink-0 gap-0.5">
      {colors.map((color, i) => (
        <span
          key={i}
          className="size-3.5 rounded-xs border border-line"
          style={{ background: color }}
        />
      ))}
    </span>
  );
}

/** Parses a stored brand theme; a malformed one just draws no swatches. */
function safeParse(raw: string): Theme {
  try {
    return JSON.parse(raw) as Theme;
  } catch {
    return {};
  }
}

export function BrandSelect({
  value,
  onValueChange,
  brands,
  theme,
  className,
  touch,
}: {
  value: string;
  onValueChange: (value: string) => void;
  brands: { id: string; name: string; theme: string }[];
  /** The live theme, so the Custom row shows what the template looks like now. */
  theme: Theme;
  className?: string;
  /** Passed straight to the dropdown: its rows are portalled out of any sheet. */
  touch?: boolean;
}) {
  const options: DropdownOption[] = [
    // Custom is a state, not a choice: it only appears once this template's
    // settings have drifted from every brand.
    ...(value === 'custom'
      ? [
          {
            value: 'custom',
            label: 'Custom',
            tag: 'This template',
            leading: <BrandSwatches theme={theme} />,
          },
        ]
      : []),
    ...BRAND_PRESETS.map((preset, i) => ({
      value: preset.id,
      label: preset.name,
      tag: 'Preset',
      leading: <BrandSwatches theme={preset.theme} />,
      separatorBefore: i === 0 && value === 'custom',
    })),
    ...brands.map((brand, i) => ({
      value: brand.id,
      label: brand.name,
      leading: <BrandSwatches theme={safeParse(brand.theme)} />,
      separatorBefore: i === 0,
    })),
  ];

  return (
    <DropdownSelect
      label="Brand"
      options={options}
      value={value}
      onValueChange={onValueChange}
      className={className}
      touch={touch}
    />
  );
}
