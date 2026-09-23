import type { LucideIcon } from 'lucide-react';

export interface BlockRow {
  /** The lucide icon the block actually carries in the slash menu, so the row
   *  and the editor agree at a glance. */
  icon: LucideIcon;
  name: string;
  /** What the block is. */
  what: string;
  /** When to reach for it. */
  when: string;
}

interface BlockListProps {
  blocks: BlockRow[];
}

export function BlockList({ blocks }: BlockListProps) {
  return (
    <ul className="mt-5 max-w-2xl divide-y divide-line border-y border-line">
      {blocks.map((block) => {
        const Icon = block.icon;
        return (
          <li
            key={block.name}
            className="flex gap-3.5 py-3.5 sm:gap-4"
          >
            {/* faint is a border-and-icon token, never text — the icon is
                decorative here because the name beside it says the same thing. */}
            <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-faint" />
            {/* min-w-0 so long words wrap inside the flex child instead of
                pushing the row past the viewport at 360px. */}
            <div className="min-w-0">
              <p className="text-base font-medium text-ink">{block.name}</p>
              <p className="mt-1 text-base leading-relaxed text-pretty text-muted">
                {block.what} {block.when}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
