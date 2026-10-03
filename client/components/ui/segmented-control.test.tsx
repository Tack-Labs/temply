import { afterEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, fireEvent, render } from '@testing-library/react';
import * as React from 'react';
import { SegmentedControl, type SegmentedOption } from './segmented-control';

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

type Filter = 'all' | 'drafts' | 'published';
const options: SegmentedOption<Filter>[] = [
  { value: 'all', label: 'All', count: 12 },
  { value: 'drafts', label: 'Drafts', count: 3 },
  { value: 'published', label: 'Published', count: 9 },
];

const setup = (value: Filter = 'all', list: SegmentedOption<Filter>[] = options) => {
  const onValueChange = mock((_next: Filter) => {});
  const view = render(<SegmentedControl label="Show templates" value={value} onValueChange={onValueChange} options={list} />);
  return { view, onValueChange };
};

/** Mounts the control with real state, so a choice made by key moves the checked option. */
function Controlled({ start = 'all' as Filter, list = options }: { start?: Filter; list?: SegmentedOption<Filter>[] }) {
  const [value, setValue] = React.useState<Filter>(start);
  return <SegmentedControl label="Show templates" value={value} onValueChange={setValue} options={list} />;
}

const radio = (view: ReturnType<typeof render>, name: RegExp | string) => view.getByRole('radio', { name });
const checked = (view: ReturnType<typeof render>) =>
  view.getAllByRole('radio').filter((node) => node.getAttribute('aria-checked') === 'true');

