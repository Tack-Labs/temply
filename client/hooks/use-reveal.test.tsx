import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import '../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { isInView, useReveal } from './use-reveal';

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

const VIEWPORT = { width: 1000, height: 1000 };

type Box = { top: number; height: number; left?: number; width?: number };

function rect({ top, height, left = 0, width = VIEWPORT.width }: Box) {
  return { top, bottom: top + height, left, right: left + width, width, height };
}

describe('isInView', () => {
  it('is true for an element well inside the viewport', () => {
    expect(isInView(rect({ top: 100, height: 300 }), VIEWPORT)).toBe(true);
  });

  it('is false for an element below the fold or above the top', () => {
    expect(isInView(rect({ top: 1200, height: 300 }), VIEWPORT)).toBe(false);
    expect(isInView(rect({ top: -500, height: 300 }), VIEWPORT)).toBe(false);
  });

  it('measures against the viewport less its bottom tenth, at 15% visible', () => {
    // The bottom edge that counts is 900px. A 400px element needs 60px of itself above it.
    expect(isInView(rect({ top: 850, height: 400 }), VIEWPORT)).toBe(false);
    expect(isInView(rect({ top: 830, height: 400 }), VIEWPORT)).toBe(true);
  });

  it('uses the observer\'s width-based margin on portrait and landscape screens', () => {
    // Portrait root ends at 805, so 65 of these 400 pixels meet the 15% rule.
    expect(isInView(rect({ top: 740, height: 400, width: 390 }), { width: 390, height: 844 })).toBe(true);
    // Landscape root ends at 190, leaving only 40 of the same 400 pixels.
    expect(isInView(rect({ top: 150, height: 400, width: 1300 }), { width: 1300, height: 320 })).toBe(false);
  });

  it('is false for an element with no area, which the observer reports on its own terms', () => {
    expect(isInView(rect({ top: 100, height: 0 }), VIEWPORT)).toBe(false);
  });

  it('counts an element too tall to ever show 15% of itself as soon as any of it is in', () => {
    // 900px of root against a 7000px element tops out at 13%, so the ratio
    // rule alone would keep it hidden however far it is scrolled.
    expect(isInView(rect({ top: 850, height: 7000 }), VIEWPORT)).toBe(true);
    expect(isInView(rect({ top: -6500, height: 7000 }), VIEWPORT)).toBe(true);
    expect(isInView(rect({ top: 900, height: 7000 }), VIEWPORT)).toBe(false);
    expect(isInView(rect({ top: -7100, height: 7000 }), VIEWPORT)).toBe(false);
  });

  it('still asks for 15% of an element that could show that much', () => {
    // 6000px is the tallest that can: 900 / 6000 is exactly 15%.
    expect(isInView(rect({ top: 880, height: 6000 }), VIEWPORT)).toBe(false);
    expect(isInView(rect({ top: 0, height: 6000 }), VIEWPORT)).toBe(true);
  });
});

type Geometry = { ratio?: number; height?: number; rootHeight?: number; visibleHeight?: number };

/** The slice of IntersectionObserver the hook touches, with the callback exposed. */
class FakeObserver {
  static live: FakeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;

  constructor(
    private readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeObserver.live.push(this);
  }

  observe(el: Element) {
    this.observed.push(el);
  }

  disconnect() {
    this.disconnected = true;
  }

  /** One report to the callback. Without a geometry, the element is as tall as the root. */
  report(isIntersecting: boolean, geometry: Geometry = {}) {
    const { ratio = isIntersecting ? 1 : 0, height = 900, rootHeight = 900, visibleHeight = Math.min(height, rootHeight) } = geometry;
    this.callback(
      this.observed.map(
        (target) =>
          ({
            target,
            isIntersecting,
            intersectionRatio: ratio,
            boundingClientRect: rect({ top: 0, height }),
            rootBounds: rect({ top: 0, height: rootHeight }),
            intersectionRect: rect({ top: 0, height: isIntersecting ? visibleHeight : 0 }),
          }) as unknown as IntersectionObserverEntry,
      ),
      this as unknown as IntersectionObserver,
    );
  }
}

const original = {
  observer: globalThis.IntersectionObserver,
  matchMedia: window.matchMedia,
  rect: Element.prototype.getBoundingClientRect,
  width: window.innerWidth,
  height: window.innerHeight,
};

/** Rects keyed by test id, because happy-dom does no layout. */
let boxes: Record<string, Box> = {};

