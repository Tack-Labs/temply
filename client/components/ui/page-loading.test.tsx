import { afterEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { MARK_PARTS } from '../brand-mark';
import { PageLoading } from './page-loading';

afterEach(cleanup);

describe('PageLoading', () => {
  it('is a status that says what it waits for, and draws nothing a reader would hear', () => {
    const { getByRole, container } = render(<PageLoading label="Loading the editor…" />);
    expect(getByRole('status').textContent).toBe('Loading the editor…');
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('breathes the mark\'s own three shapes, not a redrawn copy of them', () => {
    const { container } = render(<PageLoading />);
    const bars = [...container.querySelectorAll('path.page-loading-bar')];
    expect(bars.map((bar) => bar.getAttribute('d'))).toEqual(MARK_PARTS);
    // The retired mark was three rounded bars; nothing but the tile is a rect now.
    expect(container.querySelectorAll('rect')).toHaveLength(1);
    expect(container.innerHTML).not.toContain('rx="3.5"');
  });

  it('sits on the app icon\'s gradient tile, read from the brand tokens with no hex of its own', () => {
    const { container } = render(<PageLoading />);
    const tile = container.querySelector('rect') as SVGRectElement;
    const gradient = container.querySelector('linearGradient') as SVGLinearGradientElement;
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 1024 1024');
    expect(tile.getAttribute('fill')).toBe(`url(#${gradient.id})`);
    expect([...container.querySelectorAll('stop')].map((stop) => stop.getAttribute('style'))).toEqual([
      'stop-color: var(--brand-coral);',
      'stop-color: var(--brand-pink);',
      'stop-color: var(--brand-purple);',
    ]);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('gives each instance its own gradient, since a page can show two waits at once', () => {
    const { container } = render(
      <>
        <PageLoading />
        <PageLoading />
      </>,
    );
    const ids = [...container.querySelectorAll('linearGradient')].map((gradient) => gradient.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
