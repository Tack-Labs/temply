import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
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

const template = (overrides: Partial<TemplateListItem> & { id: string; title: string }): TemplateListItem => ({
  preview_text: null,
  short_code: null,
  updated_at: '2026-10-01T09:00:00.000Z',
  published_at: '2026-10-01T09:00:00.000Z',
  has_unpublished_changes: false,
  ...overrides,
});

const templates: TemplateListItem[] = [
  template({ id: 'a', title: 'Welcome email', preview_text: 'Glad you are here' }),
  template({ id: 'b', title: 'Receipt', has_unpublished_changes: true }),
  template({ id: 'c', title: 'Newsletter', published_at: null }),
];

const setup = (props: Partial<React.ComponentProps<typeof RecentTemplates>> = {}) =>
  render(
    <RecentTemplates
      templates={templates}
      failed={false}
      emptyAction={<button type="button">New template</button>}
      {...props}
    />,
  );

describe('RecentTemplates', () => {
  it('lists each template as a link to its editor, under a heading', () => {
    const view = setup();
    expect(view.getByRole('heading', { name: 'Recent templates' })).toBeTruthy();
    expect(view.getByRole('link', { name: /Welcome email/ }).getAttribute('href')).toBe('/templates/a');
    expect(view.getByRole('link', { name: /Receipt/ }).getAttribute('href')).toBe('/templates/b');
    expect(view.getAllByRole('listitem')).toHaveLength(3);
  });

  it('shows the preview text, or says there is none', () => {
    const view = setup();
    expect(view.getByText('Glad you are here')).toBeTruthy();
    expect(view.getAllByText('No preview text')).toHaveLength(2);
  });

  it('says where each one stands in the same words and tones as the templates list', () => {
    const view = setup();
    expect(view.getByText('Published').className).toContain('text-success-ink');
    expect(view.getByText('Unpublished changes').className).toContain('text-warn-ink');
    expect(view.getByText('Draft').className).toContain('text-muted');
  });

  it('dates a template by when it was edited, never "Published {date}"', () => {
    const view = setup();
    expect(view.getAllByText(/^Edited/)).toHaveLength(3);
    expect(view.queryByText(/^Published \S/)).toBeNull();
    expect(view.container.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-01T09:00:00.000Z');
  });

  it('gives the dates tabular figures so a column of them lines up', () => {
    const view = setup();
    expect(view.getAllByText(/^Edited/)[0]?.className).toContain('tabular-nums');
  });

  it('leaves the date out of a row that has none, rather than printing "Invalid Date"', () => {
    const view = setup({ templates: [template({ id: 'x', title: 'Undated', updated_at: null })] });
    expect(view.queryByText(/^Edited/)).toBeNull();
    expect(view.container.innerHTML).not.toContain('Invalid');
  });

  it('lets the list’s own width decide where the badge sits, not the window’s', () => {
    const view = setup();
    expect(view.getByRole('list').className).toContain('@container');
  });

  it('links to the whole list, with a target that grows on a touch screen', () => {
    const link = setup().getByRole('link', { name: 'View all' });
    expect(link.getAttribute('href')).toBe('/dashboard/templates');
    expect(link.className).toContain('pointer-coarse:h-11');
  });
});

describe('RecentTemplates with nothing to show', () => {
  it('invites a first template, with the action handed in beside it', () => {
    const view = setup({ templates: [] });
    expect(view.getByText('No templates yet')).toBeTruthy();
    expect(view.getByRole('button', { name: 'New template' })).toBeTruthy();
    expect(view.queryByRole('list')).toBeNull();
    // Nothing to view all of.
    expect(view.queryByRole('link', { name: 'View all' })).toBeNull();
  });

  it('is an error, not an empty account, when the fetch failed', () => {
    const view = setup({ templates: [], failed: true });
    expect(view.getByText('Could not load this').className).toContain('text-danger-ink');
    expect(view.getByText(/not a sign that they are gone/)).toBeTruthy();
    expect(view.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(view.queryByText('No templates yet')).toBeNull();
    expect(view.queryByRole('button', { name: 'New template' })).toBeNull();
    expect(view.queryByRole('link', { name: 'View all' })).toBeNull();
  });

  it('keeps the header row the height "View all" makes it, so the loading skeleton’s row is the one that arrives', () => {
    for (const props of [{}, { templates: [] }, { failed: true }]) {
      const row = setup(props).getByRole('heading', { name: 'Recent templates' }).parentElement;
      expect(row?.className).toContain('min-h-7');
      expect(row?.className).toContain('pointer-coarse:min-h-11');
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
