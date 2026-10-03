import { afterEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { Skeleton, SkeletonList } from './skeleton';

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

describe('Skeleton', () => {
  it('is hidden from assistive tech, on a token surface, and still under reduced motion', () => {
    const view = render(<Skeleton data-testid="block" className="h-4 w-24" />);
    const block = view.getByTestId('block');
    expect(block.getAttribute('aria-hidden')).toBe('true');
    expect(block.className).toContain('bg-active');
    expect(block.className).toContain('rounded-md');
    expect(block.className).toContain('animate-pulse');
    expect(block.className).toContain('motion-reduce:animate-none');
    expect(block.className).toContain('h-4 w-24');
  });
});

describe('SkeletonList', () => {
  it('announces what is loading once, however many blocks it holds', () => {
    const view = render(
      <SkeletonList label="Loading templates">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </SkeletonList>,
    );
    const status = view.getByRole('status');
    expect(status.textContent).toBe('Loading templates');
    expect(view.getAllByText('Loading templates').length).toBe(1);
    expect(status.querySelector('.sr-only')?.textContent).toBe('Loading templates');
    expect(status.querySelectorAll('[aria-hidden="true"]').length).toBe(3);
  });
});
