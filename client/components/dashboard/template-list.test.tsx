import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TemplateListItem } from '~/lib/template-search';

// A stand-in that reports a delete's progress on demand, so the row's reaction
// to it can be driven without a confirm dialog and a network. Bun shares one
// process, and one module registry, across test files, and `mock.module`
// outlives the file that made it: the real module is captured first and put
// back afterwards, or every file that runs later would meet the stand-in, and
// which files those are depends on the run order.
const realActions = { ...(await import('~/components/dashboard/template-actions')) };
const realNavigation = { ...(await import('next/navigation')) };
mock.module('next/navigation', () => ({ ...realNavigation, useRouter: () => ({ refresh: () => {} }) }));
mock.module('~/components/dashboard/template-actions', () => ({
  ...realActions,
  TemplateActions: ({
    templateTitle,
    canDuplicate,
    onDeleteStateChange,
  }: {
    templateTitle?: string;
    canDuplicate?: boolean;
    onDeleteStateChange?: (state: 'idle' | 'deleting' | 'deleted') => void;
  }) => (
    <div data-actions={canDuplicate ? 'with-duplicate' : 'without-duplicate'}>
      <button type="button" onClick={() => onDeleteStateChange?.('deleting')}>
        {`start delete ${templateTitle}`}
      </button>
      <button type="button" onClick={() => onDeleteStateChange?.('deleted')}>
        {`finish delete ${templateTitle}`}
      </button>
      <button type="button" onClick={() => onDeleteStateChange?.('idle')}>
        {`fail delete ${templateTitle}`}
      </button>
    </div>
  ),
}));
afterAll(() => {
  mock.module('~/components/dashboard/template-actions', () => realActions);
  mock.module('next/navigation', () => realNavigation);
});

const { TemplateList } = await import('./template-list');

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

