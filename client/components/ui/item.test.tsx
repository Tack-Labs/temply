import { afterEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { List, Row, Tile } from './item';

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

describe('Tile', () => {
  const tile = (view: ReturnType<typeof render>) => view.getByRole('listitem');

  it('sits on the card radius with its title at 18px bold and its subtitle at 15px', () => {
    const view = render(
      <ul>
        <Tile href="/brands/1" title="Acme" subtitle="Default brand" />
      </ul>,
    );
    const classes = tile(view).className.split(/\s+/);
    expect(classes).toContain('rounded-card');
    expect(classes).not.toContain('rounded-lg');
    const title = view.getByText('Acme').className.split(/\s+/);
    expect(title).toContain('text-18');
    expect(title).toContain('font-bold');
    const subtitle = view.getByText('Default brand').className.split(/\s+/);
    expect(subtitle).toContain('text-ui');
    expect(subtitle).toContain('text-muted');
  });

  it('lifts any button or link in its action slot to a 44px target, whatever size the caller gave it', () => {
    const view = render(
      <ul>
        <Tile
          href="/brands/1"
          title="Acme"
          meta="2 days ago"
          actions={
            <button type="button" aria-label="Delete Acme" className="size-7">
              x
            </button>
          }
        />
      </ul>,
    );
    const slot = view.getByRole('button', { name: 'Delete Acme' }).parentElement as HTMLElement;
    const classes = slot.className;
    expect(classes).toContain('min-h-11');
    expect(classes).toContain('min-w-11');
  });

  it('keeps its primary link\'s focus ring wholly inside the clipped corners', () => {
    const view = render(
      <ul>
        <Tile href="/brands/1" title="Acme" />
      </ul>,
    );
    const link = view.getByRole('link');
    expect(link.className).toContain('focus-visible:-outline-offset-3');
    expect(link.className).not.toContain('focus-visible:-outline-offset-2');
  });

  // The ring is drawn inside the link's box and the tile clips that box to
  // its rounded corners, so a link with square corners has its ring cut off
  // where the curve starts. The radius is the card's less its 1px border.
  it('curves its primary link to the card\'s inner radius, so the ring follows the clipped corners', () => {
    const view = render(
      <ul>
        <Tile href="/brands/1" title="Acme" meta="2 days ago" />
        <Tile href="/brands/2" title="Globex" />
      </ul>,
    );
    const [withFooter, bare] = view.getAllByRole('link');
    const top = 'rounded-t-[calc(var(--radius-card)-1px)]';
    const bottom = 'rounded-b-[calc(var(--radius-card)-1px)]';
    expect(withFooter?.className.split(/\s+/)).toContain(top);
    expect(bare?.className.split(/\s+/)).toContain(top);
    // The footer, not the link, meets the bottom edge when there is one.
    expect(withFooter?.className.split(/\s+/)).not.toContain(bottom);
    expect(bare?.className.split(/\s+/)).toContain(bottom);
  });

  it('curves a button primary target the same way', () => {
    const view = render(
      <ul>
        <Tile onClick={() => {}} primaryLabel="Use logo" title="Logo" />
      </ul>,
    );
    const classes = view.getByRole('button', { name: 'Use logo' }).className.split(/\s+/);
    expect(classes).toContain('rounded-t-[calc(var(--radius-card)-1px)]');
    expect(classes).toContain('rounded-b-[calc(var(--radius-card)-1px)]');
  });

  it('is still dashed and unresponsive while busy, and a button when it has an onClick', () => {
    const view = render(
      <ul>
        <Tile busy title="Uploading" subtitle="12 KB" />
        <Tile onClick={() => {}} primaryLabel="Use logo" title="Logo" />
      </ul>,
    );
    const [busy] = view.getAllByRole('listitem');
    expect(busy?.getAttribute('aria-busy')).toBe('true');
    expect(busy?.className).toContain('border-dashed');
    expect(view.getByRole('button', { name: 'Use logo' })).toBeTruthy();
  });
});

describe('List and Row sizing', () => {
  it('draws the list on the card radius', () => {
    const view = render(
      <List>
        <Row title="Welcome" />
      </List>,
    );
    const classes = view.getByRole('list').className.split(/\s+/);
    expect(classes).toContain('rounded-card');
    expect(classes).not.toContain('rounded-lg');
  });

  it('sets a row\'s title at 18px bold over a 15px muted subtitle, with room to breathe', () => {
    const view = render(
      <List>
        <Row href="/templates/1" title="Welcome" subtitle="Edited 2 hours ago" />
      </List>,
    );
    const title = view.getByText('Welcome').className.split(/\s+/);
    expect(title).toContain('text-18');
    expect(title).toContain('font-bold');
    const subtitle = view.getByText('Edited 2 hours ago').className.split(/\s+/);
    expect(subtitle).toContain('text-ui');
    expect(subtitle).toContain('text-muted');
    const link = view.getByRole('link').className.split(/\s+/);
    expect(link).toContain('px-4');
    expect(link).toContain('py-3');
  });

  // A row has no corners of its own; the list's are the ones that clip it, and
  // only the first row meets the top two and the last row the bottom two.
  it('curves a row\'s link to the list\'s inner radius at the corners its row is first or last at', () => {
    const view = render(
      <List>
        <Row href="/templates/1" title="Welcome" />
      </List>,
    );
    const item = view.getByRole('listitem');
    expect(item.className.split(/\s+/)).toContain('group/row');
    const classes = view.getByRole('link').className.split(/\s+/);
    expect(classes).toContain('group-first/row:rounded-t-[calc(var(--radius-card)-1px)]');
    expect(classes).toContain('group-last/row:rounded-b-[calc(var(--radius-card)-1px)]');
    // A row between others is never given a corner.
    expect(classes.filter((name) => /^rounded-/.test(name))).toEqual([]);
  });

  it('does the same inside the wrapper a leaving row gains', () => {
    const view = render(
      <List>
        <Row href="/templates/1" title="Welcome" leaving={false} />
      </List>,
    );
    expect(view.getByRole('listitem').className.split(/\s+/)).toContain('group/row');
    const classes = view.getByRole('link').className.split(/\s+/);
    expect(classes).toContain('group-first/row:rounded-t-[calc(var(--radius-card)-1px)]');
    expect(classes).toContain('group-last/row:rounded-b-[calc(var(--radius-card)-1px)]');
  });

  it('lifts a row\'s actions to 44px targets too, and keeps them outside the primary link', () => {
    const view = render(
      <List>
        <Row href="/templates/1" title="Welcome" actions={<button type="button">Delete</button>} />
      </List>,
    );
    const button = view.getByRole('button', { name: 'Delete' });
    expect(button.parentElement?.className).toContain('min-h-11');
    expect(button.parentElement?.className).toContain('min-w-11');
    expect(view.getByRole('link').contains(button)).toBe(false);
  });
});
