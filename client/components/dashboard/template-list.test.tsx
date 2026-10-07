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
// Every word a row's status pill can say. A row shows exactly one of them.
const PILL = /^(Draft|Published|Unpublished changes|In staging|In sign-off|Sent back)$/;
const pillsIn = (item: HTMLElement) => within(item).queryAllByText(PILL);
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const HOUR = 3_600_000;
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
    expect(view.getByRole('link', { name: 'Review template' }).getAttribute('href')).toBe('/templates/waiting/review');
    type(view, 'Live');
    expect(view.getByText('1 template is waiting for your sign-off')).toBeTruthy();
  });

  it('offers members sign-off without an admin callout action and disables writes on a lapsed plan', () => {
    const view = setup([template({ id: 'waiting', title: 'Review me', staged_at: 'staged', review_requested_at: 'asked' }), template({ id: 'draft', title: 'Draft me', published_at: null })], false, false, true);
    expect(view.getByText('1 template is waiting for an admin')).toBeTruthy();
    expect(view.queryByRole('link', { name: 'Review template' })).toBeNull();
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
    expect(within(rows(view)[2]!).getByText(/Glad you are here/)).toBeTruthy();
    expect(within(rows(view)[1]!).getByText(/No preview text/)).toBeTruthy();
  });

  it('gives each row one pill for where it stands, and a published row is not also called a draft', () => {
    const view = setup();
    const [changed, draft, published] = rows(view) as [HTMLElement, HTMLElement, HTMLElement];
    const live = within(published).getByText('Published');
    expect(live.className).toContain('text-success-ink');
    expect(live.className).toContain('bg-success-wash');
    expect(within(published).queryByText('Draft')).toBeNull();
    expect(within(published).queryByText('Unpublished changes')).toBeNull();
    const unpublished = within(changed).getByText('Unpublished changes');
    expect(unpublished.className).toContain('text-accent-ink');
    expect(unpublished.className).toContain('bg-accent-wash');
    const neverLive = within(draft).getByText('Draft');
    expect(neverLive.className).toContain('text-muted');
    expect(neverLive.className).toContain('bg-track');
    expect(within(draft).queryByText('Published')).toBeNull();
    for (const item of [changed, draft, published]) expect(pillsIn(item)).toHaveLength(1);
  });

  it('puts a template in the release flow in one pill of its own, whatever it also is', () => {
    const view = setup([
      template({ id: 'staged', title: 'Staged', staged_at: 'staged' }),
      template({ id: 'asked', title: 'Asked', staged_at: 'staged', review_requested_at: 'asked' }),
      template({ id: 'back', title: 'Back', staged_at: 'staged', returned_at: 'returned' }),
      template({ id: 'plain', title: 'Plain', has_unpublished_changes: true }),
    ]);
    const rowOf = (title: string) => rows(view).find((item) => within(item).queryByText(title)) as HTMLElement;
    const pill = (title: string, label: string) => within(rowOf(title)).getByText(label);
    expect(pill('Staged', 'In staging').className).toContain('text-sky-ink');
    expect(pill('Asked', 'In sign-off').className).toContain('text-warn-ink');
    expect(pill('Back', 'Sent back').className).toContain('text-danger-ink');
    for (const title of ['Staged', 'Asked', 'Back', 'Plain']) expect(pillsIn(rowOf(title))).toHaveLength(1);
    // Published, or unpublished changes, is the status of a template outside the flow only.
    expect(within(rowOf('Staged')).queryByText('Published')).toBeNull();
    expect(within(rowOf('Asked')).queryByText('Unpublished changes')).toBeNull();
  });

  it('marks the pill with a dot, in the pill\'s own ink, that a screen reader does not read', () => {
    const view = setup([template({ id: 'a', title: 'Only' })]);
    const dot = within(rows(view)[0]!).getByText('Published').querySelector('span');
    expect(dot?.getAttribute('aria-hidden')).toBe('true');
    expect(dot?.className).toContain('bg-current');
  });

  it('keeps the status out of the link, whose name is the template and what it says', () => {
    const view = setup([template({ id: 'a', title: 'Only', preview_text: 'Hello there' })]);
    const link = within(rows(view)[0]!).getAllByRole('link')[0]!;
    expect(link.textContent).toContain('Only');
    expect(link.textContent).toContain('Hello there');
    expect(link.textContent).not.toContain('Published');
  });

  it('tints no row for waiting, since the pill and the notice already say so', () => {
    const view = setup([template({ id: 'w', title: 'Waiting', staged_at: 'staged', review_requested_at: 'asked' })]);
    expect(rows(view)[0]!.className).not.toContain('bg-warn-wash');
  });

  it('says how long ago each was edited, in a time element a machine can read', () => {
    const stamp = ago(2 * HOUR + 600_000);
    const view = setup([template({ id: 'a', title: 'Fresh', preview_text: 'Hello there', updated_at: stamp })]);
    const time = within(rows(view)[0]!).getByText('2 hours ago');
    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('datetime')).toBe(stamp);
    // The full date for a reader who needs the day, not just the distance.
    expect(time.getAttribute('title')).toContain(String(new Date(stamp).getFullYear()));
    expect(time.parentElement?.textContent).toBe('Hello there · edited 2 hours ago');
  });

  it('counts a week and a day out, never calling elapsed time yesterday or last week', () => {
    const view = setup([
      template({ id: 'a', title: 'Older', updated_at: ago(9 * 24 * HOUR) }),
      template({ id: 'b', title: 'Newer', updated_at: ago(26 * HOUR) }),
    ]);
    expect(view.getByText('1 week ago').tagName).toBe('TIME');
    expect(view.getByText('1 day ago').tagName).toBe('TIME');
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

describe('TemplateList layout', () => {
  const only = [template({ id: 'a', title: 'Only', staged_at: 'staged' })];
  const classesOf = (element: Element | null | undefined) => (element?.className ?? '').split(/\s+/);

  it('is one white card with the redesign\'s corners, which is also the container the rows lay out against', () => {
    const list = rows(setup(only))[0]!.parentElement!;
    expect(list.tagName).toBe('UL');
    expect(classesOf(list)).toContain('@container');
    expect(classesOf(list)).toContain('rounded-card');
    expect(classesOf(list)).toContain('bg-raised');
    expect(classesOf(list)).not.toContain('rounded-xl');
  });

  it('is two lines on a narrow list and one on a wide one, laid out by the list\'s width, not the window\'s', () => {
    const item = rows(setup(only))[0]!;
    const body = classesOf(item.querySelector('a'));
    expect(body).toContain('@4xl:py-4');
    // The link and the actions stack, then sit side by side from the list's 4xl.
    const line = item.querySelector('a')!.parentElement!;
    expect(classesOf(line)).toContain('grid-cols-1');
    expect(classesOf(line)).toContain('@4xl:grid-cols-[minmax(0,1fr)_auto]');
    // Container queries only: a viewport breakpoint would ignore the sidebar.
    for (const token of [...body, ...classesOf(line)]) expect(token).not.toMatch(/^(sm|md|lg|xl|2xl):/);
  });

  it('wraps the status and the actions on a narrow row, so neither can push past its edge', () => {
    const item = rows(setup(only))[0]!;
    const cluster = item.querySelector('[class*="@4xl:flex-nowrap"]');
    expect(cluster).not.toBeNull();
    expect(classesOf(cluster)).toContain('flex-wrap');
    expect(classesOf(cluster)).toContain('min-w-0');
    // The actions hold to the right edge whether or not they share a line with the pill.
    expect(classesOf(cluster!.querySelector('.ml-auto'))).toContain('ml-auto');
    // The title's own indent: 16px + the 56px thumbnail + 20px gap, once there is room for one.
    expect(classesOf(cluster)).toContain('@lg:pl-23');
  });

  it('gives a wide row fixed cells, so the status and the action run straight down the list', () => {
    const item = rows(setup(only))[0]!;
    const pill = within(item).getByText('In staging').parentElement!;
    expect(classesOf(pill)).toContain('@4xl:w-47.5');
    const action = within(item).getByRole('button', { name: /^Ask for sign-off/ }).parentElement;
    expect(classesOf(action)).toContain('@4xl:w-42');
    expect(classesOf(action)).toContain('@4xl:[&>:is(a,button)]:w-full');
    // The action's own 44px and 15px, over the 28px toolbar size it is drawn at.
    expect(classesOf(action)).toContain('[&>:is(a,button)]:h-11');
    expect(classesOf(action)).toContain('[&>:is(a,button)]:text-ui');
    // The action and the menu join the cluster's own columns on a wide row.
    expect(classesOf(action!.parentElement)).toContain('@4xl:contents');
  });

  it('keeps the action and the menu one flex line, so the menu is never alone under the pill', () => {
    const item = rows(setup(only))[0]!;
    const group = within(item).getByRole('button', { name: /^start delete/ }).parentElement!.parentElement!;
    expect(classesOf(group)).toContain('flex');
    expect(classesOf(group)).toContain('items-center');
  });

  it('draws the template\'s thumbnail as a fixed 56 by 64 tile, tinted like its pill', () => {
    const item = rows(setup(only))[0]!;
    const tile = item.querySelector('.w-14');
    expect(tile).not.toBeNull();
    expect(classesOf(tile)).toContain('h-16');
    expect(classesOf(tile)).toContain('bg-sky-wash');
  });

  it('says once, under the rows, that a template has one status and that a delete asks first', () => {
    const view = setup();
    expect(view.getAllByText('Each template shows one status. Deleting always asks first.')).toHaveLength(1);
  });

  it('leaves the footnote out when there are no rows for it to be about', () => {
    const view = setup();
    type(view, 'zebra');
    expect(view.queryByText(/Each template shows one status/)).toBeNull();
    cleanup();
    expect(setup([]).queryByText(/Each template shows one status/)).toBeNull();
  });
});

describe('TemplateList toolbar', () => {
  it('is a pill field that searches by name or subject, still named Search templates', () => {
    const view = setup();
    expect(search(view).getAttribute('placeholder')).toBe('Search by name or subject');
    expect(search(view).className).toContain('rounded-full');
    expect(search(view).className).toContain('pl-11');
    expect(search(view).type).toBe('search');
  });

  it('draws its clear button as a 44px target on touch, inside the field\'s right padding', () => {
    const view = setup();
    type(view, 'receipt');
    const clear = view.getByRole('button', { name: 'Clear search' });
    expect(clear.className).toContain('pointer-coarse:size-11');
    expect(clear.className).toContain('absolute');
    expect(search(view).className).toContain('pr-12');
  });
});

describe('TemplateList waiting notice', () => {
  const waiting = [template({ id: 'w', title: 'Review me', staged_at: 'staged', review_requested_at: 'asked' })];

  it('is a butter strip in the warn tokens, with the explanation in muted ink beneath', () => {
    const view = setup(waiting, true, true);
    const message = view.getByText('1 template is waiting for your sign-off');
    expect(message.className).toContain('text-warn-ink');
    const detail = view.getByText('Customers keep the live version until you approve the new one.');
    expect(detail.className).toContain('text-muted');
    const strip = message.closest('.bg-warn-wash');
    expect(strip).not.toBeNull();
    expect(strip?.className).toContain('rounded-card');
  });

  it('is closed up with its Reveal when nothing is waiting, rather than leaving a gap, and says nothing', () => {
    const view = setup([template({ id: 'a', title: 'Live' })]);
    const strip = view.container.querySelector('[aria-hidden="true"][inert]')?.parentElement;
    expect(strip?.className).toContain('grid-rows-[0fr]');
    expect(strip?.className).toContain('motion-reduce:transition-none');
    // There is nothing to hold yet, so the closed strip is empty rather than
    // reading "0 templates are waiting".
    expect(strip?.textContent).toBe('');
  });

  it('keeps what it said while it closes, instead of flashing "0 templates"', () => {
    const view = setup(waiting, true, true);
    view.showing([template({ id: 'w', title: 'Review me' })]);
    expect(view.queryByText(/^0 templates/)).toBeNull();
    const message = view.getByText('1 template is waiting for your sign-off');
    // Closing: out of the tab order and the accessibility tree while it fades.
    expect(message.closest('[inert]')).not.toBeNull();
    expect(message.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(view.container.querySelector('[aria-hidden="true"][inert]')?.parentElement?.className).toContain('grid-rows-[0fr]');
    expect(view.getByRole('link', { name: 'Review template', hidden: true }).getAttribute('href')).toBe('/templates/w/review');
  });

  it('holds the last count it showed, and shows a new one the moment there is one', () => {
    const two = [
      template({ id: 'a', title: 'First', staged_at: 'staged', review_requested_at: 'asked' }),
      template({ id: 'b', title: 'Second', staged_at: 'staged', review_requested_at: 'asked' }),
    ];
    const view = setup(two, true, true);
    expect(view.getByText('2 templates are waiting for your sign-off')).toBeTruthy();
    view.showing([template({ id: 'a', title: 'First' }), template({ id: 'b', title: 'Second' })]);
    expect(view.getByText('2 templates are waiting for your sign-off').closest('[inert]')).not.toBeNull();
    view.showing(waiting);
    const open = view.getByText('1 template is waiting for your sign-off');
    expect(open.closest('[inert]')).toBeNull();
    expect(view.getByRole('link', { name: 'Review template' }).getAttribute('href')).toBe('/templates/w/review');
  });

  it('does not promise to review them all when it opens one', () => {
    // The link goes to a single template's sign-off, so at two or more it
    // reads as the next one, never "Review templates".
    const two = [
      template({ id: 'a', title: 'First', staged_at: 'staged', review_requested_at: 'asked' }),
      template({ id: 'b', title: 'Second', staged_at: 'staged', review_requested_at: 'asked' }),
    ];
    const view = setup(two, true, true);
    expect(view.queryByRole('link', { name: 'Review templates' })).toBeNull();
    expect(view.getByRole('link', { name: 'Review next' }).getAttribute('href')).toBe('/templates/a/review');
  });

  it('says plainly what it opens when there is one', () => {
    const view = setup(waiting, true, true);
    expect(view.getByRole('link', { name: 'Review template' }).getAttribute('href')).toBe('/templates/w/review');
  });

  it('names an admin to members, and never offers them the review link', () => {
    const view = setup(waiting, true, false);
    expect(view.getByText('Customers keep the live version until an admin approves the new one.')).toBeTruthy();
    expect(view.queryByRole('link', { name: 'Review template' })).toBeNull();
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
