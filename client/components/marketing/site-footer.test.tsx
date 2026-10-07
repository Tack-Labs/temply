import { afterEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { container } from '~/components/marketing/container';
import { SiteFooter } from './site-footer';

afterEach(cleanup);

describe('the site footer', () => {
  it('hangs from the shared column the header and the sections use', () => {
    const view = render(<SiteFooter />);
    const row = view.getByRole('contentinfo').firstElementChild as HTMLElement;
    for (const token of container.split(' ')) expect(row.className.split(/\s+/)).toContain(token);
  });

  it('offers the six links, in order, each a 44px target', () => {
    const view = render(<SiteFooter />);
    const links = Array.from(view.getByRole('navigation', { name: 'Site links' }).querySelectorAll('a'));
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Docs', '/docs'],
      ['Try the editor', '/playground'],
      ['Pricing', '/#pricing'],
      ['Contact', '/#contact'],
      ['Terms', '/terms'],
      ['Privacy', '/privacy'],
    ]);
    for (const link of links) expect(link.className.split(/\s+/)).toContain('min-h-11');
  });

  it('sets its words in 15px muted, each link on a pill that fills on hover', () => {
    const view = render(<SiteFooter />);
    const row = view.getByRole('contentinfo').firstElementChild as HTMLElement;
    expect(row.className.split(/\s+/)).toEqual(expect.arrayContaining(['text-ui', 'text-muted']));
    const [first] = Array.from(view.getByRole('navigation', { name: 'Site links' }).querySelectorAll('a'));
    expect(first.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['rounded-full', 'hover:bg-hover', 'hover:text-ink']),
    );
  });

  it('carries the copyright for the current year', () => {
    const view = render(<SiteFooter />);
    expect(view.getByText(`© ${new Date().getFullYear()} Temply`)).toBeTruthy();
  });
});
