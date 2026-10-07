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

  it('holds back what Chromium and a spec-literal engine would each hold back, in portrait', () => {
    // 390x844: the root ends at 759.6 when the inset is a tenth of the height,
    // which is what Chromium does (measured), and at 805 when it is a tenth of
    // the width, which is what the specification's text says and what the
    // `byWidth` candidate stands in for: Firefox and WebKit are the engines it
    // hedges for, and neither could be run. The first paint cannot tell which
    // an engine does, so it marks only what both would reveal; marking more
    // would show the element and then fade it out when the observer reports. At
    // top 700 the tighter root shows 59.6 of these 400px, short of 60.
    const portrait = { width: 390, height: 844 };
    expect(isInView(rect({ top: 700, height: 400, width: 390 }), portrait)).toBe(false);
    expect(isInView(rect({ top: 690, height: 400, width: 390 }), portrait)).toBe(true);
  });

  it('holds back what Chromium and a spec-literal engine would each hold back, in landscape', () => {
    // 1300x320: the root ends at 288 (Chromium, a tenth of the height) or at 190
    // (a tenth of the width, the `byWidth` candidate). The tighter one shows 40
    // of these 300px at top 150, 13%; at top 140 it shows 50, 17%.
    const landscape = { width: 1300, height: 320 };
    expect(isInView(rect({ top: 150, height: 300, width: 1300 }), landscape)).toBe(false);
    expect(isInView(rect({ top: 140, height: 300, width: 1300 }), landscape)).toBe(true);
  });

  it('is false for an element with no area, which the observer reports on its own terms', () => {
    expect(isInView(rect({ top: 100, height: 0 }), VIEWPORT)).toBe(false);
  });

  it('is false for a box that reports no area, whatever its edges say, rather than dividing by it', () => {
    // Anything over zero is Infinity, which clears 15% on its own: the guard is
    // what stops a collapsed box from being revealed by its own edges.
    const flat = { top: 100, bottom: 400, left: 0, right: 500 };
    expect(isInView({ ...flat, width: 500, height: 0 }, VIEWPORT)).toBe(false);
    expect(isInView({ ...flat, width: 0, height: 300 }, VIEWPORT)).toBe(false);
  });

  it('is false for an element clear of the viewport sideways, however far down the page it sits', () => {
    expect(isInView(rect({ top: 100, height: 300, left: VIEWPORT.width, width: 400 }), VIEWPORT)).toBe(false);
    expect(isInView(rect({ top: 100, height: 300, left: -400, width: 400 }), VIEWPORT)).toBe(false);
    expect(isInView(rect({ top: 100, height: 300, left: 700, width: 400 }), VIEWPORT)).toBe(true);
  });

  it('counts only the width that is on screen towards the 15%', () => {
    // 1000x300 with 100px of its width showing is 10% of it; with 200px, 20%.
    expect(isInView(rect({ top: 100, height: 300, left: -900, width: 1000 }), VIEWPORT)).toBe(false);
    expect(isInView(rect({ top: 100, height: 300, left: -800, width: 1000 }), VIEWPORT)).toBe(true);
    // And the same off the right edge.
    expect(isInView(rect({ top: 100, height: 300, left: 900, width: 1000 }), VIEWPORT)).toBe(false);
    expect(isInView(rect({ top: 100, height: 300, left: 800, width: 1000 }), VIEWPORT)).toBe(true);
  });

  it('counts an element taller than two roots as soon as any of it is in', () => {
    // 7000px against a 900px root: 15% of it is never on screen at once, and
    // even where it could be, nobody scrolls to a share of a section that long.
    expect(isInView(rect({ top: 850, height: 7000 }), VIEWPORT)).toBe(true);
    expect(isInView(rect({ top: -6500, height: 7000 }), VIEWPORT)).toBe(true);
    expect(isInView(rect({ top: 900, height: 7000 }), VIEWPORT)).toBe(false);
    expect(isInView(rect({ top: -7100, height: 7000 }), VIEWPORT)).toBe(false);
  });

  it('draws the line at two roots: 1800px against a 900px root still needs 15%', () => {
    expect(isInView(rect({ top: 880, height: 1800 }), VIEWPORT)).toBe(false);
    expect(isInView(rect({ top: 880, height: 1801 }), VIEWPORT)).toBe(true);
    // Past the line, the ratio rule still reveals what shows enough of itself.
    expect(isInView(rect({ top: 0, height: 1800 }), VIEWPORT)).toBe(true);
  });

  // The pricing section on a phone held sideways. At 1742px, 15% of it is 261px:
  // within the 288px root at 568x320, so a ratio rule asked for nearly the
  // whole root and left the section blank until its top was within ~27px of the
  // screen's. At 2269px it was past that, which is why only the shorter
  // section showed the problem.
  describe.each([1742, 2269])('a %ipx section on a phone held sideways', (height) => {
    const phones = [
      { name: '568x320', width: 568, height: 320 },
      { name: '667x375', width: 667, height: 375 },
      { name: '812x375', width: 812, height: 375 },
    ];

    it.each(phones)('is in as soon as it is on screen at $name', (viewport) => {
      // Offsets that leave only a sliver of it above the root's bottom edge,
      // however an engine insets it.
      for (const top of [viewport.height * 0.7, viewport.height * 0.5, 150, 60, 0, -400]) {
        expect(isInView(rect({ top, height, width: viewport.width }), viewport)).toBe(true);
      }
    });

    it.each(phones)('is out once it is below or above the screen at $name', (viewport) => {
      expect(isInView(rect({ top: viewport.height, height, width: viewport.width }), viewport)).toBe(false);
      expect(isInView(rect({ top: -height, height, width: viewport.width }), viewport)).toBe(false);
    });
  });
});

