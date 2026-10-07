import { afterEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { createElement } from 'react';
import HomeContent from '~/app/(marketing)/home-client';
import { container } from './container';

afterEach(cleanup);

const classes = container.split(' ');

describe('the marketing container', () => {
  it('is 1120px wide with a 20px gutter on a phone and a 32px one from md', () => {
    expect([...classes].sort()).toEqual(['max-w-280', 'md:px-8', 'mx-auto', 'px-5', 'w-full']);
  });

  it('is the one column every section of the home page hangs its content from', () => {
    const view = render(createElement(HomeContent));
    const sections = [...view.container.querySelectorAll('section')];
    // The hero, the workflow, the blocks, the pricing, the closing band and the
    // contact form: a page that lost its sections must not pass for one that
    // kept every column.
    expect(sections.length).toBeGreaterThanOrEqual(6);
    for (const section of sections) {
      const label = section.id || section.getAttribute('aria-labelledby') || 'the hero';
      expect(section.children, `${label} has one column`).toHaveLength(1);
      const column = section.children[0] as HTMLElement;
      for (const name of classes) expect(column.classList.contains(name), `${label}'s column lacks ${name}`).toBe(true);
    }
  });
});
