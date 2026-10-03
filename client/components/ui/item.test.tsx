import { afterEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { List, Row } from './item';

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

const row = (view: ReturnType<typeof render>) => view.getByRole('listitem');

describe('Row', () => {
  it('is a plain flex row until it is told it can leave, with no wrapper around its content', () => {
    const view = render(
      <List>
        <Row href="/templates/1" title="Welcome" actions={<button type="button">Delete</button>} />
      </List>,
    );
    expect(row(view).className).toContain('flex');
    // The primary link is the row's first child: the other consumers of Row
    // (brands, versions, assets) get exactly the markup they always had.
    expect(row(view).firstElementChild?.tagName).toBe('A');
    expect(row(view).querySelector('[inert]')).toBeNull();
    expect(row(view).querySelector('[class*="grid-rows"]')).toBeNull();
  });

  it('hands bodyClassName to the primary target and keeps the classes it needs to fill the row', () => {
    const view = render(
      <List>
        <Row href="/templates/1" title="Welcome" bodyClassName="flex-wrap gap-y-1" />
      </List>,
    );
    const link = view.getByRole('link');
    expect(link.className).toContain('flex-wrap');
    expect(link.className).toContain('gap-y-1');
    expect(link.className).toContain('flex-1');
  });

  it('stays open and reachable while leaving is false', () => {
    const view = render(
      <List>
        <Row href="/templates/1" title="Welcome" leaving={false} />
      </List>,
    );
    const track = row(view).firstElementChild as HTMLElement;
    expect(track.className).toContain('grid-rows-[1fr]');
    expect(track.className).toContain('motion-reduce:transition-none');
    expect(row(view).querySelector('[inert]')).toBeNull();
    expect(row(view).querySelector('[aria-hidden="true"]')).toBeNull();
    expect(row(view).className).not.toContain('opacity-0');
    expect(view.getByRole('link', { name: 'Welcome' })).toBeTruthy();
  });

  it('closes up when leaving turns true, and takes its content out of the tab order and the accessibility tree', () => {
    const view = render(
      <List>
        <Row href="/templates/1" title="Welcome" leaving={false} />
      </List>,
    );
    const link = view.getByRole('link', { name: 'Welcome' });

    view.rerender(
      <List>
        <Row href="/templates/1" title="Welcome" leaving />
      </List>,
    );

    const track = row(view).firstElementChild as HTMLElement;
    expect(track.className).toContain('grid-rows-[0fr]');
    expect(track.className).toContain('duration-base');
    expect(row(view).className).toContain('opacity-0');
    const clip = track.firstElementChild as HTMLElement;
    expect(clip.getAttribute('aria-hidden')).toBe('true');
    expect(clip.hasAttribute('inert')).toBe(true);
    // The same link, not a new one: closing the row must not remount what is in it.
    expect(row(view).querySelector('a')).toBe(link);
    expect(view.queryByRole('link', { name: 'Welcome' })).toBeNull();
  });
});