function setReducedMotion(reduced: boolean) {
  window.matchMedia = ((query: string) =>
    ({ matches: reduced && query.includes('prefers-reduced-motion'), media: query }) as MediaQueryList) as typeof window.matchMedia;
}

beforeEach(() => {
  FakeObserver.live = [];
  boxes = {};
  document.documentElement.removeAttribute('data-reveal-ready');
  globalThis.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver;
  Object.assign(window, { innerWidth: VIEWPORT.width, innerHeight: VIEWPORT.height });
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const box = boxes[this.getAttribute('data-testid') ?? ''];
    return (box ? rect(box) : rect({ top: 0, height: 0 })) as DOMRect;
  };
  setReducedMotion(false);
});

afterEach(() => {
  globalThis.IntersectionObserver = original.observer;
  window.matchMedia = original.matchMedia;
  Element.prototype.getBoundingClientRect = original.rect;
  Object.assign(window, { innerWidth: original.width, innerHeight: original.height });
  document.documentElement.removeAttribute('data-reveal-ready');
});

function Section({ id }: { id: string }) {
  const ref = useReveal();
  return <div ref={ref} data-reveal data-testid={id} />;
}

const READY = 'data-reveal-ready';
const flag = () => document.documentElement.hasAttribute(READY);

describe('useReveal', () => {
  it('leaves the server markup and the document alone', () => {
    const markup = renderToString(<Section id="a" />);
    expect(markup).not.toContain('data-revealed');
    expect(flag()).toBe(false);
  });

  it('marks what is on screen revealed and raises the flag in the same commit', () => {
    boxes = { top: { top: 100, height: 300 }, below: { top: 1400, height: 300 } };
    const { getByTestId } = render(
      <>
        <Section id="top" />
        <Section id="below" />
      </>,
    );

    expect(flag()).toBe(true);
    expect(getByTestId('top').getAttribute('data-revealed')).toBe('true');
    expect(getByTestId('below').getAttribute('data-revealed')).toBe('false');
  });

  it('observes with the margin and threshold the marking rule mirrors', () => {
    render(<Section id="a" />);
    const [observer] = FakeObserver.live;
    expect(observer.options).toEqual({ rootMargin: '0px 0px -10% 0px', threshold: [0, 0.15] });
    expect(observer.observed).toHaveLength(1);
  });

  it('keeps toggling both ways as the observer reports', () => {
    boxes = { a: { top: 1400, height: 300 } };
    const { getByTestId } = render(<Section id="a" />);
    const [observer] = FakeObserver.live;

    observer.report(true);
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');
    observer.report(false);
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');
  });

  it('hides again only below 15% for an element that could show that much', () => {
    boxes = { a: { top: 1400, height: 1000 } };
    const { getByTestId } = render(<Section id="a" />);
    const [observer] = FakeObserver.live;

    // The observer also reports crossing zero, with the element barely in.
    observer.report(true, { ratio: 0.04, height: 1000, rootHeight: 900 });
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');
    observer.report(true, { ratio: 0.2, height: 1000, rootHeight: 900 });
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');
    observer.report(true, { ratio: 0.1, height: 1000, rootHeight: 900 });
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');
  });

  it('reveals an element too tall to reach 15% as soon as the observer says any of it is in', () => {
    boxes = { a: { top: 1400, height: 7000 } };
    const { getByTestId } = render(<Section id="a" />);
    const [observer] = FakeObserver.live;

    observer.report(true, { ratio: 0.05, height: 7000, rootHeight: 900, visibleHeight: 350 });
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');
    observer.report(false, { height: 7000, rootHeight: 900 });
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');
  });

  it('never raises the flag under reduced motion, so nothing is ever hidden', () => {
    setReducedMotion(true);
    const { getByTestId } = render(<Section id="a" />);

    expect(flag()).toBe(false);
    expect(FakeObserver.live).toHaveLength(0);
    expect(getByTestId('a').hasAttribute('data-revealed')).toBe(false);
  });

  it('never raises the flag where there is no IntersectionObserver to reveal anything', () => {
    // @ts-expect-error the absence under test
    delete globalThis.IntersectionObserver;
    render(<Section id="a" />);

    expect(flag()).toBe(false);
  });

  it('holds the flag until the last observer is gone', () => {
    const first = render(<Section id="a" />);
    const second = render(<Section id="b" />);
    expect(flag()).toBe(true);

    first.unmount();
    expect(flag()).toBe(true);

    second.unmount();
    expect(flag()).toBe(false);
    expect(FakeObserver.live.every((observer) => observer.disconnected)).toBe(true);
  });
});
