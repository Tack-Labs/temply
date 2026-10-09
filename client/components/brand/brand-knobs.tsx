'use client';
import type { BrandKnobs } from '@temply/shared/brand-knobs';
import { ColorPickerPopover } from '~/components/ui/color-picker-popover';
import { SegmentedControl } from '~/components/ui/segmented-control';

const CORNERS: { value: BrandKnobs['corner']; label: string }[] = [
  { value: 'sharp', label: 'Sharp' }, { value: 'soft', label: 'Soft' }, { value: 'round', label: 'Round' },
];
const DENSITIES: { value: BrandKnobs['density']; label: string }[] = [
  { value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' },
];

const knobLabel = 'block text-base font-bold text-ink';

/** The three knobs a brand is set by. Corner and density are one choice out
 *  of a few, so they are the app's segmented control, the way a filter is. */
export function BrandKnobsControl({ value, onChange, touch }: { value: BrandKnobs; onChange: (k: BrandKnobs) => void; /** Passed to the colour popover, which is portalled out of any sheet. */ touch?: boolean }) {
  return (
    <div className="@container">
    <div className="grid grid-cols-1 gap-3 @xl:grid-cols-3">
      <div className="min-w-0 space-y-1.5">
        <span className={knobLabel}>Brand color</span>
        <ColorPickerPopover
          label="Brand color"
          value={value.accent}
          onChange={(accent) => onChange({ ...value, accent })}
          touch={touch}
        />
      </div>
      <div className="min-w-0 space-y-1.5">
        <span className={knobLabel}>Corner</span>
        <SegmentedControl
          label="Corner"
          size="sm"
          value={value.corner}
          onValueChange={(corner) => onChange({ ...value, corner })}
          options={CORNERS}
          className="w-full [&>button]:flex-1"
        />
      </div>
      <div className="min-w-0 space-y-1.5">
        <span className={knobLabel}>Density</span>
        <SegmentedControl
          label="Density"
          size="sm"
          value={value.density}
          onValueChange={(density) => onChange({ ...value, density })}
          options={DENSITIES}
          className="w-full [&>button]:flex-1"
        />
      </div>
    </div>
    </div>
  );
}
