/**
 * The slash menu, drawn at rest. This is the one control every Temply user
 * touches on their way to everything else, so the landing page shows the actual
 * interaction — press `/`, pick a block — rather than listing block names.
 *
 * The right-hand column on each row is the block's group, which is how the menu
 * is organised in the editor. It is information, not garnish.
 */

import {
  BracesIcon,
  Columns3Icon,
  CornerDownLeftIcon,
  GitBranchIcon,
  ImageIcon,
  MousePointerClickIcon,
  TypeIcon,
} from 'lucide-react';

const paletteRows = [
  { icon: TypeIcon, name: 'Text formatting', group: 'Content' },
  { icon: MousePointerClickIcon, name: 'Buttons', group: 'Content' },
  { icon: ImageIcon, name: 'Images', group: 'Content' },
  { icon: Columns3Icon, name: 'Columns', group: 'Layout' },
  { icon: BracesIcon, name: 'Variables', group: 'Logic' },
  { icon: GitBranchIcon, name: 'Show-if conditions', group: 'Logic' },
];

export function BlockPalette() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-raised shadow-lg">
      {/* The query line. `/` is shown as typed, with a caret after it. */}
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <span className="font-mono text-base text-accent-ink">/</span>
        <span className="text-base text-faint">Insert a block</span>
        <span
          aria-hidden
          className="ml-auto rounded-xs border border-line bg-surface px-1.5 py-0.5 font-mono text-2xs text-faint"
        >
          esc
        </span>
      </div>

      <ul className="p-1.5">
        {paletteRows.map((row, index) => {
          const Icon = row.icon;
          // The first row carries the menu's resting highlight, so the card
          // reads as a live menu rather than a screenshot of an empty one.
          const active = index === 0;
          return (
            <li
              key={row.name}
              className={`flex items-center gap-3 rounded-md px-2.5 py-2 ${active ? 'bg-accent-wash' : ''}`}
            >
              <span
                className={`flex size-7 items-center justify-center rounded-sm border ${
                  active
                    ? 'border-accent-ink/25 bg-raised text-accent-ink'
                    : 'border-line bg-surface text-muted'
                }`}
              >
                <Icon className="size-3.5" />
              </span>
              <span className={`text-base ${active ? 'font-medium text-ink' : 'text-muted'}`}>
                {row.name}
              </span>
              {active ? (
                <CornerDownLeftIcon aria-hidden className="ml-auto size-3.5 text-accent-ink" />
              ) : (
                <span className="ml-auto font-mono text-2xs tracking-wide text-faint uppercase">
                  {row.group}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="border-t border-line px-4 py-2.5 font-mono text-2xs text-faint">
        16 blocks · filter by typing
      </div>
    </div>
  );
}
