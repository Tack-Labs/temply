export type FallbackFont =
  | 'serif'
  | 'sans-serif'
  | 'monospace'
  | 'cursive'
  | 'fantasy'
  | 'system-ui'
  | 'ui-serif'
  | 'ui-sans-serif'
  | 'ui-monospace'
  | 'ui-rounded'
  | 'emoji'
  | 'math'
  | 'initial'
  | 'inherit'
  | 'unset';

export type FontFormat = 'woff' | 'woff2' | 'truetype' | 'opentype' | 'embedded-opentype' | 'svg' | 'collection';

export interface FontProps {
  fontFamily: string;
  fallbackFontFamily: FallbackFont | FallbackFont[];
  webFont?: {
    url: string;
    format: FontFormat;
  };
  fontStyle?: string;
  fontWeight?: number;
}

export interface EditorThemeOptions {
  font?: FontProps | null;
  body?: {
    backgroundColor?: string;
    paddingTop?: string;
    paddingRight?: string;
    paddingBottom?: string;
    paddingLeft?: string;
  } | null;
  container?: {
    backgroundColor?: string;
    paddingTop?: string;
    paddingRight?: string;
    paddingBottom?: string;
    paddingLeft?: string;
    borderRadius?: string;
    borderWidth?: string;
    borderColor?: string;
    maxWidth?: string;
  } | null;
  button?: {
    backgroundColor?: string;
    color?: string;
    paddingTop?: string;
    paddingRight?: string;
    paddingBottom?: string;
    paddingLeft?: string;
    borderRadius?: string;
  } | null;
  link?: {
    color?: string;
  } | null;
}

export interface RendererThemeOptions {
  font?: FontProps | null;
  fontSize?: Record<string, any>;
  colors?: Record<string, string | undefined>;
  body?: {
    backgroundColor?: string;
    paddingTop?: string;
    paddingRight?: string;
    paddingBottom?: string;
    paddingLeft?: string;
  } | null;
  container?: {
    backgroundColor?: string;
    paddingTop?: string;
    paddingRight?: string;
    paddingBottom?: string;
    paddingLeft?: string;
    borderRadius?: string;
    borderWidth?: string;
    borderColor?: string;
    maxWidth?: string;
  } | null;
  button?: {
    backgroundColor?: string;
    color?: string;
    paddingTop?: string;
    paddingRight?: string;
    paddingBottom?: string;
    paddingLeft?: string;
    borderRadius?: string;
  } | null;
  link?: {
    color?: string;
  } | null;
}

export const allowedFallbackFonts: FallbackFont[] = [
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
  'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded',
  'emoji', 'math', 'initial', 'inherit', 'unset',
];

export const allowedFontFormats: FontFormat[] = [
  'woff', 'woff2', 'truetype', 'opentype', 'embedded-opentype', 'svg', 'collection',
];

export const DEFAULT_FONT: FontProps = {
  fontFamily: 'Inter',
  fallbackFontFamily: 'sans-serif',
  webFont: {
    url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter:vf@latest/latin-wght-normal.woff2',
    format: 'woff2',
  },
};

export const DEFAULT_EDITOR_THEME: EditorThemeOptions = {
  font: DEFAULT_FONT,
  body: { backgroundColor: '#F4F4F5', paddingTop: '50px', paddingRight: '0' },
  container: {
    backgroundColor: '#FFFFFF',
    paddingTop: '40px',
    paddingRight: '40px',
    borderRadius: '0',
    borderWidth: '0',
    borderColor: '#000000',
    maxWidth: '600px',
  },
  button: {
    backgroundColor: '#000000',
    color: '#FFFFFF',
    paddingTop: '12px',
    paddingRight: '24px',
    paddingBottom: '12px',
    paddingLeft: '24px',
    borderRadius: '6px',
  },
  link: { color: '#346FE4' },
};

export const DEFAULT_RENDERER_THEME: RendererThemeOptions = {
  font: DEFAULT_FONT,
  body: { backgroundColor: '#F4F4F5', paddingTop: '50px', paddingRight: '0', paddingBottom: '50px', paddingLeft: '0' },
  container: {
    backgroundColor: '#FFFFFF',
    paddingTop: '40px',
    paddingRight: '40px',
    paddingBottom: '40px',
    paddingLeft: '40px',
    borderRadius: '0',
    borderWidth: '0',
    borderColor: '#000000',
    maxWidth: '600px',
  },
  button: {
    backgroundColor: '#000000',
    color: '#FFFFFF',
    paddingTop: '12px',
    paddingRight: '24px',
    paddingBottom: '12px',
    paddingLeft: '24px',
    borderRadius: '6px',
  },
  link: { color: '#346FE4' },
};

export const DEFAULT_LINK_TEXT_COLOR = '#346FE4';


