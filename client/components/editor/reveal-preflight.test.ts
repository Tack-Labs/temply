import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { revealPreflight } from './reveal-preflight';

type Call = { target: Element; options: ScrollIntoViewOptions };
let calls: Call[] = [];
let reduced = false;
const realMatchMedia = window.matchMedia;

// happy-dom has no layout, so what is asserted is what the helper asks the
// browser for, and of which element.
beforeEach(() => {
  calls = [];
  reduced = false;
  Element.prototype.scrollIntoView = function (this: Element, options?: boolean | ScrollIntoViewOptions) {
    calls.push({ target: this, options: typeof options === 'object' ? options : {} });
  };
  window.matchMedia = ((query: string) =>
    ({ matches: reduced && query.includes('prefers-reduced-motion'), media: query }) as MediaQueryList) as typeof window.matchMedia;
});

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-smooth-scroll');
  window.matchMedia = realMatchMedia;
});

function canvas() {
  const section = document.createElement('section');
  section.innerHTML = `
    <div><button aria-expanded="false" id="not-in-the-article">Elsewhere</button></div>
    <article>
      <button type="button" aria-expanded="false" id="header">Preflight</button>
      <div><button type="button" aria-expanded="false" id="later">Later</button></div>
    </article>`;
  document.body.append(section);
  return section;
}

describe('revealPreflight', () => {
  it('brings the panel header into view and no further than it has to', () => {
    revealPreflight(canvas());
    expect(calls).toHaveLength(1);
    expect(calls[0].target.id).toBe('header');
    expect(calls[0].options.block).toBe('nearest');
  });

  it('jumps until the page has said it is ready to ease', () => {
    revealPreflight(canvas());
    expect(calls[0].options.behavior).toBe('auto');
  });

  it('eases once the page has raised its smooth-scroll flag', () => {
    document.documentElement.setAttribute('data-smooth-scroll', '');
    revealPreflight(canvas());
    expect(calls[0].options.behavior).toBe('smooth');
  });

  it('jumps under reduced motion, even with the flag up', () => {
    document.documentElement.setAttribute('data-smooth-scroll', '');
    reduced = true;
    revealPreflight(canvas());
    expect(calls[0].options.behavior).toBe('auto');
  });

  it('does nothing without a canvas, or without a header in it', () => {
    revealPreflight(null);
    const bare = document.createElement('section');
    bare.innerHTML = '<article><p>No findings</p></article>';
    revealPreflight(bare);
    expect(calls).toHaveLength(0);
  });
});
