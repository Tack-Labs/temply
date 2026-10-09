import { afterEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { Badge, Card, EmptyState, ErrorState, lift, PageHeader, StatTile } from './surfaces';

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

  it('draws its icon on the accent wash in the accent ink, the pair the contrast gate holds, never the faint mark', () => {
    const view = render(<EmptyState icon={Icon} title="No templates yet" description="Make one to see it here." />);
    const tile = view.container.querySelector('svg')?.parentElement?.className.split(/\s+/) ?? [];
    for (const needed of ['bg-accent-wash', 'text-accent-ink', 'rounded-2xl']) expect(tile).toContain(needed);
    expect(view.container.innerHTML).not.toContain('text-faint');
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
    expect(card).toContain('rounded-card');
    expect(emptyBox).toContain('rounded-card');
    expect(errorBox).toContain('rounded-card');
    expect(emptyBox).not.toContain('rounded-lg');
    expect(errorBox).not.toContain('rounded-lg');
    expect(emptyBox).not.toContain('rounded-xl');
    expect(errorBox).not.toContain('rounded-xl');
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
    expect(retry.className).toContain('focus-visible:outline-focus');
    expect(retry.className.split(/\s+/), 'the default size is already past 44px').toContain('h-12');
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
      neutral: ['bg-track', 'text-muted'],
      lavender: ['bg-accent-wash', 'text-accent-ink'],
      mint: ['bg-success-wash', 'text-success-ink'],
      butter: ['bg-warn-wash', 'text-warn-ink'],
      rose: ['bg-danger-wash', 'text-danger-ink'],
      sky: ['bg-sky-wash', 'text-sky-ink'],
      peach: ['bg-peach-wash', 'text-peach-ink'],
      accent: ['bg-accent-wash', 'text-accent-ink'],
      success: ['bg-success-wash', 'text-success-ink'],
      warn: ['bg-warn-wash', 'text-warn-ink'],
      danger: ['bg-danger-wash', 'text-danger-ink'],
    } as const;
    for (const [tone, [wash, ink]] of Object.entries(tones)) {
      const view = render(<Badge tone={tone as keyof typeof tones}>{tone}</Badge>);
      const classes = view.getByText(tone).className;
      expect(classes).toContain('rounded-full');
      expect(classes).toContain('whitespace-nowrap');
      expect(classes).toContain(wash);
      expect(classes).toContain(ink);
      cleanup();
    }
  });
});

describe('Badge tones', () => {
  it('names the six pastels by hue, and keeps the severity names as the same colours', () => {
    const pairs = [
      ['lavender', 'accent'],
      ['mint', 'success'],
      ['butter', 'warn'],
      ['rose', 'danger'],
    ] as const;
    for (const [hue, severity] of pairs) {
      const byHue = render(<Badge tone={hue}>{hue}</Badge>).getByText(hue).className.split(/\s+/);
      cleanup();
      const bySeverity = render(<Badge tone={severity}>{severity}</Badge>).getByText(severity).className.split(/\s+/);
      cleanup();
      const colours = (classes: string[]) => classes.filter((name) => name.startsWith('bg-') || name.startsWith('text-')).sort();
      expect(colours(byHue), `${hue} and ${severity}`).toEqual(colours(bySeverity));
    }
  });

  it('gives sky and peach their own washes, which carry no verdict', () => {
    const sky = render(<Badge tone="sky">In staging</Badge>).getByText('In staging').className;
    expect(sky).toContain('bg-sky-wash');
    expect(sky).not.toMatch(/accent|success|warn|danger/);
    cleanup();
    const peach = render(<Badge tone="peach">Seasonal</Badge>).getByText('Seasonal').className;
    expect(peach).toContain('bg-peach-wash');
    expect(peach).not.toMatch(/accent|success|warn|danger/);
  });

  it('is neutral when no tone is given', () => {
    const classes = render(<Badge>Draft</Badge>).getByText('Draft').className.split(/\s+/);
    expect(classes).toContain('bg-track');
    expect(classes).toContain('text-muted');
  });
});

