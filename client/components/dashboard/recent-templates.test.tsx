import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import type { TemplateListItem } from '~/lib/template-search';

// Bun shares one process, and one module registry, across test files, and
// `mock.module` outlives the file that made it. The real module is captured
// before it is replaced and put back afterwards, or every file that runs later
// would meet the stand-in, and which files those are depends on the run order.

// The empty and error states are drawn by components that read the router.
const realNavigation = { ...(await import('next/navigation')) };
mock.module('next/navigation', () => ({ ...realNavigation, useRouter: () => ({ refresh: () => {} }) }));

// The thumbnail fetches a preview per row; what it draws is not under test.
const realThumbnail = { ...(await import('~/components/dashboard/template-thumbnail')) };
mock.module('~/components/dashboard/template-thumbnail', () => ({
  ...realThumbnail,
  TemplateThumbnail: () => <div aria-hidden="true" data-thumbnail />,
}));
afterAll(() => {
  mock.module('next/navigation', () => realNavigation);
  mock.module('~/components/dashboard/template-thumbnail', () => realThumbnail);
});

const { RecentTemplates } = await import('./recent-templates');

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const template = (overrides: Partial<TemplateListItem> & { id: string; title: string }): TemplateListItem => ({
  preview_text: null,
  short_code: null,
  updated_at: '2026-10-01T09:00:00.000Z',
  published_at: '2026-10-01T09:00:00.000Z',
  has_unpublished_changes: false,
  ...overrides,
});

const templates: TemplateListItem[] = [
  template({ id: 'a', title: 'Welcome email', preview_text: 'Glad you are here', updated_at: ago(2 * HOUR), published_at: ago(2 * HOUR) }),
  template({ id: 'b', title: 'Receipt', has_unpublished_changes: true, updated_at: ago(3 * 24 * HOUR) }),
  template({ id: 'c', title: 'Newsletter', published_at: null }),
];

const setup = (props: Partial<React.ComponentProps<typeof RecentTemplates>> = {}) =>
  render(<RecentTemplates templates={templates} failed={false} canCreate {...props} />);

const card = (view: ReturnType<typeof setup>, title: string) =>
  view.getAllByRole('listitem').find((item) => item.textContent?.includes(title)) as HTMLElement;

