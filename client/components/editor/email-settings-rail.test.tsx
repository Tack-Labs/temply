import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { useState } from 'react';
import type { PreflightIssue } from '@temply/shared/preflight';
import type { SettingsRailModel } from './email-settings-rail';

// Bun shares one module registry across test files and `mock.module` outlives
// the file that made it, so the real module is put back afterwards. The brand
// panel reads the workspace's brands over the network and is not what is under
// test here.
const realThemePanel = { ...(await import('../template-theme-panel')) };
mock.module('../template-theme-panel', () => ({
  ...realThemePanel,
  TemplateThemePanel: () => <div data-testid="theme-panel">Brand</div>,
}));
afterAll(() => {
  mock.module('../template-theme-panel', () => realThemePanel);
});
const { EmailSettingsRail } = await import('./email-settings-rail');

afterEach(cleanup);

const error = (id: string): PreflightIssue => ({ id, severity: 'error', message: id });
const warn = (id: string): PreflightIssue => ({ id, severity: 'warn', message: id });

const setPreflightExpanded = mock((_: unknown) => {});
const beforeStage = mock(async () => false);
beforeEach(() => {
  setPreflightExpanded.mockClear();
  beforeStage.mockClear();
});

function modelWith(overrides: Partial<SettingsRailModel> = {}): SettingsRailModel {
  return {
    template: { id: 'tpl_1', short_code: 'abc123' } as SettingsRailModel['template'],
    readOnly: false,
    subject: 'Welcome',
    setSubject: () => {},
    previewText: 'Thanks for joining',
    setPreviewText: () => {},
    fromName: 'Temply',
    setFromName: () => {},
    to: 'to@example.com',
    setTo: () => {},
    replyTo: '',
    setReplyTo: () => {},
    theme: {},
    setTheme: () => {},
    beforeStage,
    preflight: { issues: [], bytes: null },
    preflightChecked: true,
    preflightExpanded: false,
    setPreflightExpanded,
    ...overrides,
  };
}