describe('SegmentedControl', () => {
  it('is one labelled radiogroup, and exactly the chosen option is checked', () => {
    const { view } = setup('drafts');
    expect(view.getByRole('radiogroup', { name: 'Show templates' })).toBeTruthy();
    expect(radio(view, /^All/).getAttribute('aria-checked')).toBe('false');
    expect(radio(view, /^Drafts/).getAttribute('aria-checked')).toBe('true');
    expect(radio(view, /^Published/).getAttribute('aria-checked')).toBe('false');
    expect(view.queryAllByRole('button')).toEqual([]);
  });

  it('reads a count after its label, not run into it', () => {
    const { view } = setup();
    // The separator is a visually hidden span, so how much space a name
    // computation puts around it varies; the comma between them does not.
    expect(radio(view, /^Drafts\s*,\s*3$/)).toBeTruthy();
    expect(radio(view, /^All\s*,\s*12$/)).toBeTruthy();
    expect(view.queryByRole('radio', { name: 'Drafts3' })).toBeNull();
  });

  it('names an option with no count by its label alone', () => {
    const { view } = setup('all', [{ value: 'all', label: 'Plain' }]);
    expect(radio(view, 'Plain')).toBeTruthy();
  });

  it('reports the option that was clicked, and nothing else', () => {
    const { view, onValueChange } = setup();
    radio(view, /^Published/).click();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe('published');
  });

  it('draws the chosen option as a raised pill on the sunken track, in tokens', () => {
    const { view } = setup('all');
    expect(view.getByRole('radiogroup').className).toContain('bg-sunken');
    const chosen = radio(view, /^All/).className;
    expect(chosen).toContain('bg-raised');
    expect(chosen).toContain('text-ink');
    expect(chosen).toContain('shadow-xs');
    const other = radio(view, /^Drafts/).className;
    expect(other).toContain('text-muted');
    expect(other).not.toContain('bg-raised');
  });

  it('shows a count in tabular figures, and none when an option has none', () => {
    const { view } = setup('all', [...options.slice(0, 2), { value: 'published', label: 'Plain' }]);
    const count = view.getByText('12');
    expect(count.className).toContain('tabular-nums');
    expect(radio(view, 'Plain').querySelectorAll('.tabular-nums').length).toBe(0);
  });

  it('meets 44px on a coarse pointer and settles on colour alone', () => {
    const { view } = setup();
    const classes = radio(view, /^All/).className;
    expect(classes).toContain('pointer-coarse:h-11');
    expect(classes).toContain('duration-fast');
    expect(classes).toContain('motion-reduce:transition-none');
    expect(classes).toContain('focus-visible:outline-accent-ink');
    expect(classes).not.toContain('transition-all');
    expect(classes).not.toContain('transform');
  });

  it('is a single tab stop, on the chosen option', () => {
    const { view } = setup('drafts');
    const stops = view.getAllByRole('radio').filter((node) => node.tabIndex === 0);
    expect(stops.map((node) => node.textContent)).toEqual(['Drafts, 3']);
  });

  it('falls back to the first enabled option as the tab stop when nothing matches', () => {
    const { view } = setup('missing' as Filter, [{ ...options[0]!, disabled: true }, options[1]!, options[2]!]);
    const stops = view.getAllByRole('radio').filter((node) => node.tabIndex === 0);
    expect(stops.map((node) => node.textContent)).toEqual(['Drafts, 3']);
    expect(checked(view)).toEqual([]);
  });

  it('chooses as it moves: an arrow moves focus and checks the option, wrapping at both ends', () => {
    const view = render(<Controlled />);
    const all = radio(view, /^All/);
    const drafts = radio(view, /^Drafts/);
    const published = radio(view, /^Published/);
    all.focus();
    fireEvent.keyDown(all, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(drafts);
    expect(checked(view)).toEqual([drafts]);
    fireEvent.keyDown(drafts, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(published);
    expect(checked(view)).toEqual([published]);
    fireEvent.keyDown(published, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(all);
    expect(checked(view)).toEqual([all]);
    fireEvent.keyDown(all, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(published);
    expect(checked(view)).toEqual([published]);
    fireEvent.keyDown(published, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(drafts);
    expect(checked(view)).toEqual([drafts]);
  });

  it('Home and End jump to the ends and choose there', () => {
    const view = render(<Controlled start="drafts" />);
    const drafts = radio(view, /^Drafts/);
    drafts.focus();
    fireEvent.keyDown(drafts, { key: 'End' });
    expect(document.activeElement).toBe(radio(view, /^Published/));
    expect(checked(view)).toEqual([radio(view, /^Published/)]);
    fireEvent.keyDown(radio(view, /^Published/), { key: 'Home' });
    expect(document.activeElement).toBe(radio(view, /^All/));
    expect(checked(view)).toEqual([radio(view, /^All/)]);
  });

  it('reports each arrow-key choice once, with the value it lands on', () => {
    const { view, onValueChange } = setup('all');
    const all = radio(view, /^All/);
    all.focus();
    fireEvent.keyDown(all, { key: 'ArrowRight' });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe('drafts');
  });

  it('steps over a disabled option and leaves the browser its own modifier shortcuts', () => {
    const view = render(<Controlled list={[options[0]!, { ...options[1]!, disabled: true }, options[2]!]} />);
    const all = radio(view, /^All/);
    all.focus();
    fireEvent.keyDown(all, { key: 'ArrowRight', altKey: true });
    expect(document.activeElement).toBe(all);
    expect(checked(view)).toEqual([all]);
    fireEvent.keyDown(all, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(radio(view, /^Published/));
    expect(checked(view)).toEqual([radio(view, /^Published/)]);
  });

  it('keeps a disabled option announced, but out of the tab order and unclickable', () => {
    const { view, onValueChange } = setup('all', [options[0]!, { ...options[1]!, disabled: true }, options[2]!]);
    const drafts = radio(view, /^Drafts/) as HTMLButtonElement;
    expect(drafts.disabled).toBe(true);
    expect(drafts.tabIndex).toBe(-1);
    drafts.click();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('does not take the arrows when every option is disabled', () => {
    const { view, onValueChange } = setup(
      'all',
      options.map((option) => ({ ...option, disabled: true })),
    );
    expect(view.getAllByRole('radio').filter((node) => node.tabIndex === 0)).toEqual([]);
    fireEvent.keyDown(radio(view, /^All/), { key: 'ArrowRight' });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('renders nothing for no options, rather than a radiogroup with no radios', () => {
    const { view } = setup('all', []);
    expect(view.queryByRole('radiogroup')).toBeNull();
    expect(view.container.innerHTML).toBe('');
  });

  it('lets a long label give way to an ellipsis, and shows the whole of it on hover', () => {
    const { view } = setup();
    const published = view.getByText('Published');
    expect(published.className).toContain('truncate');
    expect(published.getAttribute('title')).toBe('Published');
    expect(view.getByRole('radiogroup').className).toContain('max-w-full');
  });

  it('gives a label that is not a string no title, since there is no text to show', () => {
    const { view } = setup('all', [{ value: 'all', label: <em data-testid="rich">All</em> }]);
    expect(view.getByTestId('rich').parentElement?.getAttribute('title')).toBeNull();
  });
});
