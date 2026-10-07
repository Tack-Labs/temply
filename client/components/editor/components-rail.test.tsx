import { afterEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { useState } from 'react';
import type { Editor } from '@tiptap/core';
import { makeEditor } from '../../core/editor/test/make-editor';
import { componentsDisabledReason, ComponentsRail } from './components-rail';

const editors: Editor[] = [];
afterEach(() => {
  cleanup();
  while (editors.length) editors.pop()?.destroy();
});

function editorWith(text = 'Hello') {
  const editor = makeEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
  editors.push(editor);
  // A caret inside the paragraph, as a customer who has clicked into the email.
  editor.commands.setTextSelection(2);
  return editor;
}

/** The parent's half of the contract: it owns whether the rail is collapsed. */
function Harness({
  editor = null,
  disabledReason,
  startCollapsed = false,
  onToggle,
}: {
  editor?: Editor | null;
  disabledReason?: string | null;
  startCollapsed?: boolean;
  onToggle?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(startCollapsed);
  const [animate, setAnimate] = useState(false);
  return (
    <ComponentsRail
      editor={editor}
      disabledReason={disabledReason}
      collapsed={collapsed}
      animate={animate}
      onToggle={() => {
        onToggle?.();
        setAnimate(true);
        setCollapsed((current) => !current);
      }}
    />
  );
}

/** One frame, for the `requestAnimationFrame` an insert asks to reveal the block in. */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** The landmark's two faces, the panel then the strip; the rest inside them is not one. */
const faces = (view: ReturnType<typeof render>) =>
  [...view.getByRole('complementary', { name: 'Components' }).children] as HTMLElement[];

const CONTENT = ['Text', 'Heading', 'Subheading', 'Image', 'Logo', 'Button'];
const LAYOUT = ['Columns', 'Divider', 'Spacer', 'Section', 'Repeating list'];

describe('ComponentsRail, open', () => {
  it('is the Components landmark, with a collapse button that says it is expanded', () => {
    const view = render(<Harness />);
    const rail = view.getByRole('complementary', { name: 'Components' });
    expect(within(rail).getByRole('heading', { level: 2, name: 'Components' })).toBeTruthy();
    const collapse = within(rail).getByRole('button', { name: 'Collapse components panel' });
    expect(collapse.getAttribute('aria-expanded')).toBe('true');
  });

  it('groups the eleven blocks under Content and Layout', () => {
    const view = render(<Harness />);
    const names = (group: string) =>
      within(view.getByRole('group', { name: group }))
        .getAllByRole('button')
        .map((button) => button.textContent);
    expect(names('Content')).toEqual(CONTENT);
    expect(names('Layout')).toEqual(LAYOUT);
  });

  it('claims only what a click does, and keeps the tip about @', () => {
    const view = render(<Harness />);
    expect(view.getByText('Click a component to add it below the selected block.')).toBeTruthy();
    expect(view.queryByText(/drag/i)).toBeNull();
    expect(view.getByText('Make it personal')).toBeTruthy();
    expect(view.getByText('@')).toBeTruthy();
  });

  it('adds the block below the one the caret is in', async () => {
    const editor = editorWith();
    const view = render(<Harness editor={editor} />);
    fireEvent.click(view.getByRole('button', { name: 'Divider' }));
    const types = editor.getJSON().content?.map((node) => node.type);
    expect(types?.[0]).toBe('paragraph');
    // The divider block is a horizontalRule node.
    expect(types).toContain('horizontalRule');
    expect(types?.indexOf('horizontalRule')).toBeGreaterThan(0);
    await nextFrame();
  });

  it('turns every chip off, and says why, when the reason is given', () => {
    const view = render(<Harness editor={editorWith()} disabledReason="Switch to Edit to add components." />);
    const reason = view.getByText('Switch to Edit to add components.');
    const chips = [...CONTENT, ...LAYOUT].map((name) => view.getByRole('button', { name }) as HTMLButtonElement);
    for (const chip of chips) {
      expect(chip.disabled).toBe(true);
      expect(chip.getAttribute('aria-describedby')).toBe(reason.id);
    }
    // The usage line gives way to the reason rather than sitting beside it:
    // it stays in the DOM to shrink away, out of the tab order and the tree.
    const usage = view.getByText('Click a component to add it below the selected block.');
    expect(usage.closest('[inert]')?.getAttribute('aria-hidden')).toBe('true');
    expect(reason.closest('[inert]')).toBeNull();
  });

  it('is off while there is no editor to add to, with nothing to explain', () => {
    const view = render(<Harness editor={null} />);
    for (const name of [...CONTENT, ...LAYOUT]) {
      expect((view.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(view.getByText('Click a component to add it below the selected block.').closest('[inert]')).toBeNull();
    for (const chip of view.getAllByRole('button')) expect(chip.getAttribute('aria-describedby')).toBeNull();
  });

  it('does not insert from a disabled chip', () => {
    const editor = editorWith();
    const before = JSON.stringify(editor.getJSON());
    const view = render(<Harness editor={editor} disabledReason="Read only." />);
    fireEvent.click(view.getByRole('button', { name: 'Divider' }));
    expect(JSON.stringify(editor.getJSON())).toBe(before);
  });
});

describe('ComponentsRail, collapsed', () => {
  it('hides the panel from the tree and shows the strip, whose button says it is collapsed', () => {
    const view = render(<Harness startCollapsed />);
    const rail = view.getByRole('complementary', { name: 'Components' });
    const expand = within(rail).getByRole('button', { name: 'Expand components panel' });
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    expect(within(rail).queryByRole('button', { name: 'Collapse components panel' })).toBeNull();
    expect(within(rail).queryByRole('heading', { name: 'Components' })).toBeNull();

    const [panel, stripFace] = faces(view);
    expect(panel.getAttribute('aria-hidden')).toBe('true');
    expect(panel.hasAttribute('inert')).toBe(true);
    expect(panel.textContent).toContain('Components');
    expect(stripFace.getAttribute('aria-hidden')).toBe('false');
    expect(stripFace.hasAttribute('inert')).toBe(false);
  });

  it('keeps the strip inert, and hidden from the tree, while the panel is open', () => {
    const view = render(<Harness />);
    const [panel, strip] = faces(view);
    expect(strip.getAttribute('aria-hidden')).toBe('true');
    expect(strip.hasAttribute('inert')).toBe(true);
    expect(strip.querySelector('[aria-label="Expand components panel"]')).toBeTruthy();
    expect(panel.getAttribute('aria-hidden')).toBe('false');
    expect(panel.hasAttribute('inert')).toBe(false);
  });

  it('names every chip for what it adds, since there is no text', () => {
    const view = render(<Harness startCollapsed />);
    const names = view.getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    expect(names).toEqual([
      'Expand components panel',
      'Add text',
      'Add heading',
      'Add subheading',
      'Add image',
      'Add logo',
      'Add button',
      'Add columns',
      'Add divider',
      'Add spacer',
      'Add section',
      'Add repeating list',
    ]);
    expect(view.getAllByRole('button').every((button) => !button.textContent)).toBe(true);
  });

  it('adds a block from a chip just as the panel does', async () => {
    const editor = editorWith();
    const view = render(<Harness editor={editor} startCollapsed />);
    fireEvent.click(view.getByRole('button', { name: 'Add divider' }));
    const types = editor.getJSON().content?.map((node) => node.type);
    expect(types?.[0]).toBe('paragraph');
    expect(types).toContain('horizontalRule');
    await nextFrame();
  });

  it('turns the chips off with the same reason', () => {
    const view = render(<Harness editor={editorWith()} startCollapsed disabledReason="Read only." />);
    const add = view.getAllByRole('button').filter((button) => button.getAttribute('aria-label')?.startsWith('Add '));
    expect(add.length).toBe(11);
    expect(add.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });
});

describe('componentsDisabledReason', () => {
  it('says the workspace is read-only, and that outranks the mode', () => {
    const reason = 'This workspace is read-only, so components cannot be added.';
    expect(componentsDisabledReason({ readOnly: true, mode: 'edit' })).toBe(reason);
    expect(componentsDisabledReason({ readOnly: true, mode: 'preview' })).toBe(reason);
  });

  it('asks for Edit when the email is being looked at another way', () => {
    for (const mode of ['preview', 'html', 'text'] as const) {
      expect(componentsDisabledReason({ readOnly: false, mode })).toBe('Switch back to Edit to add components.');
    }
  });

  it('has no reason when the chips are live', () => {
    expect(componentsDisabledReason({ readOnly: false, mode: 'edit' })).toBeNull();
  });
});

describe('ComponentsRail, in a read-only workspace', () => {
  const reason = componentsDisabledReason({ readOnly: true, mode: 'edit' });

  it('shows the reason and turns the open chips off, tied to it', () => {
    const view = render(<Harness editor={editorWith()} disabledReason={reason} />);
    const shown = view.getByText('This workspace is read-only, so components cannot be added.');
    expect(shown.closest('[inert]')).toBeNull();
    for (const name of [...CONTENT, ...LAYOUT]) {
      const chip = view.getByRole('button', { name }) as HTMLButtonElement;
      expect(chip.disabled).toBe(true);
      expect(chip.getAttribute('aria-describedby')).toBe(shown.id);
    }
  });

  it('keeps the strip chips off, and tied to a reason that is reachable from the folded strip', () => {
    const view = render(<Harness editor={editorWith()} startCollapsed disabledReason={reason} />);
    const [panel, stripFace] = faces(view);
    const add = within(stripFace).getAllByRole('button').filter((button) => button.getAttribute('aria-label')?.startsWith('Add ')) as HTMLButtonElement[];
    expect(add).toHaveLength(11);
    // The panel's own copy of the reason is inert while folded, and a
    // description cannot be read out of a subtree assistive tech skips. So the
    // strip carries the sentence itself, for screen readers only.
    expect(panel.hasAttribute('inert')).toBe(true);
    const target = document.getElementById(add[0].getAttribute('aria-describedby') as string) as HTMLElement;
    expect(target).toBeTruthy();
    expect(stripFace.contains(target)).toBe(true);
    expect(target.textContent).toBe(reason);
    expect(target.className).toContain('sr-only');
    expect(target.closest('[inert]')).toBeNull();
    expect(panel.contains(target)).toBe(false);
    for (const chip of add) {
      expect(chip.disabled).toBe(true);
      expect(chip.getAttribute('aria-describedby')).toBe(target.id);
      // The name stays the action; the reason is the hover tooltip.
      expect(chip.title).toContain(reason as string);
      expect(chip.title.startsWith(chip.getAttribute('aria-label') as string)).toBe(true);
      // Left to the pointer, so the tooltip can show: pointer-events-none would suppress it.
      expect(chip.className).not.toContain('pointer-events-none');
    }
  });

  it('does not add from a folded chip that is off', () => {
    const editor = editorWith();
    const before = JSON.stringify(editor.getJSON());
    const view = render(<Harness editor={editor} startCollapsed disabledReason={reason} />);
    fireEvent.click(view.getByRole('button', { name: 'Add divider' }));
    expect(JSON.stringify(editor.getJSON())).toBe(before);
  });

  it('puts the reason in the strip only while folded, so the open panel is the one place it is printed', () => {
    const open = render(<Harness editor={editorWith()} disabledReason={reason} />);
    expect(open.getAllByText(reason as string)).toHaveLength(1);
    expect(open.getByText(reason as string).closest('[inert]')).toBeNull();
    cleanup();
    const folded = render(<Harness editor={editorWith()} startCollapsed disabledReason={reason} />);
    expect(folded.getAllByText(reason as string)).toHaveLength(2);
  });

  it('leaves the folded chips with their plain name as a tooltip, and nothing to describe them, when they are live', () => {
    const view = render(<Harness editor={editorWith()} startCollapsed />);
    const divider = view.getByRole('button', { name: 'Add divider' }) as HTMLButtonElement;
    expect(divider.disabled).toBe(false);
    expect(divider.title).toBe('Add divider');
    expect(divider.getAttribute('aria-describedby')).toBeNull();
    expect(faces(view)[1].querySelector('.sr-only')).toBeNull();
  });
});

describe('ComponentsRail, toggling', () => {
  it('asks its parent to toggle from either control', () => {
    const toggled = mock(() => {});
    const view = render(<Harness onToggle={toggled} />);
    fireEvent.click(view.getByRole('button', { name: 'Collapse components panel' }));
    expect(toggled).toHaveBeenCalledTimes(1);
    fireEvent.click(view.getByRole('button', { name: 'Expand components panel' }));
    expect(toggled).toHaveBeenCalledTimes(2);
  });

  it('moves focus to the equivalent control, not the page, after each toggle', () => {
    const view = render(<Harness />);
    const rail = view.getByRole('complementary', { name: 'Components' });
    const collapse = within(rail).getByRole('button', { name: 'Collapse components panel' });
    collapse.focus();
    act(() => collapse.click());
    expect(document.activeElement).toBe(within(rail).getByRole('button', { name: 'Expand components panel' }));

    act(() => (document.activeElement as HTMLElement).click());
    expect(document.activeElement).toBe(within(rail).getByRole('button', { name: 'Collapse components panel' }));
  });

  it('does not take focus when it merely renders collapsed', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    render(<Harness startCollapsed />);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('transitions only once the reader has toggled', () => {
    const view = render(<Harness startCollapsed />);
    expect(faces(view).some((face) => face.className.includes('transition-opacity'))).toBe(false);
    fireEvent.click(view.getByRole('button', { name: 'Expand components panel' }));
    expect(faces(view).every((face) => face.className.includes('transition-opacity'))).toBe(true);
    expect(faces(view).every((face) => face.className.includes('motion-reduce:transition-none'))).toBe(true);
  });
});
