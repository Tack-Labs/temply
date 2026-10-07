import { afterEach, describe, expect, it, mock } from 'bun:test';
import '../core/editor/test/dom';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ContentModeSwitch, type ContentMode } from './content-mode-switch';

afterEach(cleanup);

const group = (view: ReturnType<typeof render>) => view.getByRole('group', { name: 'Content view' });
const pressed = (view: ReturnType<typeof render>) =>
  [...group(view).querySelectorAll('button')]
    .filter((button) => button.getAttribute('aria-pressed') === 'true')
    .map((button) => button.textContent);

describe('ContentModeSwitch', () => {
  it('is a group named "Content view" of four segments named by their text', () => {
    const view = render(<ContentModeSwitch mode="edit" onModeChange={() => {}} />);
    expect([...group(view).querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      'Edit',
      'Preview',
      'HTML',
      'Text',
    ]);
    // Names come from the visible text: the old icon-only segments carried an
    // aria-label, and a label that differs from the text is a mismatch for
    // anyone who navigates by what they can see.
    for (const name of ['Edit', 'Preview', 'HTML', 'Text']) {
      const button = view.getByRole('button', { name, exact: true });
      expect(button.hasAttribute('aria-label')).toBe(false);
    }
  });

  it('presses only the segment of the current mode', () => {
    for (const [mode, label] of [
      ['edit', 'Edit'],
      ['preview', 'Preview'],
      ['html', 'HTML'],
      ['text', 'Text'],
    ] as const) {
      const view = render(<ContentModeSwitch mode={mode} onModeChange={() => {}} />);
      expect(pressed(view)).toEqual([label]);
      cleanup();
    }
  });

  it('asks for the mode that was chosen', () => {
    const onModeChange = mock((_mode: ContentMode) => {});
    const view = render(<ContentModeSwitch mode="edit" onModeChange={onModeChange} />);
    fireEvent.click(view.getByRole('button', { name: 'HTML', exact: true }));
    fireEvent.click(view.getByRole('button', { name: 'Preview', exact: true }));
    expect(onModeChange.mock.calls.map((call) => call[0])).toEqual(['html', 'preview']);
  });

  it('is reached and worked from the keyboard: native buttons, every one in the tab order', () => {
    const view = render(<ContentModeSwitch mode="edit" onModeChange={() => {}} />);
    for (const button of group(view).querySelectorAll('button')) {
      // A native button answers Enter and Space with a click, which is what
      // makes it a control for a keyboard; a div with a handler would not.
      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('type')).toBe('button');
      expect(button.getAttribute('tabindex')).toBeNull();
      expect(button.hasAttribute('disabled')).toBe(false);
    }
  });

  it('keeps the segment readable while its view is on the way, and says which one is busy', () => {
    const view = render(<ContentModeSwitch mode="edit" pending="preview" onModeChange={() => {}} />);
    const preview = view.getByRole('button', { name: 'Preview', exact: true });
    expect(preview.querySelector('svg.animate-spin')).not.toBeNull();
    // A spinner is motion the reduced-motion setting asks the page to stop.
    expect(preview.querySelector('svg')?.classList.contains('motion-reduce:animate-none')).toBe(true);
    expect(preview.getAttribute('aria-busy')).toBe('true');
    expect(view.getByRole('button', { name: 'Edit', exact: true }).querySelector('svg')).toBeNull();
  });

  it('shows the controls of the current view beside the switch, and hides them from readers when there are none', () => {
    const none = render(<ContentModeSwitch mode="edit" onModeChange={() => {}} />);
    expect(none.container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    cleanup();

    const some = render(
      <ContentModeSwitch mode="html" onModeChange={() => {}} viewControls={<button type="button">Copy HTML</button>} />,
    );
    const copy = some.getByRole('button', { name: 'Copy HTML' });
    expect(copy.closest('[aria-hidden="true"]')).toBeNull();
    // The switch itself is a later sibling, so it never moves when they appear.
    expect(copy.compareDocumentPosition(group(some)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // The controls of the view being left stay mounted while they fade, so a
  // hidden button is still in the DOM: aria-hidden alone would leave it in the
  // tab order, a focusable control that a screen reader is told is not there.
  it('takes the held controls out of the tab order as well as the tree once their view is gone', () => {
    const copy = <button type="button">Copy HTML</button>;
    const view = render(<ContentModeSwitch mode="html" onModeChange={() => {}} viewControls={copy} />);
    expect(view.getByRole('button', { name: 'Copy HTML' }).closest('[inert]')).toBeNull();

    view.rerender(<ContentModeSwitch mode="edit" onModeChange={() => {}} />);
    const held = view.container.querySelector('[aria-hidden="true"]');
    expect(held?.textContent).toBe('Copy HTML');
    expect(held?.hasAttribute('inert')).toBe(true);

    view.rerender(<ContentModeSwitch mode="html" onModeChange={() => {}} viewControls={copy} />);
    expect(view.container.querySelector('[inert]')).toBeNull();
  });
});
