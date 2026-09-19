import { afterEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { Badge, EmptyState, ErrorState, StatTile } from './surfaces';

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

const Icon = ({ className }: { className?: string }) => <svg aria-hidden="true" className={className} />;

describe('EmptyState', () => {
  it('says what is missing, and offers the action as part of the state', () => {
    const view = render(
      <EmptyState icon={Icon} title="No templates yet" description="Make one to see it here." action={<button type="button">New template</button>} />,
    );
    expect(view.getByText('No templates yet')).toBeTruthy();
    expect(view.getByText('Make one to see it here.')).toBeTruthy();
    expect(view.getByRole('button', { name: 'New template' })).toBeTruthy();
  });
});

describe('ErrorState', () => {
  it('is not an empty state: it names the failure, and retries only when it can', () => {
    const view = render(<ErrorState description="The server did not answer." />);
    expect(view.getByText('Could not load this')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Try again' })).toBeNull();

    const onRetry = mock(() => {});
    view.rerender(<ErrorState title="Templates did not load" description="The server did not answer." onRetry={onRetry} />);
    expect(view.getByText('Templates did not load')).toBeTruthy();
    view.getByRole('button', { name: 'Try again' }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('Badge', () => {
  it('speaks each severity through its own tokens, never a colour of its own', () => {
    const view = render(
      <>
        <Badge>Draft</Badge>
        <Badge tone="danger">2 errors</Badge>
        <Badge tone="success">Published</Badge>
      </>,
    );
    expect(view.getByText('Draft').className).toContain('text-muted');
    expect(view.getByText('2 errors').className).toContain('bg-danger-wash');
    expect(view.getByText('2 errors').className).toContain('text-danger-ink');
    expect(view.getByText('Published').className).toContain('bg-success-wash');
  });
});

describe('StatTile', () => {
  it('puts the label above the value', () => {
    const view = render(<StatTile label="Templates" value={3} />);
    const label = view.getByText('Templates');
    const value = view.getByText('3');
    expect(label.compareDocumentPosition(value) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
