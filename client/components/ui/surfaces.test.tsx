import { afterEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { Badge, Card, EmptyState, ErrorState, lift, StatTile } from './surfaces';

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

describe('EmptyState and ErrorState radius', () => {
  // They stand where a Card would, so they take its corners rather than sit a
  // step tighter beside one.
  it('take the Card radius, not the smaller one a nested control uses', () => {
    const card = render(<Card>Body</Card>).getByText('Body').className;
    const empty = render(<EmptyState icon={Icon} title="No templates yet" />);
    const emptyBox = empty.getByText('No templates yet').closest('div[class*="rounded"]')?.className ?? '';
    const error = render(<ErrorState description="The server did not answer." />);
    const errorBox = error.getByText('Could not load this').closest('div[class*="rounded"]')?.className ?? '';
    expect(card).toContain('rounded-xl');
    expect(emptyBox).toContain('rounded-xl');
    expect(errorBox).toContain('rounded-xl');
    expect(emptyBox).not.toContain('rounded-lg');
    expect(errorBox).not.toContain('rounded-lg');
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

  it('retries with the shared Button, so it has its focus outline and its touch target', () => {
    const view = render(<ErrorState description="The server did not answer." onRetry={() => {}} />);
    const retry = view.getByRole('button', { name: 'Try again' });
    expect(retry.getAttribute('type')).toBe('button');
    expect(retry.className).toContain('focus-visible:outline-accent-ink');
    expect(retry.className).toContain('pointer-coarse:h-11');
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

describe('Badge shape', () => {
  it('is a pill that holds one line, and every tone keeps its wash and its ink', () => {
    const tones = {
      neutral: ['bg-hover', 'text-muted'],
      accent: ['bg-accent-wash', 'text-accent-ink'],
      success: ['bg-success-wash', 'text-success-ink'],
      warn: ['bg-warn-wash', 'text-warn-ink'],
      danger: ['bg-danger-wash', 'text-danger-ink'],
    } as const;
    for (const [tone, [wash, ink]] of Object.entries(tones)) {
      const view = render(<Badge tone={tone as keyof typeof tones}>{tone}</Badge>);
      const classes = view.getByText(tone).className;
      expect(classes).toContain('rounded-full');
      expect(classes).toContain('px-2');
      expect(classes).toContain('whitespace-nowrap');
      expect(classes).toContain(wash);
      expect(classes).toContain(ink);
      cleanup();
    }
  });
});

describe('Card', () => {
  it('is a padded raised panel on the card radius', () => {
    const view = render(<Card data-testid="card">Body</Card>);
    const classes = view.getByTestId('card').className;
    expect(classes).toContain('rounded-xl');
    expect(classes).toContain('bg-raised');
    expect(classes).toContain('p-4');
    expect(classes).not.toContain('hover:-translate-y-0.5');
  });

  it('drops its padding when the content brings its own, and lifts only when it is a target', () => {
    const view = render(
      <>
        <Card data-testid="flush" inset={false}>Flush</Card>
        <Card data-testid="target" interactive>Target</Card>
      </>,
    );
    expect(view.getByTestId('flush').className).not.toContain('p-4');
    expect(view.getByTestId('target').className).toContain(lift);
  });

  it('is what a StatTile is made of', () => {
    const view = render(<StatTile label="Templates" value={3} interactive />);
    const tile = view.getByText('Templates').parentElement as HTMLElement;
    expect(tile.className).toContain('rounded-xl');
    expect(tile.className).toContain(lift);
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
