import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { RailFrame } from './rail-frame';

// happy-dom lays nothing out, so the scroller's height is stood in for and the
// observer is a fake whose callback the test fires by hand.
let observers: { callback: () => void; target: Element | null; disconnected: boolean }[] = [];
const RealObserver = globalThis.ResizeObserver;

class FakeResizeObserver {
  record: (typeof observers)[number];
  constructor(callback: () => void) {
    this.record = { callback, target: null, disconnected: false };
    observers.push(this.record);
  }
  observe(target: Element) {
    this.record.target = target;
  }
  unobserve() {}
  disconnect() {
    this.record.disconnected = true;
  }
}

// A child's layout effect runs before its parent's ref is attached, so the
// height cannot be set from a ref: it is read off the prototype instead.
let scrollerHeight = 0;

beforeEach(() => {
  observers = [];
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.testid === 'scroller' ? scrollerHeight : 0;
    },
  });
});

afterEach(() => {
  cleanup();
  globalThis.ResizeObserver = RealObserver;
  delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
});

function Rail({ collapsed = false, port = 590, scrolls = true }: { collapsed?: boolean; port?: number; scrolls?: boolean }) {
  scrollerHeight = port;
  return (
    <div data-testid="scroller" style={{ overflowY: scrolls ? 'auto' : 'visible' }}>
      <RailFrame label="Test rail" side="left" collapsed={collapsed} animate={false} onToggle={() => {}} open={<p>open</p>} strip={<p>strip</p>} />
    </div>
  );
}

const landmark = (view: ReturnType<typeof render>) => view.getByRole('complementary', { name: 'Test rail', hidden: true });

describe('RailFrame, the scroller it sits in', () => {
  it('publishes the scroller\'s height on the landmark, for a cap to read', () => {
    const view = render(<Rail port={590} />);
    expect(landmark(view).style.getPropertyValue('--rail-port')).toBe('590px');
  });

  it('follows the scroller when it is resized', () => {
    const view = render(<Rail port={590} />);
    expect(observers).toHaveLength(1);
    expect(observers[0].target).toBe(view.getByTestId('scroller'));
    scrollerHeight = 770;
    observers[0].callback();
    expect(landmark(view).style.getPropertyValue('--rail-port')).toBe('770px');
  });

  it('leaves the cap unset while the scroller has no height, rather than capping the rail to nothing', () => {
    const view = render(<Rail port={0} />);
    expect(landmark(view).style.getPropertyValue('--rail-port')).toBe('');
  });

  it('leaves the cap unset when nothing above it scrolls', () => {
    const view = render(<Rail scrolls={false} />);
    expect(landmark(view).style.getPropertyValue('--rail-port')).toBe('');
    expect(observers).toHaveLength(0);
  });

  it('stops watching, and takes the property back, when it goes', () => {
    const view = render(<Rail />);
    const element = landmark(view);
    view.unmount();
    expect(observers[0].disconnected).toBe(true);
    expect(element.style.getPropertyValue('--rail-port')).toBe('');
  });
});

describe('RailFrame, the face that is not shown', () => {
  const panel = (view: ReturnType<typeof render>) => landmark(view).children[0] as HTMLElement;

  it('is clipped to the rail while it is hidden, so it adds nothing to what the page scrolls', () => {
    const view = render(<Rail collapsed />);
    expect(panel(view).className).toContain('lg:absolute');
    expect(panel(view).className).toContain('lg:overflow-clip');
  });

  it('is not clipped while it is the one in view: the focus ring at its edge is drawn outside the box', () => {
    const view = render(<Rail />);
    expect(panel(view).className).not.toContain('overflow-clip');
    expect(panel(view).className).not.toContain('lg:absolute');
  });
});
