import { afterEach, describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { BrandLogo } from './brand-logo';

afterEach(cleanup);

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const images = (container: HTMLElement) => [...container.querySelectorAll('img')];

describe('BrandLogo', () => {
  it('is the pack\'s two lockups, the colour one first and the on-dark one second, both named Temply', () => {
    const { container } = render(<BrandLogo />);
    const [light, dark] = images(container);
    expect(images(container)).toHaveLength(2);
    expect(light?.getAttribute('src')).toBe('/brand/temply-logo-horizontal.svg');
    expect(dark?.getAttribute('src')).toBe('/brand/temply-logo-horizontal-on-dark.svg');
    for (const image of images(container)) {
      expect(image.getAttribute('alt')).toBe('Temply');
      expect(existsSync(join(PUBLIC, image.getAttribute('src') ?? ''))).toBe(true);
    }
  });

  it('shows one of them by the app theme, the other being display: none', () => {
    const { container } = render(<BrandLogo />);
    const [light, dark] = images(container);
    expect(light?.className.split(' ')).toEqual(expect.arrayContaining(['block', 'not-forced-colors:dark:hidden']));
    expect(light?.className.split(' ')).not.toContain('hidden');
    expect(dark?.className.split(' ')).toEqual(expect.arrayContaining(['hidden', 'not-forced-colors:dark:block']));
    expect(dark?.className.split(' ')).not.toContain('block');
  });

  // Forced colours paint the page from the system's Canvas and leave an image
  // its own colours, so the file follows the system's scheme there. A class
  // whose variant is not declared is dropped without a warning, which would put
  // navy letters on a black Canvas.
  it('follows the system scheme in forced colours, by a variant the stylesheet declares', () => {
    const { container } = render(<BrandLogo />);
    const [light, dark] = images(container);
    expect(light?.className.split(' ')).toContain('forced-dark:hidden');
    expect(dark?.className.split(' ')).toContain('forced-dark:block');

    const css = readFileSync(join(PUBLIC, '..', 'app', 'globals.css'), 'utf8');
    const variant = /@custom-variant forced-dark\s*\{([^}]*\{[^}]*\}[^}]*)\}/.exec(css)?.[1] ?? '';
    expect(variant).toContain('@media (forced-colors: active) and (prefers-color-scheme: dark)');
    expect(variant).toContain('@slot');
  });

  it('holds the 1213.66 by 320 aspect while the file loads, and takes its size from the class on both', () => {
    const { container } = render(<BrandLogo className="h-8.75 w-auto" />);
    for (const image of images(container)) {
      expect(image.getAttribute('width')).toBe('1214');
      expect(image.getAttribute('height')).toBe('320');
      expect(image.className.split(' ')).toEqual(expect.arrayContaining(['h-8.75', 'w-auto']));
    }
  });

  it('leaves the name of the link round it to the link, which is the one thing a stylesheet-less render can keep whole', () => {
    const { container, getByRole } = render(
      <a href="/" aria-label="Temply">
        <BrandLogo />
      </a>,
    );
    expect(container.querySelectorAll('a')).toHaveLength(1);
    expect(getByRole('link', { name: 'Temply' }).getAttribute('href')).toBe('/');
  });

  it('carries no colour class or token: the colours are in the files', () => {
    const { container } = render(<BrandLogo />);
    expect(container.innerHTML).not.toMatch(/brand-|text-accent|#[0-9a-f]{3,8}\b/i);
  });
});
