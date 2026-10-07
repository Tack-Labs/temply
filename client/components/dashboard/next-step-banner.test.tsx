import { afterEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import type { TemplateListItem } from '~/lib/template-search';
import { NextStepBanner } from './next-step-banner';

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const template = (patch: Partial<TemplateListItem> = {}): TemplateListItem => {
  const stamp = ago(40 * 24 * HOUR);
  return {
    id: 'pw', title: 'Password reset', preview_text: null, short_code: null,
    updated_at: stamp, published_at: stamp, has_unpublished_changes: false, ...patch,
  };
};
const waiting = (patch: Partial<TemplateListItem> = {}) =>
  template({ staged_at: ago(5 * HOUR), review_requested_at: ago(2 * HOUR), ...patch });
const staged = (patch: Partial<TemplateListItem> = {}) => template({ staged_at: ago(3 * HOUR), ...patch });
const edited = (patch: Partial<TemplateListItem> = {}) =>
  template({ updated_at: ago(26 * HOUR), has_unpublished_changes: true, ...patch });

const region = (view: ReturnType<typeof render>) => view.getByRole('region', { name: 'Next step' });

describe('NextStepBanner', () => {
  it('asks an admin to sign off a template that is waiting, and goes to the review page', () => {
    const view = render(<NextStepBanner template={waiting()} isAdmin />);
    expect(view.getByText('Password reset is ready for your sign-off')).toBeTruthy();
    const link = view.getByRole('link', { name: 'Review' });
    expect(link.getAttribute('href')).toBe('/templates/pw/review');
    expect(region(view).textContent).toContain('Moved to sign-off 2 hours ago.');
  });

  it('tells anyone else it is waiting, without offering to approve it', () => {
    const view = render(<NextStepBanner template={waiting()} isAdmin={false} />);
    expect(view.getByText('Password reset is waiting for sign-off')).toBeTruthy();
    expect(view.getByRole('link', { name: 'View sign-off' }).getAttribute('href')).toBe('/templates/pw/review');
    expect(view.queryByRole('link', { name: 'Review' })).toBeNull();
  });

  it('says a staged template is in staging, and what to do about it', () => {
    const view = render(<NextStepBanner template={staged()} isAdmin />);
    expect(view.getByText('Password reset is in staging')).toBeTruthy();
    expect(region(view).textContent).toContain('Staged 3 hours ago. Ask for sign-off when it is ready.');
    expect(view.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/templates/pw/review');
  });

  it('says a sent-back template was sent back, counting from when it came back', () => {
    const view = render(<NextStepBanner template={staged({ returned_at: ago(HOUR) })} isAdmin={false} />);
    expect(view.getByText('Password reset was sent back')).toBeTruthy();
    expect(region(view).textContent).toContain('Sent back 1 hour ago. Make the changes, then ask for sign-off again.');
  });

  it('sends a draft with changes to the editor, not the review page', () => {
    const view = render(<NextStepBanner template={edited()} isAdmin />);
    expect(view.getByText('Password reset has unpublished changes')).toBeTruthy();
    expect(region(view).textContent).toContain('Edited 1 day ago.');
    expect(view.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/templates/pw');
  });

  it('puts the moment in a time element a machine can read, with the exact date behind it', () => {
    const stamp = ago(2 * HOUR + 600_000);
    const view = render(<NextStepBanner template={waiting({ review_requested_at: stamp })} isAdmin />);
    const time = view.getByText('2 hours ago');
    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('datetime')).toBe(stamp);
    expect(time.getAttribute('title')).toBeTruthy();
    // It arrives after hydration, so it fades in rather than popping.
    expect(time.className).toContain('fade-in-mount');
    expect(time.className).toContain('motion-reduce:transition-none');
  });

  it('is not on the page when there is nothing to do', () => {
    const view = render(<NextStepBanner template={null} isAdmin />);
    expect(view.queryByRole('region', { name: 'Next step' })).toBeNull();
    expect(view.queryByRole('link')).toBeNull();
  });

  it('draws no clock-dependent words on the server, so the browser has nothing to disagree with', () => {
    // React separates adjacent text nodes with comment markers.
    const markup = renderToString(<NextStepBanner template={staged()} isAdmin />).replaceAll('<!-- -->', '');
    expect(markup).toContain('Password reset is in staging');
    expect(markup).toContain('Staged. Ask for sign-off when it is ready.');
    expect(markup).not.toContain('<time');
    expect(markup).not.toContain('ago');
  });

  it('carries the pick in a lavender wash with the accent for its one action', () => {
    const view = render(<NextStepBanner template={waiting()} isAdmin />);
    expect(region(view).className).toContain('bg-accent-wash');
    expect(region(view).className).toContain('rounded-card');
    expect(view.getByText('Next step').className).toContain('text-accent-ink');

    // The one thing the page asks for is the primary button at page size, not
    // the raised secondary that every other control on the wash would be.
    const action = view.getByRole('link', { name: 'Review' }).className;
    expect(action).toContain('text-white');
    expect(action).toContain('h-12');
    expect(action).not.toContain('bg-raised');

    // `text-accent` on the raised tile measures 2.71:1 in dark; the ink is gated.
    const tile = region(view).querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(tile.className.split(' ')).toContain('text-accent-ink');
    expect(tile.className.split(' ')).not.toContain('text-accent');
  });

  it('keeps the eyebrow out of the accessibility tree, since the region is already named "Next step"', () => {
    // A screen reader would otherwise say it twice, once as the region's name
    // and once as the first thing inside it.
    const view = render(<NextStepBanner template={waiting()} isAdmin />);
    expect(view.getByText('Next step').getAttribute('aria-hidden')).toBe('true');
    expect(region(view).getAttribute('aria-label')).toBe('Next step');
  });

  it('wraps a title that is one long word, so the card cannot push the page sideways', () => {
    const long = 'x'.repeat(200);
    const view = render(<NextStepBanner template={waiting({ title: long })} isAdmin />);
    expect(view.getByText(`${long} is ready for your sign-off`).className).toContain('break-words');
  });

  describe('arriving and leaving', () => {
    const open = (view: ReturnType<typeof render>) =>
      view.container.firstElementChild as HTMLElement;

    it('grows in when a template turns up after the page was drawn, as a retried fetch does', () => {
      const view = render(<NextStepBanner template={null} isAdmin />);
      expect(open(view).className).toContain('grid-rows-[0fr]');

      view.rerender(<NextStepBanner template={waiting()} isAdmin />);

      expect(open(view).className).toContain('grid-rows-[1fr]');
      expect(view.getByRole('region', { name: 'Next step' })).toBeTruthy();
    });

    it('closes through its grid track rather than vanishing, still holding what it said', () => {
      const view = render(<NextStepBanner template={waiting()} isAdmin />);
      expect(open(view).className).toContain('grid-rows-[1fr]');

      view.rerender(<NextStepBanner template={null} isAdmin />);

      expect(open(view).className).toContain('grid-rows-[0fr]');
      expect(open(view).className).toContain('motion-reduce:transition-none');
      // The words stay in the tree to shrink with the box, but nothing in
      // them can be reached.
      expect(view.container.textContent).toContain('Password reset is ready for your sign-off');
      expect(view.queryByRole('region', { name: 'Next step' })).toBeNull();
      expect(view.queryByRole('link', { name: 'Review' })).toBeNull();
      expect(view.container.querySelector('[inert]')).toBeTruthy();
    });

    it('keeps its spacing inside the part that closes, so a closed banner leaves no gap', () => {
      const view = render(<NextStepBanner template={waiting()} isAdmin />);
      expect(open(view).className).not.toMatch(/\b(m|p)[tby]?-\d/);
      expect(region(view).parentElement?.className).toContain('pt-9');
    });
  });
});
