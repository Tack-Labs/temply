import { afterEach, describe, expect, it } from 'bun:test';
import '../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { BrandMark } from './brand-mark';

afterEach(cleanup);

const svg = (container: HTMLElement) => container.querySelector('svg') as SVGSVGElement;
const stops = (container: HTMLElement) => [...container.querySelectorAll('stop')];

describe('BrandMark', () => {
  it('is a gradient by default, with its stops read from the brand tokens and no colour of its own', () => {
    const { container } = render(<BrandMark />);
    const read = stops(container).map((stop) => [stop.getAttribute('offset'), stop.getAttribute('style')]);
    expect(read).toEqual([
      ['0', 'stop-color: var(--brand-coral);'],
      ['0.45', 'stop-color: var(--brand-pink);'],
      ['1', 'stop-color: var(--brand-purple);'],
    ]);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('fills its one path from the gradient it carries, drawn across the whole 360 by 320 shape', () => {
    const { container } = render(<BrandMark />);
    const gradient = container.querySelector('linearGradient') as SVGLinearGradientElement;
    expect(svg(container).getAttribute('viewBox')).toBe('0 0 360 320');
    expect(gradient.getAttribute('gradientUnits')).toBe('userSpaceOnUse');
    expect(['x1', 'y1', 'x2', 'y2'].map((name) => gradient.getAttribute(name))).toEqual(['0', '30', '290', '250']);
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(1);
    expect(paths[0]?.getAttribute('fill')).toBe(`url(#${gradient.id})`);
  });

  it('gives every instance its own gradient, so a hidden mark cannot take the paint from a visible one', () => {
    const { container } = render(
      <>
        <BrandMark />
        <BrandMark />
      </>,
    );
    const ids = [...container.querySelectorAll('linearGradient')].map((gradient) => gradient.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    // A selector, a url() and an id attribute all have to take it as written.
    for (const id of ids) expect(id).toMatch(/^[\w-]+$/);
    const fills = [...container.querySelectorAll('path')].map((path) => path.getAttribute('fill'));
    expect(fills).toEqual(ids.map((id) => `url(#${id})`));
  });

  it('is one colour, the text colour around it, as the mono variant', () => {
    const { container } = render(<BrandMark variant="mono" className="text-ink" />);
    expect(container.querySelector('linearGradient')).toBeNull();
    expect(container.querySelector('path')?.getAttribute('fill')).toBe('currentColor');
    expect(svg(container).getAttribute('class')).toBe('text-ink');
  });

  it('is decorative, and takes its size and placement from the class it is given', () => {
    const { container } = render(<BrandMark className="size-6 shrink-0" />);
    expect(svg(container).getAttribute('aria-hidden')).toBe('true');
    expect(svg(container).getAttribute('class')).toBe('size-6 shrink-0');
    expect(svg(container).getAttribute('role')).toBeNull();
  });
});