describe('RecentTemplates', () => {
  it('lists each template as a card that opens its editor, under a heading', () => {
    const view = setup();
    expect(view.getByRole('region', { name: 'Recent templates' })).toBeTruthy();
    expect(view.getByRole('heading', { level: 2, name: 'Recent templates' })).toBeTruthy();
    expect(view.getByRole('link', { name: /Welcome email/ }).getAttribute('href')).toBe('/templates/a');
    expect(view.getByRole('link', { name: /Receipt/ }).getAttribute('href')).toBe('/templates/b');
    expect(view.getAllByRole('listitem')).toHaveLength(3);
  });

  it('lays the cards in a grid that fills as many columns as the width allows', () => {
    const list = setup().getByRole('list');
    expect(list.className).toContain('grid');
    expect(list.className).toContain('minmax(15rem,1fr)');
    expect(list.className).toContain('gap-4.5');
  });

  it('shows the preview text, or says there is none', () => {
    const view = setup();
    expect(view.getByText('Glad you are here')).toBeTruthy();
    expect(view.getAllByText('No preview text')).toHaveLength(2);
  });

  it('says where each one stands in the same words and tones as the templates list', () => {
    const view = setup();
    expect(view.getByText('Published').className).toContain('text-success-ink');
    expect(view.getByText('Unpublished changes').className).toContain('text-accent-ink');
    expect(view.getByText('Draft').className).toContain('text-muted');
  });

  it('names a template in the release flow for its place in it, as the list does', () => {
    const flow = [
      template({ id: 'w', title: 'Waiting', staged_at: ago(HOUR), review_requested_at: ago(HOUR) }),
      template({ id: 's', title: 'Staged', staged_at: ago(HOUR) }),
      template({ id: 'r', title: 'Returned', staged_at: ago(HOUR), returned_at: ago(HOUR) }),
    ];
    const view = setup({ templates: flow });
    expect(view.getByText('In sign-off').className).toContain('text-warn-ink');
    expect(view.getByText('In staging').className).toContain('text-sky-ink');
    expect(view.getByText('Sent back').className).toContain('text-danger-ink');
    expect(view.queryByText('Published')).toBeNull();
  });

  it('tints the thumbnail frame from the pill, so the two read as one mark', () => {
    const view = setup();
    const frame = (title: string) => card(view, title).querySelector('[data-thumbnail]')?.closest('.h-35');
    expect(frame('Welcome email')?.className).toContain('bg-success-wash');
    expect(frame('Receipt')?.className).toContain('bg-accent-wash');
    expect(frame('Newsletter')?.className).toContain('bg-track');
  });

  it('says how long ago each was edited, in a time element a machine can read', () => {
    const stamp = ago(2 * HOUR + 600_000);
    const view = setup({ templates: [template({ id: 'a', title: 'Welcome email', updated_at: stamp })] });
    const edited = view.getByText(/^Edited/);
    expect(edited.textContent).toBe('Edited 2 hours ago');
    const time = view.getByText('2 hours ago');
    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('datetime')).toBe(stamp);
    expect(time.getAttribute('title')).toBeTruthy();
    expect(view.queryByText(/^Published \S/)).toBeNull();
  });

  it('gives the times tabular figures, and fades them in once the browser can say them', () => {
    const edited = setup().getAllByText(/^Edited/)[0]!;
    expect(edited.className).toContain('tabular-nums');
    expect(edited.className).toContain('fade-in-mount');
    expect(edited.className).toContain('motion-reduce:transition-none');
  });

  it('draws no clock-dependent words on the server', () => {
    const markup = renderToString(<RecentTemplates templates={templates} failed={false} canCreate />);
    expect(markup).toContain('Welcome email');
    expect(markup).not.toContain('Edited');
    expect(markup).not.toContain('<time');
  });

  it('leaves the time out of a card that has none, rather than printing "Invalid Date"', () => {
    const view = setup({ templates: [template({ id: 'x', title: 'Undated', updated_at: null })] });
    expect(view.queryByText(/^Edited/)).toBeNull();
    expect(view.container.innerHTML).not.toContain('Invalid');
  });

  it('stacks the pill over the time, so a narrow card never overflows and every card sets the date at the same height', () => {
    const view = setup();
    const pill = view.getByText('Published');
    expect(pill.parentElement?.className).toContain('flex-col');
    expect(pill.parentElement?.className).not.toContain('flex-wrap');
  });

  it('lifts as one card under the pointer, with the link the whole of it', () => {
    const view = setup();
    const link = view.getByRole('link', { name: /Welcome email/ });
    expect(link.className).toContain('rounded-card');
    expect(link.firstElementChild?.className).toContain('rounded-card');
    expect(link.firstElementChild?.className).toContain('hover:-translate-y-0.5');
  });

  it('links to the whole list, a 44px target on every pointer', () => {
    const link = setup().getByRole('link', { name: 'View all' });
    expect(link.getAttribute('href')).toBe('/dashboard/templates');
    expect(link.className).toContain('h-11');
  });
});

describe('RecentTemplates with nothing to show', () => {
  it('points at the starters when a template can be made', () => {
    const view = setup({ templates: [] });
    expect(view.getByText('No templates yet')).toBeTruthy();
    expect(view.getByText(/Pick a starter above/)).toBeTruthy();
    expect(view.queryByRole('button')).toBeNull();
    expect(view.queryByRole('list')).toBeNull();
    // Nothing to view all of.
    expect(view.queryByRole('link', { name: 'View all' })).toBeNull();
  });

  it('does not send the reader to starters that cannot be used', () => {
    const view = setup({ templates: [], canCreate: false });
    expect(view.getByText('No templates yet')).toBeTruthy();
    expect(view.queryByText(/starter/)).toBeNull();
  });

  it('is an error, not an empty account, when the fetch failed', () => {
    const view = setup({ templates: [], failed: true });
    expect(view.getByText('Could not load this').className).toContain('text-danger-ink');
    expect(view.getByText(/not a sign that they are gone/)).toBeTruthy();
    expect(view.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(view.queryByText('No templates yet')).toBeNull();
    expect(view.queryByRole('link', { name: 'View all' })).toBeNull();
  });

  it('keeps the header row the height "View all" makes it, so the loading skeleton’s row is the one that arrives', () => {
    for (const props of [{}, { templates: [] }, { failed: true }]) {
      const row = setup(props).getByRole('heading', { name: 'Recent templates' }).parentElement;
      expect(row?.className).toContain('min-h-11');
      cleanup();
    }
  });

  it('puts the failure first even if rows came with it', () => {
    const view = setup({ failed: true });
    expect(view.getByText('Could not load this')).toBeTruthy();
    expect(view.queryByRole('list')).toBeNull();
  });
});

describe('RecentTemplates theming', () => {
  it('is on the theme tokens: no rail palette and no inline colour', () => {
    for (const props of [{}, { templates: [] }, { failed: true }]) {
      const html = setup(props).container.innerHTML;
      expect(html).not.toContain('rail-');
      expect(html).not.toMatch(/style="[^"]*color/);
      cleanup();
    }
  });
});