type Geometry = {
  ratio?: number;
  height?: number;
  rootHeight?: number;
  visibleHeight?: number;
  /** Where the box's top edge sits against the root's, which is 0. Negative is clipped by it. */
  top?: number;
  rootBounds?: null;
};

/** The slice of IntersectionObserver the hook touches, with the callback exposed. */
class FakeObserver {
  static live: FakeObserver[] = [];
  /** What an engine does on `observe()`: report the target as it stands, whether or not a threshold was crossed. */
  static notifyOnObserve: ((observer: FakeObserver) => void) | null = null;
  observed: Element[] = [];
  observeCalls = 0;
  disconnected = false;

  constructor(
    private readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeObserver.live.push(this);
  }

  observe(el: Element) {
    this.observed.push(el);
    this.observeCalls += 1;
    FakeObserver.notifyOnObserve?.(this);
  }

  unobserve(el: Element) {
    this.observed = this.observed.filter((target) => target !== el);
  }

  disconnect() {
    this.disconnected = true;
  }

  /** One report to the callback. Without a geometry, the element is as tall as the root. */
  report(isIntersecting: boolean, geometry: Geometry = {}) {
    const { ratio = isIntersecting ? 1 : 0, height = 900, rootHeight = 900, top = 0 } = geometry;
    const { visibleHeight = Math.max(0, Math.min(top + height, rootHeight) - Math.max(top, 0)) } = geometry;
    this.callback(
      this.observed.map(
        (target) =>
          ({
            target,
            isIntersecting,
            intersectionRatio: ratio,
            boundingClientRect: rect({ top, height }),
            rootBounds: geometry.rootBounds === null ? null : rect({ top: 0, height: rootHeight }),
            intersectionRect: rect({ top: Math.max(top, 0), height: isIntersecting ? visibleHeight : 0 }),
          }) as unknown as IntersectionObserverEntry,
      ),
      this as unknown as IntersectionObserver,
    );
  }
}

/** A ResizeObserver whose callback the case fires by hand. */
class FakeResizeObserver {
  static live: FakeResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.live.push(this);
  }

  observe(el: Element) {
    this.observed.push(el);
  }

  unobserve() {}

  disconnect() {
    this.disconnected = true;
  }

  // What a ResizeObserver does once it is disconnected: nothing more.
  fire(blockSize?: number) {
    if (this.disconnected) return;
    const entries = blockSize === undefined ? [] : [{ borderBoxSize: [{ blockSize }] }];
    this.callback(entries as unknown as ResizeObserverEntry[], this as unknown as ResizeObserver);
  }
}