describe('Badge size', () => {
  it('is a 28px pill with 12px of side padding, 13px bold text and 8px between its dot and its label', () => {
    const classes = render(<Badge>Draft</Badge>).getByText('Draft').className.split(/\s+/);
    for (const needed of ['h-7', 'px-3', 'gap-2', 'text-sm', 'font-bold', 'inline-flex', 'items-center']) {
      expect(classes).toContain(needed);
    }
    expect(classes).not.toContain('px-2');
    expect(classes).not.toContain('font-medium');
  });

  it('lets a call site that wants a bigger pill say so', () => {
    const classes = render(<Badge className="px-3.5 text-base">Kicker</Badge>).getByText('Kicker').className.split(/\s+/);
    expect(classes).toContain('px-3.5');
    expect(classes).toContain('text-base');
    expect(classes).not.toContain('px-3');
    expect(classes).not.toContain('text-sm');
  });
});

describe('Badge dot', () => {
  // Opt-in, because Badge is also a label, a count and a section kicker, and a
  // dot says "status".
  it('is off unless asked for, so a count or a label does not claim a status', () => {
    const view = render(<Badge tone="success">Published</Badge>);
    expect(view.getByText('Published').querySelector('[aria-hidden]')).toBeNull();
  });

  it('draws a 6px dot in the badge\'s own ink, hidden from a screen reader, ahead of the label', () => {
    const view = render(<Badge tone="success" dot>Published</Badge>);
    const badge = view.getByText('Published');
    const dot = badge.firstElementChild as HTMLElement;
    expect(dot.getAttribute('aria-hidden')).toBe('true');
    const classes = dot.className.split(/\s+/);
    for (const needed of ['size-1.5', 'rounded-full', 'bg-current', 'shrink-0']) expect(classes).toContain(needed);
    // Whatever a screen reader says is the label alone.
    expect(badge.textContent).toBe('Published');
    expect(badge.firstChild).toBe(dot);
  });

  it('keeps every tone\'s wash and ink with a dot on, since the dot takes its colour from the ink', () => {
    const classes = render(<Badge tone="danger" dot>Sent back</Badge>).getByText('Sent back').className.split(/\s+/);
    expect(classes).toContain('bg-danger-wash');
    expect(classes).toContain('text-danger-ink');
  });
});