/** The parent's half of the contract: it owns whether the rail is collapsed. */
function Harness({
  model = modelWith(),
  startCollapsed = false,
  onToggle,
  onOpenPreflight,
}: {
  model?: SettingsRailModel;
  startCollapsed?: boolean;
  onToggle?: () => void;
  onOpenPreflight?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(startCollapsed);
  const [animate, setAnimate] = useState(false);
  return (
    <EmailSettingsRail
      model={model}
      collapsed={collapsed}
      animate={animate}
      onOpenPreflight={onOpenPreflight}
      onToggle={() => {
        onToggle?.();
        setAnimate(true);
        setCollapsed((current) => !current);
      }}
    />
  );
}

const field = (view: ReturnType<typeof render>, id: string) => view.container.querySelector(`#${id}`) as HTMLInputElement;

// Under happy-dom React does not hear an `input` event; it reads a field's
// value on focus and on key release instead, so a typed change is a focus, the
// value arriving, and a key coming up (see template-list.test.tsx).
const type = (input: HTMLInputElement, value: string) => {
  fireEvent.focusIn(input);
  fireEvent.input(input, { target: { value } });
  fireEvent.keyUp(input, { key: 'x' });
};

describe('EmailSettingsRail, open', () => {
  it('is the Email settings landmark, with a collapse button that says it is expanded on the left of the title', () => {
    const view = render(<Harness />);
    const rail = view.getByRole('complementary', { name: 'Email settings' });
    const heading = within(rail).getByRole('heading', { level: 2, name: 'Email settings' });
    const collapse = within(rail).getByRole('button', { name: 'Collapse email settings panel' });
    expect(collapse.getAttribute('aria-expanded')).toBe('true');
    expect(collapse.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the five fields under the ids the specs and the labels use', () => {
    const view = render(<Harness />);
    for (const [id, label] of [
      ['subject', 'Subject'],
      ['fromName', 'From name'],
      ['to', 'To'],
      ['replyTo', 'Reply to'],
      ['previewText', 'Inbox preview text'],
    ] as const) {
      const input = view.getByLabelText(new RegExp(`^${label}`));
      expect(input.id).toBe(id);
    }
    expect(field(view, 'subject').value).toBe('Welcome');
    expect(field(view, 'to').type).toBe('email');
    expect(field(view, 'replyTo').type).toBe('email');
  });

  it('writes what is typed back to the model', () => {
    const setSubject = mock((_: string) => {});
    const setPreviewText = mock((_: string) => {});
    const view = render(<Harness model={modelWith({ setSubject, setPreviewText })} />);
    type(field(view, 'subject'), 'Hello');
    type(field(view, 'previewText'), 'A line');
    expect(setSubject).toHaveBeenCalledWith('Hello');
    expect(setPreviewText).toHaveBeenCalledWith('A line');
  });

  it('describes the preview text field with the helper under it', () => {
    const view = render(<Harness />);
    const helper = view.getByText('The grey line after the subject in most inboxes.');
    expect(field(view, 'previewText').getAttribute('aria-describedby')).toBe(helper.id);
  });

  it('locks the template-owned fields when read only, and leaves the test-send ones open', () => {
    const view = render(<Harness model={modelWith({ readOnly: true })} />);
    expect(field(view, 'subject').readOnly).toBe(true);
    expect(field(view, 'previewText').readOnly).toBe(true);
    // Addressing a test send is still allowed in a read-only workspace.
    for (const id of ['fromName', 'to', 'replyTo']) expect(field(view, id).readOnly).toBe(false);
    expect(view.getByTestId('theme-panel').closest('fieldset')?.disabled).toBe(true);
  });

  it('leaves the brand panel live when the workspace is not read only', () => {
    const view = render(<Harness />);
    expect(view.getByTestId('theme-panel').closest('fieldset')?.disabled).toBe(false);
  });

  it('offers to connect the app only once the template has a short code', () => {
    const view = render(<Harness />);
    expect(view.getByText('Ready to use this email?')).toBeTruthy();
    cleanup();
    const without = render(<Harness model={modelWith({ template: { id: 'tpl_1' } as SettingsRailModel['template'] })} />);
    expect(without.queryByText('Ready to use this email?')).toBeNull();
    cleanup();
    expect(render(<Harness model={modelWith({ template: undefined })} />).queryByText('Ready to use this email?')).toBeNull();
  });

  it('saves before it leaves for the connect steps', async () => {
    const view = render(<Harness />);
    const link = view.getByRole('link', { name: 'Connect your app →' });
    expect(link.getAttribute('href')).toBe('/templates/tpl_1/connect');
    await act(async () => {
      fireEvent.click(link);
    });
    expect(beforeStage).toHaveBeenCalledTimes(1);
  });
});

describe('EmailSettingsRail, status', () => {
  const card = (view: ReturnType<typeof render>) => view.getByText('0 errors · 0 warnings', { exact: false }).closest('[data-status]') as HTMLElement;
  const open = (view: ReturnType<typeof render>) => view.getByRole('complementary', { name: 'Email settings' });

  it('says it is checking, in no severity tone and with no counts, until the first check has completed', () => {
    const view = render(<Harness model={modelWith({ preflightChecked: false })} />);
    const status = view.getByText('Checking').closest('[data-status]') as HTMLElement;
    expect(status.getAttribute('data-status')).toBe('checking');
    expect(status.className).toContain('bg-sunken');
    for (const wash of ['bg-success-wash', 'bg-warn-wash', 'bg-danger-wash']) expect(status.className).not.toContain(wash);
    // An empty list that nothing has measured is not a clean bill.
    expect(view.queryByText('All clear')).toBeNull();
    expect(view.queryByText(/\berrors?\b/)).toBeNull();
    expect(view.queryByText(/\bwarnings?\b/)).toBeNull();
    // Not a control, and not the success check either: a spinner that holds still for reduced motion.
    expect(within(status).queryByRole('button')).toBeNull();
    const icon = status.querySelector('svg') as SVGElement;
    expect(icon.getAttribute('class')).toContain('animate-spin');
    expect(icon.getAttribute('class')).toContain('motion-reduce:animate-none');
    expect(icon.getAttribute('class')).not.toContain('lucide-check');
  });

  it('holds the card where it is while it waits, so the verdict does not move it', () => {
    const view = render(<Harness model={modelWith({ preflightChecked: false })} />);
    const status = view.getByText('Checking').closest('[data-status]') as HTMLElement;
    // The counts line is a placeholder as tall as the line it stands for
    // (22px: a 14px bar and 4px above and below), not an empty gap.
    const bar = status.querySelector('[aria-hidden="true"].animate-pulse') as HTMLElement;
    expect(bar).toBeTruthy();
    expect(bar.className).toContain('h-3.5');
    expect(bar.className).toContain('my-1');
    expect(bar.className).toContain('motion-reduce:animate-none');
  });

  it('is the same card, fading its wash, when the first verdict arrives', () => {
    const view = render(<Harness model={modelWith({ preflightChecked: false })} />);
    const waiting = view.getByText('Checking').closest('[data-status]') as HTMLElement;
    view.rerender(<Harness model={modelWith({ preflightChecked: true, preflight: { issues: [warn('a')], bytes: null } })} />);
    const done = view.getByText('0 errors · 1 warning').closest('[data-status]') as HTMLElement;
    // The element survives, so the browser has a colour to transition from.
    expect(done).toBe(waiting);
    expect(done.getAttribute('data-status')).toBe('warn');
    expect(done.className).toContain('bg-warn-wash');
    expect(done.className).toContain('transition-colors');
    expect(done.className).toContain('motion-reduce:transition-none');
    expect(view.queryByText('Checking')).toBeNull();
  });

  it('says all clear in the success tone, and is not a control when there is nothing to open', () => {
    const view = render(<Harness />);
    const status = card(view);
    expect(status.getAttribute('data-status')).toBe('success');
    expect(status.className).toContain('bg-success-wash');
    expect(within(status).getByText('All clear')).toBeTruthy();
    expect(within(status).getByText('0 errors · 0 warnings')).toBeTruthy();
    expect(within(status).queryByRole('button')).toBeNull();
  });

  it('counts a single warning in the singular, in the warn tone', () => {
    const view = render(<Harness model={modelWith({ preflight: { issues: [warn('a')], bytes: null } })} />);
    const status = view.getByText('0 errors · 1 warning').closest('[data-status]') as HTMLElement;
    expect(status.getAttribute('data-status')).toBe('warn');
    expect(status.className).toContain('bg-warn-wash');
    expect(within(status).getByText('Worth a look')).toBeTruthy();
  });

  it('counts several warnings in the plural', () => {
    const view = render(<Harness model={modelWith({ preflight: { issues: [warn('a'), warn('b')], bytes: null } })} />);
    expect(view.getByText('0 errors · 2 warnings')).toBeTruthy();
  });

  it('is the danger tone for any error, and counts both kinds', () => {
    const issues = [error('a'), warn('b'), warn('c')];
    const view = render(<Harness model={modelWith({ preflight: { issues, bytes: null } })} />);
    const status = view.getByText('1 error · 2 warnings').closest('[data-status]') as HTMLElement;
    expect(status.getAttribute('data-status')).toBe('danger');
    expect(status.className).toContain('bg-danger-wash');
    expect(within(status).getByText('Needs fixing')).toBeTruthy();
  });

  it('uses the one tone for the one job: only an error is danger, only a warning is warn', () => {
    const tones = [
      [[], 'bg-success-wash'],
      [[warn('a')], 'bg-warn-wash'],
      [[error('a')], 'bg-danger-wash'],
    ] as const;
    for (const [issues, expected] of tones) {
      const view = render(<Harness model={modelWith({ preflight: { issues: [...issues], bytes: null } })} />);
      const status = open(view).querySelector('[data-status]') as HTMLElement;
      const washes = ['bg-success-wash', 'bg-warn-wash', 'bg-danger-wash'].filter((wash) => status.className.includes(wash));
      expect(washes).toEqual([expected]);
      cleanup();
    }
  });

  it('is a disclosure for the preflight panel once there is something to list', () => {
    const view = render(<Harness model={modelWith({ preflight: { issues: [warn('a')], bytes: null } })} />);
    const button = within(open(view)).getByRole('button', { name: /Worth a look/ });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    // The panel is the canvas's, so the card's name must not be one the
    // panel's own header answers to.
    expect(button.textContent?.startsWith('Preflight')).toBe(false);
    fireEvent.click(button);
    expect(setPreflightExpanded).toHaveBeenCalledTimes(1);
    const update = setPreflightExpanded.mock.calls[0][0] as (current: boolean) => boolean;
    expect(update(false)).toBe(true);
    expect(update(true)).toBe(false);
  });

  it('asks for the panel to be brought into view when the card opens it', () => {
    const onOpenPreflight = mock(() => {});
    const view = render(
      <Harness model={modelWith({ preflight: { issues: [warn('a')], bytes: null } })} onOpenPreflight={onOpenPreflight} />,
    );
    fireEvent.click(within(open(view)).getByRole('button', { name: /Worth a look/ }));
    expect(onOpenPreflight).toHaveBeenCalledTimes(1);
    expect(setPreflightExpanded).toHaveBeenCalledTimes(1);
  });

  it('leaves the canvas where it is when the card closes the panel', () => {
    const onOpenPreflight = mock(() => {});
    const view = render(
      <Harness
        model={modelWith({ preflight: { issues: [warn('a')], bytes: null }, preflightExpanded: true })}
        onOpenPreflight={onOpenPreflight}
      />,
    );
    fireEvent.click(within(open(view)).getByRole('button', { name: /Worth a look/ }));
    expect(onOpenPreflight).not.toHaveBeenCalled();
    expect(setPreflightExpanded).toHaveBeenCalledTimes(1);
  });

  it('reflects the panel being open on its button', () => {
    const view = render(<Harness model={modelWith({ preflight: { issues: [error('a')], bytes: null }, preflightExpanded: true })} />);
    expect(within(open(view)).getByRole('button', { name: /Needs fixing/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('transitions its colour when the tone changes, without waiting on a rail toggle', () => {
    const view = render(<Harness />);
    const status = card(view);
    expect(status.className).toContain('transition-colors');
    expect(status.className).toContain('motion-reduce:transition-none');
  });
});

describe('EmailSettingsRail, collapsed', () => {
  const strip = (view: ReturnType<typeof render>) => within(view.getByRole('complementary', { name: 'Email settings' }));

  it('shows the strip, whose button says it is collapsed, and hides the panel from the tree', () => {
    const view = render(<Harness startCollapsed />);
    const expand = strip(view).getByRole('button', { name: 'Expand email settings panel' });
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    expect(strip(view).queryByRole('button', { name: 'Collapse email settings panel' })).toBeNull();
    expect(strip(view).queryByRole('textbox')).toBeNull();
    const hidden = view.container.querySelectorAll('[aria-hidden="true"][inert]');
    expect(hidden.length).toBe(1);
    expect(hidden[0].querySelector('#subject')).toBeTruthy();
  });

  it('keeps the strip inert and out of the tree while the panel is open', () => {
    const view = render(<Harness />);
    const face = view.container.querySelector('[inert]') as HTMLElement;
    expect(face.getAttribute('aria-hidden')).toBe('true');
    expect(face.querySelector('[aria-label="Expand email settings panel"]')).toBeTruthy();
    expect(strip(view).queryByRole('button', { name: 'Expand email settings panel' })).toBeNull();
  });

  it('has the one chip, named for what it holds', () => {
    const view = render(<Harness startCollapsed />);
    const names = strip(view).getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    expect(names).toEqual(['Expand email settings panel', 'Email settings: subject, sender and preview text']);
  });

  it('opens the panel from the chip and puts focus in the subject', () => {
    const toggled = mock(() => {});
    const view = render(<Harness startCollapsed onToggle={toggled} />);
    act(() => strip(view).getByRole('button', { name: 'Email settings: subject, sender and preview text' }).click());
    expect(toggled).toHaveBeenCalledTimes(1);
    expect(strip(view).getByRole('button', { name: 'Collapse email settings panel' })).toBeTruthy();
    expect(document.activeElement).toBe(field(view, 'subject'));
  });

  it('puts a dot for the status at the foot of the strip, announced from the same counts', () => {
    const view = render(<Harness startCollapsed />);
    const dot = strip(view).getByRole('img');
    expect(dot.getAttribute('aria-label')).toBe('All clear, 0 errors, 0 warnings');
    expect(dot.className).toContain('bg-success-wash');
  });

  it('is a neutral dot named Checking until the first check has completed, then takes the verdict', () => {
    const view = render(<Harness startCollapsed model={modelWith({ preflightChecked: false })} />);
    const waiting = strip(view).getByRole('img');
    expect(waiting.getAttribute('aria-label')).toBe('Checking');
    expect(waiting.className).toContain('bg-sunken');
    for (const wash of ['bg-success-wash', 'bg-warn-wash', 'bg-danger-wash']) expect(waiting.className).not.toContain(wash);
    view.rerender(<Harness startCollapsed model={modelWith({ preflightChecked: true })} />);
    const done = strip(view).getByRole('img');
    expect(done).toBe(waiting);
    expect(done.getAttribute('aria-label')).toBe('All clear, 0 errors, 0 warnings');
    expect(done.className).toContain('bg-success-wash');
    expect(done.className).toContain('transition-colors');
  });

  it('keeps the expand button\'s focus ring inside the pinned box, as the left strip does', () => {
    const view = render(<Harness startCollapsed />);
    const expand = strip(view).getByRole('button', { name: 'Expand email settings panel' });
    // Padding on the strip around a `sticky top-0` box leaves the box flush to
    // the scrollport once pinned, and the 5px ring is clipped at its edge.
    const pinned = expand.closest('.sticky') as HTMLElement;
    expect(pinned.className).toContain('top-0');
    expect(pinned.className).toContain('pt-5');
    expect((pinned.parentElement as HTMLElement).className).not.toContain('pt-5');
  });

  it('turns the dot to the tone of what is found', () => {
    const warned = render(<Harness startCollapsed model={modelWith({ preflight: { issues: [warn('a'), warn('b')], bytes: null } })} />);
    const warnDot = strip(warned).getByRole('img');
    expect(warnDot.getAttribute('aria-label')).toBe('Worth a look, 0 errors, 2 warnings');
    expect(warnDot.className).toContain('bg-warn-wash');
    cleanup();
    const failed = render(<Harness startCollapsed model={modelWith({ preflight: { issues: [error('a')], bytes: null } })} />);
    const failDot = strip(failed).getByRole('img');
    expect(failDot.getAttribute('aria-label')).toBe('Needs fixing, 1 error, 0 warnings');
    expect(failDot.className).toContain('bg-danger-wash');
  });
});

describe('EmailSettingsRail, toggling', () => {
  it('moves focus to the equivalent control after each toggle', () => {
    const view = render(<Harness />);
    const rail = within(view.getByRole('complementary', { name: 'Email settings' }));
    const collapse = rail.getByRole('button', { name: 'Collapse email settings panel' });
    collapse.focus();
    act(() => collapse.click());
    expect(document.activeElement).toBe(rail.getByRole('button', { name: 'Expand email settings panel' }));
    act(() => (document.activeElement as HTMLElement).click());
    expect(document.activeElement).toBe(rail.getByRole('button', { name: 'Collapse email settings panel' }));
  });

  it('does not fade the faces until the reader has toggled', () => {
    const view = render(<Harness startCollapsed />);
    const faces = () => [...view.getByRole('complementary', { name: 'Email settings' }).children] as HTMLElement[];
    expect(faces().some((face) => face.className.includes('transition-opacity'))).toBe(false);
    fireEvent.click(view.getByRole('button', { name: 'Expand email settings panel' }));
    expect(faces().every((face) => face.className.includes('transition-opacity'))).toBe(true);
  });
});
