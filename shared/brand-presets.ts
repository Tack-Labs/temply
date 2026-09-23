import type { RendererThemeOptions } from './theme';
import { DEFAULT_FONT } from './theme';

function preset(o: {
  page: string; card: string; text: string; button: string; link: string;
  radius: string; cardPad: string; topPad: string; borderWidth?: string; borderColor?: string;
}): RendererThemeOptions {
  return {
    font: DEFAULT_FONT,
    colors: { text: o.text },
    body: { backgroundColor: o.page, paddingTop: o.topPad, paddingRight: '0', paddingBottom: o.topPad, paddingLeft: '0' },
    container: {
      backgroundColor: o.card, paddingTop: o.cardPad, paddingRight: o.cardPad, paddingBottom: o.cardPad, paddingLeft: o.cardPad,
      borderRadius: o.radius, borderWidth: o.borderWidth ?? '0', borderColor: o.borderColor ?? '#000000', maxWidth: '600px',
    },
    button: { backgroundColor: o.button, color: '#FFFFFF', paddingTop: '12px', paddingRight: '24px', paddingBottom: '12px', paddingLeft: '24px', borderRadius: o.radius },
    link: { color: o.link },
  };
}

/** Every preset must clear the editor's own readability check (4.5:1 for
 *  links on the card and for the label on the button, as sent and under a
 *  forced dark mode) — a built-in look that opens with a warning against
 *  itself is a bug. theme-warnings.test.ts holds the line. */
export const BRAND_PRESETS: { id: string; name: string; theme: RendererThemeOptions }[] = [
  { id: 'classic', name: 'Classic', theme: preset({ page: '#F4F4F5', card: '#FFFFFF', text: '#18181B', button: '#18181B', link: '#2563EB', radius: '6px', cardPad: '40px', topPad: '50px' }) },
  { id: 'minimal', name: 'Minimal', theme: preset({ page: '#FFFFFF', card: '#FFFFFF', text: '#111111', button: '#111111', link: '#111111', radius: '0', cardPad: '40px', topPad: '50px', borderWidth: '1px', borderColor: '#E4E4E7' }) },
  { id: 'corporate', name: 'Corporate', theme: preset({ page: '#F1F5F9', card: '#FFFFFF', text: '#0F172A', button: '#1E3A8A', link: '#1E3A8A', radius: '8px', cardPad: '40px', topPad: '50px' }) },
  { id: 'warm', name: 'Warm', theme: preset({ page: '#FAF6F0', card: '#FFFFFF', text: '#3F3A34', button: '#B25D38', link: '#B25D38', radius: '10px', cardPad: '28px', topPad: '32px' }) },
  { id: 'slate', name: 'Slate', theme: preset({ page: '#F1F5F5', card: '#FFFFFF', text: '#1F2937', button: '#0F766E', link: '#0F766E', radius: '8px', cardPad: '28px', topPad: '32px' }) },
];