describe('Card', () => {
  it('is a padded raised panel on the card radius', () => {
    const view = render(<Card data-testid="card">Body</Card>);
    const classes = view.getByTestId('card').className;
    expect(classes).toContain('rounded-card');
    expect(classes).toContain('bg-raised');
    expect(classes).toContain('p-5.5');
    expect(classes).not.toContain('p-4');
    expect(classes).not.toContain('hover:-translate-y-0.5');
  });

  it('rests on its fill and its shadow rather than an outline, with a transparent border that a call site can colour', () => {
    const view = render(
      <>
        <Card data-testid="plain">Plain</Card>
        <Card data-testid="marked" className="border-accent">Marked</Card>
      </>,
    );
    const plain = view.getByTestId('plain').className.split(/\s+/);
    expect(plain).toContain('border');
    expect(plain).toContain('border-transparent');
    expect(plain).not.toContain('border-line');
    expect(plain).toContain('shadow-sm');
    // The api-keys page marks a fresh key with an accent border; it must survive.
    const marked = view.getByTestId('marked').className.split(/\s+/);
    expect(marked).toContain('border-accent');
    expect(marked).not.toContain('border-transparent');
  });

  it('keeps its hairline when the content brings its own padding, since that card holds a list or a form that needs the edge', () => {
    const classes = render(<Card inset={false} data-testid="flush">Flush</Card>).getByTestId('flush').className.split(/\s+/);
    expect(classes).toContain('border-line');
    expect(classes).not.toContain('border-transparent');
  });

  it('drops its padding when the content brings its own, and lifts only when it is a target', () => {
    const view = render(
      <>
        <Card data-testid="flush" inset={false}>Flush</Card>
        <Card data-testid="target" interactive>Target</Card>
      </>,
    );
    expect(view.getByTestId('flush').className).not.toContain('p-5.5');
    expect(view.getByTestId('target').className).toContain(lift);
  });

  it('is what a StatTile is made of', () => {
    const view = render(<StatTile label="Templates" value={3} interactive />);
    const tile = view.getByText('Templates').parentElement as HTMLElement;
    expect(tile.className).toContain('rounded-card');
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

describe('StatTile type and padding', () => {
  it('sets a 15px muted label over a 34px display value, in a card padded to 22px', () => {
    const view = render(<StatTile label="Templates" value={3} />);
    const label = view.getByText('Templates');
    expect(label.className.split(/\s+/)).toContain('text-ui');
    expect(label.className.split(/\s+/)).toContain('text-muted');
    const value = view.getByText('3').className.split(/\s+/);
    for (const needed of ['font-display', 'text-34', 'tabular-nums', 'text-ink']) expect(value).toContain(needed);
    const tile = label.parentElement as HTMLElement;
    expect(tile.className.split(/\s+/)).toContain('p-5.5');
    expect(tile.className.split(/\s+/)).not.toContain('p-3.5');
  });

  it('draws no bar unless it is given one', () => {
    const view = render(<StatTile label="Templates" value={3} />);
    expect(view.queryByRole('progressbar')).toBeNull();
  });
});

describe('StatTile bar', () => {
  const bar = (view: ReturnType<typeof render>) => view.getByRole('progressbar');
  const fill = (view: ReturnType<typeof render>) => bar(view).firstElementChild as HTMLElement;

  it('is a 10px pill track in the tone\'s wash with a fill in its solid colour, as wide as its value', () => {
    const view = render(<StatTile label="API calls" value="4,210" bar={{ value: 0.42 }} />);
    const track = bar(view).className.split(/\s+/);
    for (const needed of ['h-2.5', 'rounded-full', 'overflow-hidden', 'bg-accent-wash']) expect(track).toContain(needed);
    const classes = fill(view).className.split(/\s+/);
    for (const needed of ['h-full', 'rounded-full', 'bg-accent-ink']) expect(classes).toContain(needed);
    expect(fill(view).style.width).toBe('42%');
  });

  it('takes the success and peach tones from the same tokens as their badges', () => {
    const success = render(<StatTile label="Templates" value={6} bar={{ value: 0.6, tone: 'success' }} />);
    expect(bar(success).className).toContain('bg-success-wash');
    expect(fill(success).className.split(/\s+/)).toContain('bg-success');
    cleanup();
    const peach = render(<StatTile label="Storage" value="120 MB" bar={{ value: 0.12, tone: 'peach' }} />);
    expect(bar(peach).className).toContain('bg-peach-wash');
    expect(fill(peach).className.split(/\s+/)).toContain('bg-peach');
  });

  it('goes butter near a limit and rose at it, in the inks the contrast gate holds against the wash', () => {
    const warn = render(<StatTile label="API calls" value="9,100" bar={{ value: 0.91, tone: 'warn' }} />);
    expect(bar(warn).className).toContain('bg-warn-wash');
    expect(fill(warn).className.split(/\s+/)).toContain('bg-warn-ink');
    cleanup();
    const danger = render(<StatTile label="API calls" value="10,000" bar={{ value: 1, tone: 'danger' }} />);
    expect(bar(danger).className).toContain('bg-danger-wash');
    expect(fill(danger).className.split(/\s+/)).toContain('bg-danger-ink');
  });

  it('settles to a new value instead of snapping, and holds still for reduced motion', () => {
    const view = render(<StatTile label="API calls" value="4,210" bar={{ value: 0.42 }} />);
    const classes = fill(view).className.split(/\s+/);
    expect(classes).toContain('transition-[width]');
    expect(classes).toContain('duration-base');
    expect(classes).toContain('ease-out');
    expect(classes).toContain('motion-reduce:transition-none');
  });

  it('is a progressbar named by the tile\'s label, reading its value as a percentage', () => {
    const view = render(<StatTile label="API calls" value="4,210" bar={{ value: 0.42 }} />);
    expect(view.getByRole('progressbar', { name: 'API calls' })).toBeTruthy();
    expect(bar(view).getAttribute('aria-valuemin')).toBe('0');
    expect(bar(view).getAttribute('aria-valuemax')).toBe('100');
    expect(bar(view).getAttribute('aria-valuenow')).toBe('42');
    expect(bar(view).getAttribute('aria-valuetext')).toBeNull();
  });

  it('says what the number means when the caller gives words for it', () => {
    const view = render(<StatTile label="API calls" value="4,210" bar={{ value: 0.42, text: '4,210 of 10,000' }} />);
    expect(bar(view).getAttribute('aria-valuetext')).toBe('4,210 of 10,000');
  });

  it('keeps a value outside 0 to 1, or not a number, inside the track', () => {
    const over = render(<StatTile label="Over" value={12} bar={{ value: 1.4 }} />);
    expect(fill(over).style.width).toBe('100%');
    expect(bar(over).getAttribute('aria-valuenow')).toBe('100');
    cleanup();
    const under = render(<StatTile label="Under" value={0} bar={{ value: -0.2 }} />);
    expect(fill(under).style.width).toBe('0%');
    cleanup();
    const nan = render(<StatTile label="Nan" value={0} bar={{ value: Number.NaN }} />);
    expect(fill(nan).style.width).toBe('0%');
    expect(bar(nan).getAttribute('aria-valuenow')).toBe('0');
  });

  it('puts the bar under the value and the hint under the bar', () => {
    const view = render(<StatTile label="API calls" value="4,210" hint="Resets on the 1st" bar={{ value: 0.42 }} />);
    const value = view.getByText('4,210');
    const hint = view.getByText('Resets on the 1st');
    expect(value.compareDocumentPosition(bar(view)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bar(view).compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('StatTile hint', () => {
  it('takes markup as well as a sentence, so a note can carry its own severity and an aside', () => {
    const view = render(
      <StatTile
        label="API calls"
        value="9,100"
        hint={
          <>
            <span data-testid="note">900 left</span>
            <span data-testid="aside">Resets 1 Nov</span>
          </>
        }
      />,
    );
    expect(view.getByTestId('note').parentElement).toBe(view.getByTestId('aside').parentElement);
    expect(view.getByTestId('note').parentElement?.tagName).toBe('DIV');
  });

  it('keeps a plain sentence in the muted line it always had', () => {
    const view = render(<StatTile label="Members" value={3} hint="$5 each a month" />);
    const hint = view.getByText('$5 each a month');
    expect(hint.className.split(/\s+/)).toContain('text-muted');
    expect(hint.className.split(/\s+/)).toContain('text-base');
  });
});

describe('PageHeader', () => {
  it('sets the title at 34px, 44px from the small breakpoint up, over an 18px muted description', () => {
    const view = render(<PageHeader title="Templates" description="6 templates" />);
    const title = view.getByRole('heading', { level: 1, name: 'Templates' }).className.split(/\s+/);
    for (const needed of ['font-display', 'text-34', 'sm:text-4xl', 'text-ink']) expect(title).toContain(needed);
    const description = view.getByText('6 templates').className.split(/\s+/);
    expect(description).toContain('text-18');
    expect(description).toContain('text-muted');
  });

  it('shows its actions beside the title, and leaves the description out when there is none', () => {
    const view = render(<PageHeader title="Templates" actions={<button type="button">New template</button>} />);
    expect(view.getByRole('button', { name: 'New template' })).toBeTruthy();
    expect(view.container.querySelector('p')).toBeNull();
  });
});
