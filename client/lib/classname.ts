import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge knows only Tailwind's own theme keys. `text-ui` and the
// pixel-named steps (`text-34`) would be read as text colours and lose to (or
// beat) the wrong neighbour, and the custom radius and shadow names would
// never replace a stock `rounded-*` or `shadow-*`. Keep this list in step with
// the redesign's additions to `--text-*`, `--radius-*` and `--shadow-*` in
// globals.css.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['ui', '18', '26', '34', '38', '48', '68'],
      radius: ['field', 'card', 'panel'],
      shadow: ['cta'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