// Each row's thumbnail asks the API for a preview, which there is nothing to
// answer here and which is not under test: the request just never finishes.
const realFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = mock(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const template = (overrides: Partial<TemplateListItem> & { id: string; title: string }): TemplateListItem => ({
  preview_text: null,
  short_code: null,
  updated_at: overrides.has_unpublished_changes ? '2026-10-01T10:00:00.000Z' : '2026-10-01T09:00:00.000Z',
  published_at: '2026-10-01T09:00:00.000Z',
  has_unpublished_changes: false,
  ...overrides,
});

const templates: TemplateListItem[] = [
  template({ id: 'a', title: 'Welcome email', preview_text: 'Glad you are here' }),
  template({ id: 'b', title: 'Receipt', has_unpublished_changes: true }),
  template({ id: 'c', title: 'Newsletter', published_at: null }),
];

// What the page passes as the empty state's way forward: the real button needs
// Clerk and the query client's mutations, neither of which is under test.
const newTemplate = <button type="button">New template</button>;

function setup(list: TemplateListItem[] = templates, canDuplicate = true, isAdmin = false, readOnly = false) {
  const client = new QueryClient();
  const tree = (items: TemplateListItem[]) => (
    <QueryClientProvider client={client}>
      <TemplateList templates={items} canDuplicate={canDuplicate} isAdmin={isAdmin} readOnly={readOnly} emptyAction={newTemplate} />
    </QueryClientProvider>
  );
  const view = render(tree(list));
  // What the page's refresh does after a delete: the same list, mounted
  // throughout, handed a new set of templates.
  return Object.assign(view, { showing: (items: TemplateListItem[]) => view.rerender(tree(items)) });
}

type View = ReturnType<typeof render>;
const rows = (view: View) => view.queryAllByRole('listitem');
const titles = (view: View) => rows(view).map((item) => item.querySelector('a')?.textContent ?? '');
const count = (view: View) => view.getByRole('status').textContent;
const radio = (view: View, name: RegExp) => view.getByRole('radio', { name });
const search = (view: View) => view.getByRole('searchbox', { name: 'Search templates' }) as HTMLInputElement;
// React settles at load whether the DOM reports `input` events, and under
// happy-dom it settles on no: it then reads a field's value on focus and key
// release instead. A typed change is therefore a focus, the value arriving, and
// a key coming up, which is also what a browser that does report them sees.
const type = (view: View, value: string) => {
  const field = search(view);
  fireEvent.focusIn(field);
  fireEvent.input(field, { target: { value } });
  fireEvent.keyUp(field, { key: 'x' });
};

describe('TemplateList rows', () => {
  it('puts waiting reviews first, keeps the notice visible through search, and offers admins review', () => {
    const list = [template({ id: 'live', title: 'Live' }), template({ id: 'waiting', title: 'Review me', staged_at: 'staged', review_requested_at: 'asked' })];
    const view = setup(list, true, true);
    expect(titles(view)[0]).toContain('Review me');
    expect(view.getByText('1 template is waiting for your sign-off')).toBeTruthy();
    expect(view.getByRole('link', { name: 'Review templates' }).getAttribute('href')).toBe('/templates/waiting/review');
    type(view, 'Live');
    expect(view.getByText('1 template is waiting for your sign-off')).toBeTruthy();
  });

  it('offers members sign-off without an admin callout action and disables writes on a lapsed plan', () => {
    const view = setup([template({ id: 'waiting', title: 'Review me', staged_at: 'staged', review_requested_at: 'asked' }), template({ id: 'draft', title: 'Draft me', published_at: null })], false, false, true);
    expect(view.getByText('1 template is waiting for an admin')).toBeTruthy();
    expect(view.queryByRole('link', { name: 'Review templates' })).toBeNull();
    expect(view.getByRole('link', { name: 'View sign-off “Review me”' }).getAttribute('href')).toBe('/templates/waiting/review');
    expect((view.getByRole('button', { name: 'Move to staging “Draft me”' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('is one row per template, with drafts before live rows and recency kept within a stage', () => {
    const view = setup();
    expect(rows(view)).toHaveLength(3);
    expect(titles(view)[0]).toContain('Receipt');
    expect(titles(view)[1]).toContain('Newsletter');
    expect(titles(view)[2]).toContain('Welcome email');
    expect(rows(view)[0]!.querySelector('a')?.getAttribute('href')).toBe('/templates/b');
  });

  it('shows the preview text, or says there is none', () => {
    const view = setup();
    expect(within(rows(view)[2]!).getByText('Glad you are here')).toBeTruthy();
    expect(within(rows(view)[1]!).getByText('No preview text')).toBeTruthy();
  });

  it('badges each row with where it stands, and a published row is not also called a draft', () => {
    const view = setup();
    const [changed, draft, published] = rows(view) as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(published).getByText('Published').className).toContain('text-success-ink');
    expect(within(published).queryByText('Draft')).toBeNull();
    expect(within(published).queryByText('Unpublished changes')).toBeNull();
    expect(within(changed).getByText('Unpublished changes').className).toContain('text-warn-ink');
    expect(within(draft).getByText('Draft').className).toContain('text-muted');
    // One badge a row: the status is told once.
    expect(within(draft).queryByText('Published')).toBeNull();
  });

  it('says when each was last edited, in a time element a machine can read', () => {
    const view = setup();
    const time = within(rows(view)[2]!).getByText(/2026/);
    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('datetime')).toBe('2026-10-01T09:00:00.000Z');
  });

  it('draws no date for a row that has none to give, and does not throw', () => {
    const view = setup([template({ id: 'a', title: 'No stamp', updated_at: null }), template({ id: 'b', title: 'Bad stamp', updated_at: 'not a date' })]);
    expect(view.container.querySelector('time')).toBeNull();
    expect(rows(view)).toHaveLength(2);
  });

  it('hands each row its own title and the duplicate allowance', () => {
    const view = setup(templates, false);
    expect(view.getByRole('button', { name: 'start delete Receipt' })).toBeTruthy();
    expect(view.container.querySelector('[data-actions="without-duplicate"]')).not.toBeNull();
    expect(view.container.querySelector('[data-actions="with-duplicate"]')).toBeNull();
  });
});

describe('TemplateList count', () => {
  it('reads the whole count in a status region that stays mounted', () => {
    const view = setup();
    expect(count(view)).toBe('3 templates');
    type(view, 'receipt');
    expect(count(view)).toBe('1 of 3 templates');
    type(view, 'zzz');
    expect(count(view)).toBe('0 of 3 templates');
  });

  it('is singular for one template', () => {
    expect(count(setup([template({ id: 'a', title: 'Only' })]))).toBe('1 template');
  });

  it('follows the filter as well as the search', () => {
    const view = setup();
    fireEvent.click(radio(view, /^Drafts/));
    expect(count(view)).toBe('2 of 3 templates');
    type(view, 'receipt');
    expect(count(view)).toBe('1 of 3 templates');
  });
});

describe('TemplateList filter', () => {
  it('is a labelled group of three with a count on each, and All chosen to begin with', () => {
    const view = setup();
    expect(view.getByRole('radiogroup', { name: 'Filter templates' })).toBeTruthy();
    expect(radio(view, /^All\s*,\s*3$/).getAttribute('aria-checked')).toBe('true');
    expect(radio(view, /^Published\s*,\s*1$/).getAttribute('aria-checked')).toBe('false');
    expect(radio(view, /^Drafts\s*,\s*2$/).getAttribute('aria-checked')).toBe('false');
  });

  it('narrows to what was published, with nothing waiting', () => {
    const view = setup();
    fireEvent.click(radio(view, /^Published/));
    expect(titles(view)).toHaveLength(1);
    expect(titles(view)[0]).toContain('Welcome email');
    expect(radio(view, /^Published/).getAttribute('aria-checked')).toBe('true');
  });

  it('counts unpublished changes and never-published together as drafts', () => {
    const view = setup();
    fireEvent.click(radio(view, /^Drafts/));
    expect(titles(view).map((title) => title.includes('Receipt') || title.includes('Newsletter'))).toEqual([true, true]);
  });

  it('combines with the search, and the counts follow the search', () => {
    const view = setup();
    type(view, 'receipt');
    expect(radio(view, /^All\s*,\s*1$/)).toBeTruthy();
    expect(radio(view, /^Published\s*,\s*0$/)).toBeTruthy();
    expect(radio(view, /^Drafts\s*,\s*1$/)).toBeTruthy();
    fireEvent.click(radio(view, /^Drafts/));
    expect(titles(view)).toHaveLength(1);
    expect(titles(view)[0]).toContain('Receipt');
  });

  it('moves with the arrow keys, the way a radio group does', () => {
    const view = setup();
    fireEvent.keyDown(radio(view, /^All/), { key: 'ArrowRight' });
    expect(radio(view, /^Published/).getAttribute('aria-checked')).toBe('true');
    expect(titles(view)).toHaveLength(1);
  });
});

describe('TemplateList when nothing is left to show', () => {
  it('says a search found nothing, and names what was searched for', () => {
    const view = setup();
    type(view, 'zebra');
    expect(view.getByText('No templates match')).toBeTruthy();
    expect(view.getByText(/Nothing matches “zebra”/)).toBeTruthy();
    expect(rows(view)).toHaveLength(0);
  });

  it('has exactly one Clear search, the × in the field, and a differently named way back', () => {
    const view = setup();
    type(view, 'zebra');
    expect(view.getAllByRole('button', { name: 'Clear search' })).toHaveLength(1);
    expect(view.getAllByRole('button', { name: 'Show all templates' })).toHaveLength(1);
  });

  it('keeps the filter when the search is cleared, and puts the cursor back in the field', () => {
    const view = setup();
    fireEvent.click(radio(view, /^Drafts/));
    type(view, 'zebra');
    expect(view.getByText(/Nothing under Drafts matches “zebra”/)).toBeTruthy();
    fireEvent.click(view.getByRole('button', { name: 'Clear search' }));
    expect(search(view).value).toBe('');
    expect(radio(view, /^Drafts/).getAttribute('aria-checked')).toBe('true');
    expect(titles(view)).toHaveLength(2);
    expect(document.activeElement).toBe(search(view));
  });

  it('answers a filter with nothing in it in its own words, not as a failed search', () => {
    const view = setup([template({ id: 'a', title: 'Live one' })]);
    fireEvent.click(radio(view, /^Drafts/));
    expect(view.getByText('No drafts')).toBeTruthy();
    expect(view.queryByText('No templates match')).toBeNull();
    expect(view.queryByRole('button', { name: 'Clear search' })).toBeNull();
    expect(count(view)).toBe('0 of 1 template');
  });

  it('says so when nothing is published yet', () => {
    const view = setup([template({ id: 'a', title: 'Never live', published_at: null })]);
    fireEvent.click(radio(view, /^Published/));
    expect(view.getByText('No published templates')).toBeTruthy();
  });

  it('shows everything again from Show all templates, search and filter both undone', () => {
    const view = setup();
    fireEvent.click(radio(view, /^Published/));
    type(view, 'receipt');
    expect(view.getByText('No templates match')).toBeTruthy();
    fireEvent.click(view.getByRole('button', { name: 'Show all templates' }));
    expect(search(view).value).toBe('');
    expect(radio(view, /^All/).getAttribute('aria-checked')).toBe('true');
    expect(titles(view)).toHaveLength(3);
    expect(view.queryByText('No templates match')).toBeNull();
    expect(document.activeElement).toBe(search(view));
  });

  it('fades the state in rather than popping it', () => {
    const view = setup();
    type(view, 'zebra');
    const state = view.getByText('No templates match').closest('.fade-in-mount');
    expect(state).not.toBeNull();
    expect(state?.className).toContain('motion-reduce:transition-none');
  });
});

describe('TemplateList while a delete runs', () => {
  const rowOf = (view: View, title: string) =>
    rows(view).find((item) => within(item).queryByText(title)) as HTMLElement;

  it('dims the row and takes the pointer off it, keeping the link in place', () => {
    const view = setup();
    const link = within(rowOf(view, 'Receipt')).getByRole('link');
    fireEvent.click(view.getByRole('button', { name: 'start delete Receipt' }));
    expect(rowOf(view, 'Receipt').className).toContain('pointer-events-none');
    expect(rowOf(view, 'Receipt').className).toContain('opacity-60');
    // Dimmed by class, not by swapping the link for a box: that would
    // remount the thumbnail in the middle of the row's exit.
    expect(within(rowOf(view, 'Receipt')).getByRole('link')).toBe(link);
    expect(rowOf(view, 'Welcome email').className).not.toContain('opacity-60');
  });

  it('closes the row once the server has deleted it, and nobody can reach it on the way out', () => {
    const view = setup();
    fireEvent.click(view.getByRole('button', { name: 'start delete Receipt' }));
    fireEvent.click(view.getByRole('button', { name: 'finish delete Receipt' }));
    const item = rowOf(view, 'Receipt');
    expect(item.className).toContain('opacity-0');
    expect(item.querySelector('[inert]')).not.toBeNull();
    expect(item.querySelector('[class*="grid-rows-[0fr]"]')).not.toBeNull();
  });

  it('brings the row back as it was when the delete fails', () => {
    const view = setup();
    fireEvent.click(view.getByRole('button', { name: 'start delete Receipt' }));
    fireEvent.click(view.getByRole('button', { name: 'fail delete Receipt' }));
    expect(rowOf(view, 'Receipt').className).not.toContain('opacity-60');
    expect(rowOf(view, 'Receipt').querySelector('[inert]')).toBeNull();
  });
});

describe('TemplateList focus after a delete', () => {
  const rowOf = (view: View, title: string) =>
    rows(view).find((item) => within(item).queryByText(title)) as HTMLElement;
  const linkOf = (view: View, title: string) => rowOf(view, title).querySelector('a');
  // Focus is on the row's own button when the server confirms, as it is after a
  // confirmed delete: the dialog hands focus back to the button it opened from.
  const confirmDelete = (view: View, title: string) => {
    const done = view.getByRole('button', { name: `finish delete ${title}` });
    done.focus();
    fireEvent.click(done);
  };

  it('moves to the row that closes up into the gap', () => {
    const view = setup();
    confirmDelete(view, 'Receipt');
    expect(document.activeElement).toBe(linkOf(view, 'Newsletter'));
  });

  it('moves to the row above when the last one goes', () => {
    const view = setup();
    confirmDelete(view, 'Welcome email');
    expect(document.activeElement).toBe(linkOf(view, 'Newsletter'));
  });

  it('passes over a neighbour that is already closing, which cannot take focus', () => {
    const view = setup();
    confirmDelete(view, 'Newsletter');
    confirmDelete(view, 'Receipt');
    expect(document.activeElement).toBe(linkOf(view, 'Welcome email'));
  });

  it('falls back to the search field when no other row is left open', () => {
    const view = setup([template({ id: 'a', title: 'Only one' })]);
    confirmDelete(view, 'Only one');
    expect(document.activeElement).toBe(search(view));
  });

  it('leaves focus alone when the delete fails', () => {
    const view = setup();
    const start = view.getByRole('button', { name: 'start delete Receipt' });
    start.focus();
    fireEvent.click(start);
    fireEvent.click(view.getByRole('button', { name: 'fail delete Receipt' }));
    expect(document.activeElement).toBe(start);
  });

  it('does not take focus from a reader who moved on while the request ran', () => {
    const view = setup();
    search(view).focus();
    fireEvent.click(view.getByRole('button', { name: 'finish delete Receipt' }));
    expect(document.activeElement).toBe(search(view));
  });
});

describe('TemplateList with nothing in it', () => {
  const only = [template({ id: 'a', title: 'Only one' })];
  const first = (view: View) => view.getByRole('group', { name: 'Templates' });
  const confirmDelete = (view: View, title: string) => {
    const done = view.getByRole('button', { name: `finish delete ${title}` });
    done.focus();
    fireEvent.click(done);
  };

  it('invites a first template, with the way to start one, and no rows', () => {
    const view = setup([]);
    expect(within(first(view)).getByText('No templates yet')).toBeTruthy();
    expect(within(first(view)).getByRole('button', { name: 'New template' })).toBeTruthy();
    expect(rows(view)).toHaveLength(0);
  });

  it('is named for the area, so a screen reader does not hear the title twice', () => {
    const group = first(setup([]));
    expect(group.getAttribute('aria-label')).not.toBe('No templates yet');
    expect(within(group).getByText('No templates yet')).toBeTruthy();
  });

  it('puts the toolbar out of reach while it has nothing to search, and keeps it in reach otherwise', () => {
    expect(search(setup(only)).closest('[inert]')).toBeNull();
    cleanup();
    const view = setup([]);
    const closed = search(view).closest('[inert]');
    expect(closed).not.toBeNull();
    expect(closed?.parentElement?.className).toContain('grid-rows-[0fr]');
  });

  it('closes the toolbar and fades the invitation in, rather than swapping them', () => {
    const view = setup(only);
    const toolbarTrack = search(view).closest('[class*="grid-rows-"]');
    expect(toolbarTrack?.className).toContain('grid-rows-[1fr]');
    expect(toolbarTrack?.className).toContain('motion-reduce:transition-none');
    view.showing([]);
    expect(search(view).closest('[class*="grid-rows-"]')?.className).toContain('grid-rows-[0fr]');
    expect(first(view).className).toContain('fade-in-mount');
    expect(first(view).className).toContain('motion-reduce:transition-none');
  });

  it('takes focus when the last template is deleted, so the reader is not dropped on the page', () => {
    const view = setup(only);
    confirmDelete(view, 'Only one');
    // The row's own hand-off lands on the search field, which is about to go inert.
    expect(document.activeElement).toBe(search(view));
    view.showing([]);
    expect(document.activeElement).toBe(first(view));
  });

  it('takes focus when it has already fallen to the page', () => {
    const view = setup(only);
    expect(document.activeElement).toBe(document.body);
    view.showing([]);
    expect(document.activeElement).toBe(first(view));
  });

  it('takes nothing from a first visit to an account with no templates', () => {
    setup([]);
    expect(document.activeElement).toBe(document.body);
  });

  it('leaves a reader who moved elsewhere where they went', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    const view = setup(only);
    outside.focus();
    view.showing([]);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('opens the toolbar and lists the rows again when a template arrives, without taking focus back', () => {
    const view = setup([]);
    view.showing(only);
    expect(search(view).closest('[inert]')).toBeNull();
    expect(titles(view)).toHaveLength(1);
    expect(view.queryByRole('group', { name: 'Templates' })).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });
});
