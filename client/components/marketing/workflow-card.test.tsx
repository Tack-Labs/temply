import { afterEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { WorkflowCard, type WorkflowTone } from './workflow-card';

afterEach(cleanup);

// The item is the grid cell; the card, which carries the wash and the reveal,
// is the one box inside it.
const card = (item: HTMLElement) => item.firstElementChild as HTMLElement;

const mount = (tone: WorkflowTone = 'lavender') =>
  render(
    <ol>
      <WorkflowCard
        stage="Build"
        tone={tone}
        title="Build emails with blocks"
        description="Add your logo, headings, text, and buttons."
        visual={<div data-testid="visual" />}
      />
    </ol>,
  );

describe('a workflow card', () => {
  it('is one step of the list, named by its title, with the stage as a pill above it', () => {
    const view = mount();
    const item = view.getByRole('listitem');
    expect(view.getByRole('heading', { level: 3, name: 'Build emails with blocks' })).toBeTruthy();
    expect(view.getByText('Add your logo, headings, text, and buttons.')).toBeTruthy();
    const stage = view.getByText('Build');
    expect(item.contains(stage)).toBe(true);
    // The pill is the raised surface (white in light), so it stands off every wash.
    expect(stage.className.split(/\s+/)).toContain('bg-raised');
  });

  it('is a panel-radius card painted from its tone', () => {
    const washes: Record<WorkflowTone, string> = {
      lavender: 'bg-accent-wash',
      mint: 'bg-success-wash',
      peach: 'bg-peach-wash',
      sky: 'bg-sky-wash',
    };
    for (const tone of Object.keys(washes) as WorkflowTone[]) {
      const view = mount(tone);
      const classes = card(view.getByRole('listitem')).className.split(/\s+/);
      expect(classes).toContain('rounded-panel');
      expect(classes).toContain(washes[tone]);
      cleanup();
    }
  });

  it('stages its two halves for the scroll reveal, and keeps the visual in its own half', () => {
    const view = mount();
    const item = card(view.getByRole('listitem'));
    expect(item.hasAttribute('data-reveal')).toBe(true);
    const copy = item.querySelector('.reveal-copy') as HTMLElement;
    const visual = item.querySelector('.reveal-visual') as HTMLElement;
    expect(copy.contains(view.getByRole('heading', { level: 3 }))).toBe(true);
    expect(visual.contains(view.getByTestId('visual'))).toBe(true);
  });

  it('sets its words in ink on the wash, never in the tone ink', () => {
    const view = mount('sky');
    // Ink and ink-soft are the pairs the contrast gate holds on every wash.
    expect(view.getByRole('heading', { level: 3 }).className.split(/\s+/)).toContain('text-ink');
    expect(view.getByText('Add your logo, headings, text, and buttons.').className.split(/\s+/)).toContain('text-ink-soft');
  });
});
