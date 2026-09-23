'use client';

import { HexColorInput, HexColorPicker } from 'react-colorful';
import { COLOR_PRESETS } from '~/lib/color-presets';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { pressable } from '~/components/ui/button';
import { cn } from '~/lib/classname';

/**
 * The app's colour control: a swatch-plus-hex trigger opening a popover that
 * leads with the curated presets, with the free-form picker underneath for
 * anyone the presets don't cover. Values are always uppercase hex.
 */
export function ColorPickerPopover({
  id,
  label,
  value,
  onChange,
  swatchClassName = 'size-6',
  hexClassName = 'text-2xs text-faint',
  touch = false,
}: {
  id?: string;
  /** Names the control for the hex input's aria-label. */
  label: string;
  value: string;
  onChange: (next: string) => void;
  swatchClassName?: string;
  hexClassName?: string;
  /** Sizes the popover's own controls for a thumb. The popover body renders in
   *  a portal, so a sheet cannot reach it with a wrapper class — it has to be
   *  asked for here. Off by default: every desktop popover keeps the sizes it
   *  has, and only the phone's Brand sheet passes it. */
  touch?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {/* Named here rather than left to a `<label for>`: the swatch is
            decorative and the only text inside is the hex value, so a trigger
            that loses its label announces itself as "#FFFFFF". */}
        <button id={id} type="button" aria-label={label} className="flex items-center gap-1.5 rounded-xs">
          <span
            aria-hidden
            className={`shrink-0 rounded-xs border border-line ${swatchClassName}`}
            style={{ backgroundColor: value }}
          />
          <span className={`font-mono uppercase ${hexClassName}`}>{value}</span>
        </button>
      </PopoverTrigger>
      {/* w-56 minus p-3 leaves exactly the 200px react-colorful renders at; the
          touch popover is widened to fit a row of five 44px targets instead,
          and stretches the picker to match. */}
      <PopoverContent align="start" className={cn('p-3', touch ? 'w-[17rem]' : 'w-56')}>
        <div className="grid grid-cols-5 gap-1.5">
          {COLOR_PRESETS.map((preset) => {
            const active = value.toUpperCase() === preset;
            return (
              <button
                key={preset}
                type="button"
                aria-label={`Use ${preset}`}
                aria-pressed={active}
                onClick={() => onChange(preset)}
                className={cn('grid place-items-center rounded-sm', pressable, touch ? 'size-11' : 'size-8')}
              >
                {/* The disc keeps its 32px whatever the target around it is. */}
                <span
                  aria-hidden
                  className={cn(
                    'block rounded-sm border',
                    touch ? 'size-8' : 'size-full',
                    active ? 'border-accent ring-2 ring-accent/40' : 'border-line',
                  )}
                  style={{ backgroundColor: preset }}
                />
              </button>
            );
          })}
        </div>
        <div className="my-3 h-px bg-line" />
        <HexColorPicker
          color={value}
          onChange={(next) => onChange(next.toUpperCase())}
          style={touch ? { width: '100%' } : undefined}
        />
        <HexColorInput
          prefixed
          color={value}
          onChange={(next) => onChange(next.toUpperCase())}
          aria-label={`${label} hex value`}
          className={cn(
            'mt-3 w-full rounded-xs border border-line bg-raised px-2 font-mono text-ink uppercase',
            touch ? 'h-11 text-sm' : 'h-7 text-xs',
          )}
        />
      </PopoverContent>
    </Popover>
  );
}
