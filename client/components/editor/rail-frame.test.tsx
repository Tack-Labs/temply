import { afterEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { RailFrame } from './rail-frame';

afterEach(cleanup);

function Rail({ collapsed = false }: { collapsed?: boolean }) {
  return <RailFrame label="Test rail" side="left" collapsed={collapsed} animate={false} onToggle={() => {}} open={<p>open</p>} strip={<p>strip</p>} />;
}

const landmark = (view: ReturnType<typeof render>) => view.getByRole('complementary', { name: 'Test rail', hidden: true });

describe('RailFrame, the card it is from lg', () => {
  it('clips its faces to a rounded card that can be shorter than what the panel holds', () => {
    const view = render(<Rail />);
    const classes = landmark(view).className;
    expect(classes).toContain('lg:overflow-clip');
    expect(classes).toContain('lg:rounded-card');
    // Without a floor of zero the card grows to its content and the panel's
    // own scroller never has anything to scroll.
    expect(classes).toContain('lg:min-h-0');
  });
});

describe('RailFrame, the face that is not shown', () => {
  const panel = (view: ReturnType<typeof render>) => landmark(view).children[0] as HTMLElement;

  it('is clipped to the rail while it is hidden, so it adds nothing to the card\'s height', () => {
    const view = render(<Rail collapsed />);
    expect(panel(view).className).toContain('lg:absolute');
    expect(panel(view).className).toContain('lg:overflow-clip');
  });

  it('is not clipped while it is the one in view: the focus ring at its edge is drawn outside the box', () => {
    const view = render(<Rail />);
    expect(panel(view).className).not.toContain('overflow-clip');
    expect(panel(view).className).not.toContain('lg:absolute');
  });

  it('can shrink to the card while it is the one in view, so what it holds scrolls inside it', () => {
    const view = render(<Rail />);
    expect(panel(view).className).toContain('lg:min-h-0');
  });
});
