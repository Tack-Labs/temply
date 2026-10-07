import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../core/editor/test/dom';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

// See template-navigation.test.tsx: the real module is put back once this
// file is done, because the stand-in would otherwise be every later file's.
const push = mock((_href: string) => {});
const realNavigation = { ...(await import('next/navigation')) };
mock.module('next/navigation', () => ({
  ...realNavigation,
  usePathname: () => '/templates/abc',
  useRouter: () => ({ push, refresh: () => {} }),
}));
afterAll(() => {
  mock.module('next/navigation', () => realNavigation);
});
const { EditorHeader } = await import('./editor-header');

afterEach(cleanup);
beforeEach(() => push.mockClear());

describe('EditorHeader', () => {
  it('names the template as the page heading', () => {
    const view = render(<EditorHeader title="Welcome email" />);
    expect(view.getByRole('heading', { level: 1, name: 'Welcome email' })).toBeTruthy();
  });

  it('falls back to a name while the subject is still empty, rather than an empty heading', () => {
    const view = render(<EditorHeader title="" />);
    expect(view.getByRole('heading', { level: 1, name: 'Untitled' })).toBeTruthy();
  });

  it('leads back to the list with an icon-only link that has a name', () => {
    const view = render(<EditorHeader title="Welcome email" />);
    const back = view.getByRole('link', { name: 'Back to templates' });
    expect(back.getAttribute('href')).toBe('/dashboard/templates');
  });

  it('draws the title, the status and the actions in the slots it was given', () => {
    const view = render(
      <EditorHeader
        title="Welcome email"
        status={<span>Published</span>}
        actions={<button type="button">Publish</button>}
      />,
    );
    const header = view.getByRole('banner');
    expect(header.contains(view.getByText('Published'))).toBe(true);
    expect(header.contains(view.getByRole('button', { name: 'Publish' }))).toBe(true);
  });

  it('has no actions of its own: a page that passes none gets a header with the way back and nothing to press', () => {
    // The Variables, Versions, Review and Connect pages share this header;
    // only the editor route fills the slot, so the others must not grow
    // Publish or Delete buttons just because they sit in the same frame.
    const view = render(<EditorHeader title="Variables page" />);
    expect(view.queryAllByRole('button')).toHaveLength(0);
    expect(view.getAllByRole('link')).toHaveLength(1);
  });

  it('is one banner of the page, with the heading inside it', () => {
    const view = render(<EditorHeader title="Welcome email" />);
    const header = view.getByRole('banner');
    expect(header.contains(view.getByRole('heading', { level: 1 }))).toBe(true);
  });

  it('saves before it leaves when the editor asks it to, and stays when the save refuses', async () => {
    const beforeNavigate = mock(async () => true);
    const view = render(<EditorHeader title="Welcome email" beforeNavigate={beforeNavigate} />);
    fireEvent.click(view.getByRole('link', { name: 'Back to templates' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/templates'));

    push.mockClear();
    beforeNavigate.mockImplementation(async () => false);
    fireEvent.click(view.getByRole('link', { name: 'Back to templates' }));
    await waitFor(() => expect(beforeNavigate).toHaveBeenCalledTimes(2));
    expect(push).not.toHaveBeenCalled();
  });
});
