import type { EditorThemeOptions } from '@temply/shared/theme';

export const DEFAULT_VALUES: Record<string, string> = {
  '--mly-font': 'Inter',
  '--mly-fallback-font': 'sans-serif',
  '--mly-body-background-color': '#ffffff',
  '--mly-body-padding-top': '0px',
  '--mly-body-padding-right': '0px',
  '--mly-body-padding-bottom': '0px',
  '--mly-body-padding-left': '0px',
  '--mly-container-background-color': '#ffffff',
  '--mly-container-padding-top': '0px',
  '--mly-container-padding-right': '0px',
  '--mly-container-padding-bottom': '0px',
  '--mly-container-padding-left': '0px',
  '--mly-container-border-radius': '0px',
  '--mly-container-border-width': '0px',
  '--mly-container-border-color': '#000000',
  '--mly-container-max-width': '600px',
};

export function getVariableValue(key: string): string {
  if (typeof document === 'undefined') return DEFAULT_VALUES[key] ?? '';
  const value = getComputedStyle(document.documentElement).getPropertyValue(key).trim();
  return value !== '' ? value : (DEFAULT_VALUES[key] ?? '');
}

export function getTemplyCssVariables(theme: EditorThemeOptions): Record<string, string> {
  const styles: Record<string, string> = {};
  const { body, container, font } = theme;

  if (font?.fontFamily) styles['--mly-font'] = font.fontFamily;
  if (font?.fallbackFontFamily) styles['--mly-fallback-font'] = String(font.fallbackFontFamily);

  if (body?.backgroundColor) styles['--mly-body-background-color'] = body.backgroundColor;
  if (body?.paddingTop) styles['--mly-body-padding-top'] = body.paddingTop;
  if (body?.paddingRight) styles['--mly-body-padding-right'] = body.paddingRight;

  if (container?.backgroundColor) styles['--mly-container-background-color'] = container.backgroundColor;
  if (container?.paddingTop) styles['--mly-container-padding-top'] = container.paddingTop;
  if (container?.paddingRight) styles['--mly-container-padding-right'] = container.paddingRight;
  if (container?.borderRadius) styles['--mly-container-border-radius'] = container.borderRadius;
  if (container?.borderWidth) styles['--mly-container-border-width'] = container.borderWidth;
  if (container?.borderColor) styles['--mly-container-border-color'] = container.borderColor;
  if (container?.maxWidth) styles['--mly-container-max-width'] = container.maxWidth;

  return styles;
}
