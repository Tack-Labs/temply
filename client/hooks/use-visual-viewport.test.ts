import { describe, expect, it } from 'bun:test';
import { viewportFrame } from './use-visual-viewport';

describe('viewportFrame', () => {
  it('is the whole screen with no keyboard', () => {
    expect(viewportFrame({ height: 844, offsetTop: 0 })).toEqual({ top: 0, height: 844 });
  });
  it('follows the visual viewport iOS shrinks and scrolls under a keyboard', () => {
    expect(viewportFrame({ height: 508.4, offsetTop: 120.6 })).toEqual({ top: 121, height: 508 });
  });
});