const original = {
  observer: globalThis.IntersectionObserver,
  resizeObserver: globalThis.ResizeObserver,
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
  FakeObserver.notifyOnObserve = null;
  FakeResizeObserver.live = [];
  boxes = {};
  document.documentElement.removeAttribute('data-reveal-ready');
  globalThis.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver;
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  Object.assign(window, { innerWidth: VIEWPORT.width, innerHeight: VIEWPORT.height });
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const box = boxes[this.getAttribute('data-testid') ?? ''];
    return (box ? rect(box) : rect({ top: 0, height: 0 })) as DOMRect;
  };
  setReducedMotion(false);
});

afterEach(() => {
  globalThis.IntersectionObserver = original.observer;
  globalThis.ResizeObserver = original.resizeObserver;
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

  it('reveals an element taller than two roots as soon as the observer says any of it is in', () => {
    boxes = { a: { top: 1400, height: 7000 } };
    const { getByTestId } = render(<Section id="a" />);
    const [observer] = FakeObserver.live;

    observer.report(true, { ratio: 0.05, height: 7000, rootHeight: 900, visibleHeight: 350 });
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');
    observer.report(false, { height: 7000, rootHeight: 900 });
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');
  });

  it('reads the root from the report, so it holds whichever axis an engine insets it by', () => {
    // The window says 1000x1000. The report says the root is 288px tall, as
    // Chromium resolves a 10% bottom inset at 568x320; 1742px is then taller
    // than two roots and shows with 50px of it in.
    boxes = { a: { top: 1400, height: 1742 } };
    const { getByTestId } = render(<Section id="a" />);
    const [observer] = FakeObserver.live;

    observer.report(true, { ratio: 50 / 1742, height: 1742, rootHeight: 288, visibleHeight: 50 });
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');
    // The same report against a root big enough to make it an ordinary
    // element is the ratio rule again.
    observer.report(true, { ratio: 50 / 1742, height: 1742, rootHeight: 1000, visibleHeight: 50 });
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');
  });

  it.each([
    { viewport: '568x320', rootHeight: 288 },
    { viewport: '667x375', rootHeight: 337.5 },
  ])('reveals the 1742px pricing section with a sliver in on a $viewport phone', ({ rootHeight }) => {
    boxes = { a: { top: 1400, height: 1742 } };
    const { getByTestId } = render(<Section id="a" />);
    const [observer] = FakeObserver.live;

    observer.report(true, { ratio: 0.02, height: 1742, rootHeight, visibleHeight: 35 });
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');
    // It stays revealed while any of it is on screen, not only above 15%.
    observer.report(true, { ratio: 0.14, height: 1742, rootHeight, visibleHeight: 240 });
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');
    observer.report(false, { height: 1742, rootHeight });
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');
  });

  it('draws the line at two roots for what the observer reports too', () => {
    boxes = { a: { top: 1400, height: 1800 } };
    const { getByTestId } = render(<Section id="a" />);
    const [observer] = FakeObserver.live;

    observer.report(true, { ratio: 0.05, height: 1800, rootHeight: 900, visibleHeight: 90 });
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');
    observer.report(true, { ratio: 0.05, height: 1801, rootHeight: 900, visibleHeight: 90 });
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');
    observer.report(true, { ratio: 0.15, height: 1800, rootHeight: 900, visibleHeight: 270 });
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');
  });

  describe('a block leaving through the top', () => {
    // The 432px card on the page at 1280x800, against a 720px root: 15% of it is
    // 64.8px. A block that is revealing lifts by the 16px `translateY` of the
    // hidden state, and the box the observer measures lifts with it. Left to the
    // ratio alone, the last 49 to 64px of it sat either side of 15% according to
    // which state it was in, and so flipped between them for as long as the page
    // stood still.
    const CARD = 432;
    const ROOT = 720;
    const LIFT = 16;
    const leaving = (remain: number, lifted = false) => {
      const visible = remain + (lifted ? LIFT : 0);
      return { height: CARD, rootHeight: ROOT, top: visible - CARD, ratio: visible / CARD, visibleHeight: visible };
    };

    it.each([49, 56, 57, 58, 64])('stays revealed with %ipx of it left, lifted or not, however often it is asked', (remain) => {
      boxes = { a: { top: 100, height: CARD } };
      const { getByTestId } = render(<Section id="a" />);
      const [observer] = FakeObserver.live;
      const revealed = () => getByTestId('a').getAttribute('data-revealed');
      expect(revealed()).toBe('true');

      const seen: (string | null)[] = [];
      for (const lifted of [false, true, false, false, true]) {
        observer.report(true, leaving(remain, lifted));
        seen.push(revealed());
      }
      expect(seen).toEqual(['true', 'true', 'true', 'true', 'true']);
    });

    it('stays revealed down to the last pixel of it, and hides once none of it is in', () => {
      boxes = { a: { top: 100, height: CARD } };
      const { getByTestId } = render(<Section id="a" />);
      const [observer] = FakeObserver.live;

      observer.report(true, leaving(1));
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');
      observer.report(false, { height: CARD, rootHeight: ROOT, top: -CARD });
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');
    });

    it.each([CARD, 60, 7000])('is not brought back by its own lift once it has left, at %ipx tall', (height) => {
      boxes = { a: { top: 100, height } };
      const { getByTestId } = render(<Section id="a" />);
      const [observer] = FakeObserver.live;

      observer.report(false, { height, rootHeight: ROOT, top: -height - 4 });
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');
      // Hidden, it sits 16px lower than the layout puts it, so 12px of it shows
      // at the root's edge. That is the lift, not the page scrolling back.
      const sliver = LIFT - 4;
      observer.report(true, { height, rootHeight: ROOT, top: sliver - height, ratio: sliver / height, visibleHeight: sliver });
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');
    });

    it.each([CARD, 7000])('arrives from the top once more than the lift is showing, at %ipx tall', (height) => {
      boxes = { a: { top: -height - 100, height } };
      const { getByTestId } = render(<Section id="a" />);
      const [observer] = FakeObserver.live;
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');

      observer.report(true, { height, rootHeight: ROOT, top: LIFT - height, ratio: LIFT / height, visibleHeight: LIFT });
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');
      observer.report(true, { height, rootHeight: ROOT, top: 100 - height, ratio: 100 / height, visibleHeight: 100 });
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');
      // Un-lifted, 84px of it is left: still on its way out, not a reason to hide.
      observer.report(true, { height, rootHeight: ROOT, top: 84 - height, ratio: 84 / height, visibleHeight: 84 });
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');
    });

    it('hides a block that has not arrived, below the root or short of the threshold from below', () => {
      boxes = { a: { top: 100, height: CARD } };
      const { getByTestId } = render(<Section id="a" />);
      const [observer] = FakeObserver.live;
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');

      // Scrolled back up until 50 of its 432px are above the root's bottom edge.
      observer.report(true, { height: CARD, rootHeight: ROOT, top: ROOT - 50, ratio: 50 / CARD, visibleHeight: 50 });
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');
      observer.report(true, { height: CARD, rootHeight: ROOT, top: ROOT - 50 + LIFT, ratio: 34 / CARD, visibleHeight: 34 });
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');
      observer.report(false, { height: CARD, rootHeight: ROOT, top: ROOT + 10 });
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');
    });
  });

  describe('when the window or the block is resized', () => {
    // Whether a block is "taller than two roots" moves with the window, and the
    // observer reports only a crossing of zero or 15% of it. A resize that
    // changes the answer without crossing either leaves the block in the state
    // it was decided in, until the page happens to be scrolled across one.
    // Observing the block again is what asks: an observer reports a target as
    // it stands the moment it starts observing it.
    const TALL = 1500;
    const asked = (rootHeight: number, top: number) => (observer: FakeObserver) =>
      observer.report(true, { height: TALL, rootHeight, top, ratio: 90 / TALL, visibleHeight: 90 });

    it('reveals a block the window has made taller than two roots', () => {
      boxes = { a: { top: 1400, height: TALL } };
      const { getByTestId } = render(<Section id="a" />);
      const [observer] = FakeObserver.live;
      // 90px of it in a 900px root: 6%, and 1500 is not more than 1800.
      observer.report(true, { height: TALL, rootHeight: 900, top: 810, ratio: 90 / TALL, visibleHeight: 90 });
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');

      // The window is shorter: a 540px root, and 1500 is more than 1080.
      FakeObserver.notifyOnObserve = asked(540, 450);
      window.dispatchEvent(new Event('resize'));
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');
    });

    it('hides a block the window has made short of two roots, which the other way round would have left showing', () => {
      boxes = { a: { top: 1400, height: TALL } };
      const { getByTestId } = render(<Section id="a" />);
      const [observer] = FakeObserver.live;
      observer.report(true, { height: TALL, rootHeight: 540, top: 450, ratio: 90 / TALL, visibleHeight: 90 });
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');

      FakeObserver.notifyOnObserve = asked(900, 810);
      window.dispatchEvent(new Event('resize'));
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');
    });

    it('asks again when the block itself changes size, with nothing else about the window changed', () => {
      boxes = { a: { top: 1400, height: TALL } };
      const { getByTestId } = render(<Section id="a" />);
      const [observer] = FakeObserver.live;
      observer.report(true, { height: TALL, rootHeight: 900, top: 810, ratio: 90 / TALL, visibleHeight: 90 });
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('false');

      const [sizes] = FakeResizeObserver.live;
      expect(sizes.observed).toEqual([getByTestId('a')]);
      FakeObserver.notifyOnObserve = (again) =>
        again.report(true, { height: 1900, rootHeight: 900, top: 810, ratio: 90 / 1900, visibleHeight: 90 });
      sizes.fire(1900);
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');
    });

    it('leaves it alone when the block reports the size it already had', () => {
      boxes = { a: { top: 1400, height: TALL } };
      render(<Section id="a" />);
      const [observer] = FakeObserver.live;
      const [sizes] = FakeResizeObserver.live;

      sizes.fire(TALL);
      sizes.fire(TALL);
      expect(observer.observeCalls).toBe(1);
      sizes.fire(TALL + 100);
      sizes.fire(TALL + 100);
      expect(observer.observeCalls).toBe(2);
    });

    it('asks the one observer again, rather than starting another or watching twice', () => {
      boxes = { a: { top: 1400, height: TALL } };
      const { getByTestId } = render(<Section id="a" />);
      const [observer] = FakeObserver.live;
      expect(observer.observeCalls).toBe(1);

      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('resize'));
      expect(FakeObserver.live).toHaveLength(1);
      expect(observer.observeCalls).toBe(3);
      expect(observer.observed).toEqual([getByTestId('a')]);
    });

    it('stops asking once the block is gone', () => {
      boxes = { a: { top: 1400, height: TALL } };
      const view = render(<Section id="a" />);
      const [observer] = FakeObserver.live;
      const [sizes] = FakeResizeObserver.live;

      view.unmount();
      expect(sizes.disconnected).toBe(true);
      window.dispatchEvent(new Event('resize'));
      expect(observer.observeCalls).toBe(1);
    });

    it('still asks on a window resize where there is no ResizeObserver', () => {
      // @ts-expect-error the absence under test
      delete globalThis.ResizeObserver;
      boxes = { a: { top: 1400, height: TALL } };
      const { getByTestId } = render(<Section id="a" />);
      const [observer] = FakeObserver.live;
      observer.report(true, { height: TALL, rootHeight: 900, top: 810, ratio: 90 / TALL, visibleHeight: 90 });

      FakeObserver.notifyOnObserve = asked(540, 450);
      window.dispatchEvent(new Event('resize'));
      expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');
    });
  });

  it('falls back to the smaller of the roots an engine might use when the report carries no root bounds', () => {
    // 1300x320: 288 by height, 190 by width. 400px is more than two of the
    // smaller and less than two of the larger, so it is reveal-on-any-sliver
    // only if the smaller is what was used.
    Object.assign(window, { innerWidth: 1300, innerHeight: 320 });
    boxes = { a: { top: 1400, height: 400 } };
    const { getByTestId } = render(<Section id="a" />);
    const [observer] = FakeObserver.live;

    observer.report(true, { ratio: 0.05, height: 400, rootBounds: null, visibleHeight: 20 });
    expect(getByTestId('a').getAttribute('data-revealed')).toBe('true');
    // Not a sliver of something that cannot be tall under either root.
    boxes = { b: { top: 1400, height: 300 } };
    const other = render(<Section id="b" />);
    FakeObserver.live[1].report(true, { ratio: 0.05, height: 300, rootBounds: null, visibleHeight: 15 });
    expect(other.getByTestId('b').getAttribute('data-revealed')).toBe('false');
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
