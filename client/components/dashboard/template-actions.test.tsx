import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { Slot } from '@radix-ui/react-slot';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useRef, useState } from 'react';

// Bun shares one process, and one module registry, across test files, and
// `mock.module` outlives the file that made it. Left in place, a stand-in
// below would be what every later file imports, and which files those are
// depends on the run order; so each is put back, as the module stood when
// this file loaded, once the file is done.

// The actions refresh the route once a request lands, and there is no app
// router here to ask. The router has to be replaced at the module: the hook
// reads it through next/navigation, and a context provider would lose to any
// stand-in that module already carries.
const refresh = mock(() => {});
const realNavigation = { ...(await import('next/navigation')) };
mock.module('next/navigation', () => ({ ...realNavigation, useRouter: () => ({ refresh }) }));

// The menu and the confirmation are Radix layers in a portal, which a mounted
// test cannot count on: Radix picks its layout-effect hook when it first
// loads, and theme-warnings.test.ts loads Popover ahead of every component
// test with no DOM yet, so a menu mounted here is empty or not depending on
// which file ran first (see dialog.test.tsx). What these stand-ins keep is
// the part the component depends on and owns the handling of: the menu closes
// when an item is chosen, then offers `onCloseAutoFocus` an event it may
// cancel, and puts focus back on the trigger unless it did. Escape, arrow keys
// and typeahead are Radix's own and are exercised by the templates spec. The
// trigger's `aria-haspopup` and `aria-expanded`, the menu's `role`, and its
// closing on Escape are the stand-in's, written to match Radix: a test that
// reads them is reading the stand-in, so those below say what the component
// owns instead (the one button, its name, the items, and what it does with the
// focus hand-back it is offered).
type MenuContext = { open: boolean; setOpen: (open: boolean) => void; trigger: React.RefObject<HTMLElement | null> };
const MenuContext = createContext<MenuContext | null>(null);
const menu = () => useContext(MenuContext)!;

/** The last close-auto-focus event the menu offered, so a test can see whether it was cancelled. */
let menuClosed: Event | null = null;
const realMenu = { ...(await import('~/components/ui/dropdown-menu')) };
mock.module('~/components/ui/dropdown-menu', () => ({
  ...realMenu,
  DropdownMenu: ({ children }: { children: React.ReactNode }) => {
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLElement | null>(null);
    return <MenuContext.Provider value={{ open, setOpen, trigger }}>{children}</MenuContext.Provider>;
  },
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => {
    const { open, setOpen, trigger } = menu();
    return (
      <Slot ref={trigger} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {children}
      </Slot>
    );
  },
  DropdownMenuContent: ({
    children,
    onCloseAutoFocus,
  }: {
    children: React.ReactNode;
    onCloseAutoFocus?: (event: Event) => void;
  }) => {
    const { open, setOpen, trigger } = menu();
    const closing = useRef(false);
    // Closing is what reports the focus hand-back, once the items have run.
    if (!open && closing.current) {
      closing.current = false;
      queueMicrotask(() => {
        const event = new Event('closeAutoFocus', { cancelable: true });
        onCloseAutoFocus?.(event);
        menuClosed = event;
        if (!event.defaultPrevented) trigger.current?.focus();
      });
    }
    if (open) closing.current = true;
    return open ? (
      <div role="menu" onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}>
        {children}
      </div>
    ) : null;
  },
  DropdownMenuItem: ({
    children,
    className,
    disabled,
    onSelect,
  }: {
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
    onSelect?: (event: Event) => void;
  }) => {
    const { setOpen } = menu();
    const select = () => {
      if (disabled) return;
      const event = new Event('menuSelect', { cancelable: true });
      onSelect?.(event);
      if (!event.defaultPrevented) setOpen(false);
    };
    return (
      <div
        role="menuitem"
        className={className}
        tabIndex={-1}
        aria-disabled={disabled || undefined}
        onClick={select}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') select();
        }}
      >
        {children}
      </div>
    );
  },
}));

// The stand-in lets the request finish on either side of the dialog releasing
// focus, as a real exit animation can, and counts only an open dialog: a
// closed one has nothing on the page to answer.
let deferConfirmationClose = false;
let finishConfirmationClose!: () => Event;
const realConfirmDialog = { ...(await import('~/components/ui/confirm-dialog')) };
mock.module('~/components/ui/confirm-dialog', () => ({
  ...realConfirmDialog,
  ConfirmDialog: ({
    title,
    description,
    onConfirm,
    onCloseAutoFocus,
    open,
    onOpenChange,
  }: {
    title: string;
    description: string;
    onConfirm: () => void;
    onCloseAutoFocus?: (event: Event) => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => {
    const close = () => {
      onOpenChange?.(false);
      finishConfirmationClose = () => {
        const event = new Event('closeAutoFocus', { cancelable: true });
        onCloseAutoFocus?.(event);
        return event;
      };
      if (!deferConfirmationClose) finishConfirmationClose();
    };
    return open ? (
      <div role="dialog" aria-label={title}>
        <p>{description}</p>
        <button type="button" onClick={close}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            close();
          }}
        >
          Delete
        </button>
      </div>
    ) : null;
  },
}));
afterAll(() => {
  mock.module('next/navigation', () => realNavigation);
  mock.module('~/components/ui/dropdown-menu', () => realMenu);
  mock.module('~/components/ui/confirm-dialog', () => realConfirmDialog);
});

const { TemplateActions } = await import('./template-actions');

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

const realFetch = globalThis.fetch;
let respond!: (response: Response) => void;
let requests: Array<{ url: string; method: string | undefined }> = [];

// Every request waits until the test says how it ends, so what the menu does
// in between can be looked at.
beforeEach(() => {
  refresh.mockClear();
  deferConfirmationClose = false;
  menuClosed = null;
  requests = [];
  globalThis.fetch = mock((url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), method: init?.method });
    return new Promise<Response>((resolve) => {
      respond = resolve;
    });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const ok = () => new Response(JSON.stringify({ template: { id: 'copy' } }), { status: 200 });
const refused = () => new Response(JSON.stringify({}), { status: 500 });

const setup = (props: Partial<React.ComponentProps<typeof TemplateActions>> = {}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TemplateActions templateId="t1" {...props} />
    </QueryClientProvider>,
  );

type View = ReturnType<typeof render>;
const trigger = (view: View) => view.getByRole('button', { name: /^More actions/ }) as HTMLButtonElement;
const openMenu = (view: View) => fireEvent.click(trigger(view));
const item = (view: View, name: string) => view.getByRole('menuitem', { name }) as HTMLElement;
const choose = (view: View, name: string) => {
  openMenu(view);
  fireEvent.click(item(view, name));
};
const confirm = (view: View) => fireEvent.click(view.getByRole('button', { name: 'Delete' }));
// The stand-in reports the menu's focus hand-back on a microtask, as Radix does
// after the content is gone.
const menuSettled = () => act(async () => { await Promise.resolve(); });

describe('TemplateActions menu', () => {
  it('is one ⋯ button, named for the template it acts on', () => {
    const view = setup({ templateTitle: 'Welcome email' });
    expect(view.getAllByRole('button')).toHaveLength(1);
    expect(view.getByRole('button', { name: 'More actions for Welcome email' })).toBeTruthy();
  });

  it('is the menu’s trigger, with its items as the menu’s content, closed until the button is pressed', () => {
    const view = setup({ templateTitle: 'Welcome email' });
    const button = view.getByRole('button', { name: 'More actions for Welcome email' });
    // `aria-haspopup`, `aria-expanded` and the menu role are drawn by the
    // stand-in. What this pins is the placement: the button sits in the
    // trigger and the items in the content, so pressing the button is what
    // brings them.
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(view.queryByRole('menu')).toBeNull();
    expect(view.queryAllByRole('menuitem')).toHaveLength(0);

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(view.getByRole('menu')).toBeTruthy();
    expect(view.getAllByRole('menuitem')).toHaveLength(2);
  });

  it('is named plainly when it has no title to carry', () => {
    expect(setup().getByRole('button', { name: 'More actions' })).toBeTruthy();
  });

  it('is a 44px target, on a fine pointer as well as a coarse one', () => {
    const classes = trigger(setup()).className;
    expect(classes).toContain('size-11');
    expect(classes).not.toContain('size-8 ');
  });

  it('offers Duplicate template and Delete template, the stems the specs and customers know', () => {
    const view = setup({ templateTitle: 'Welcome email' });
    openMenu(view);
    expect(item(view, 'Duplicate template')).toBeTruthy();
    expect(item(view, 'Delete template')).toBeTruthy();
    expect(view.getAllByRole('menuitem')).toHaveLength(2);
  });

  it('leaves out Duplicate once the plan cap is hit, and keeps Delete', () => {
    const view = setup({ canDuplicate: false });
    openMenu(view);
    expect(view.queryByRole('menuitem', { name: 'Duplicate template' })).toBeNull();
    expect(item(view, 'Delete template')).toBeTruthy();
  });

  it('sets Delete apart in the danger tokens, and lifts the items to 44px on touch', () => {
    const view = setup();
    openMenu(view);
    expect(item(view, 'Delete template').className).toContain('text-danger-ink');
    expect(item(view, 'Delete template').className).toContain('focus:bg-danger-wash');
    expect(item(view, 'Duplicate template').className).toContain('pointer-coarse:h-11');
    expect(item(view, 'Delete template').className).toContain('pointer-coarse:h-11');
  });

  it('lets the menu hand focus back to the button when it is dismissed without a choice', async () => {
    const view = setup();
    trigger(view).focus();
    openMenu(view);
    // The stand-in closes on Escape and moves focus when the offered event is
    // not cancelled; the component's part is not cancelling it unless Delete
    // was chosen. Radix's own Escape and focus return are the templates spec's.
    fireEvent.keyDown(view.getByRole('menu'), { key: 'Escape' });
    await menuSettled();
    expect(view.queryByRole('menu')).toBeNull();
    expect(menuClosed?.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(trigger(view));
  });
});

describe('TemplateActions duplicating', () => {
  it('makes the copy from the menu, shows the work on the button, and refreshes when it lands', async () => {
    const view = setup();
    choose(view, 'Duplicate template');
    await waitFor(() => expect(trigger(view).getAttribute('aria-busy')).toBe('true'));
    expect(requests).toEqual([{ url: '/api/v1/templates/t1/duplicate', method: 'POST' }]);
    expect(trigger(view).querySelector('svg.animate-spin')).not.toBeNull();
    expect(trigger(view).querySelector('svg.animate-spin')?.getAttribute('class')).toContain('motion-reduce:animate-none');
    expect(refresh).not.toHaveBeenCalled();

    respond(ok());
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(trigger(view).getAttribute('aria-busy')).toBeNull());
  });

  it('gives focus back to the button once the menu has closed on it', async () => {
    const view = setup();
    trigger(view).focus();
    choose(view, 'Duplicate template');
    await menuSettled();
    expect(menuClosed?.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(trigger(view));
  });

  it('keeps the button enabled while it works, and refuses a second request from the items', async () => {
    const view = setup();
    choose(view, 'Duplicate template');
    await waitFor(() => expect(trigger(view).getAttribute('aria-busy')).toBe('true'));
    expect(trigger(view).disabled).toBe(false);

    openMenu(view);
    expect(item(view, 'Duplicate template').getAttribute('aria-disabled')).toBe('true');
    expect(item(view, 'Delete template').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(item(view, 'Delete template'));
    fireEvent.click(item(view, 'Duplicate template'));
    expect(requests).toHaveLength(1);
    expect(view.queryByRole('dialog')).toBeNull();
  });

  it('gives the menu back when the copy fails, without refreshing a list that did not change', async () => {
    const view = setup();
    choose(view, 'Duplicate template');
    await waitFor(() => expect(trigger(view).getAttribute('aria-busy')).toBe('true'));
    respond(refused());
    await waitFor(() => expect(trigger(view).getAttribute('aria-busy')).toBeNull());
    openMenu(view);
    expect(item(view, 'Duplicate template').getAttribute('aria-disabled')).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('TemplateActions deleting', () => {
  it('asks first: choosing Delete opens the question and sends nothing', async () => {
    const view = setup();
    expect(view.queryByRole('dialog')).toBeNull();
    choose(view, 'Delete template');
    const dialog = view.getByRole('dialog', { name: 'Delete this template?' });
    expect(dialog.textContent).toContain('This cannot be undone.');
    expect(requests).toEqual([]);
  });

  it('does not take focus back to the button while the question is open', async () => {
    const view = setup();
    trigger(view).focus();
    choose(view, 'Delete template');
    await menuSettled();
    // The dialog owns focus; the menu's hand-back is cancelled so the button does not pull it away.
    expect(menuClosed?.defaultPrevented).toBe(true);
  });

  it('sends nothing and returns focus to the button when the question is cancelled', async () => {
    const view = setup();
    choose(view, 'Delete template');
    await menuSettled();
    document.body.focus();
    fireEvent.click(view.getByRole('button', { name: 'Cancel' }));
    expect(view.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger(view));
    expect(requests).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('forgets the question after a cancel, so a later Duplicate returns focus as usual', async () => {
    const view = setup();
    choose(view, 'Delete template');
    await menuSettled();
    fireEvent.click(view.getByRole('button', { name: 'Cancel' }));
    choose(view, 'Duplicate template');
    await menuSettled();
    expect(menuClosed?.defaultPrevented).toBe(false);
  });

  it('reports the delete as it moves, and shows the work on the button while it runs', async () => {
    const states: string[] = [];
    const view = setup({ onDeleteStateChange: (state) => states.push(state) });
    choose(view, 'Delete template');
    confirm(view);
    await waitFor(() => expect(trigger(view).getAttribute('aria-busy')).toBe('true'));
    expect(states).toEqual(['deleting']);
    expect(requests).toEqual([{ url: '/api/v1/templates/t1', method: 'DELETE' }]);

    respond(ok());
    await waitFor(() => expect(states).toEqual(['deleting', 'deleted']));
    // The row is told it is gone before the refresh takes it out of the list,
    // so it has a moment to close.
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('waits for the modal to release focus when deletion finishes before it closes', async () => {
    deferConfirmationClose = true;
    const states: string[] = [];
    const view = setup({ onDeleteStateChange: (state) => states.push(state) });
    choose(view, 'Delete template');
    confirm(view);
    await waitFor(() => expect(trigger(view).getAttribute('aria-busy')).toBe('true'));

    respond(ok());
    await waitFor(() => expect(trigger(view).getAttribute('aria-busy')).toBeNull());
    expect(states).toEqual(['deleting']);
    expect(refresh).not.toHaveBeenCalled();

    act(() => {
      expect(finishConfirmationClose().defaultPrevented).toBe(true);
    });
    expect(states).toEqual(['deleting', 'deleted']);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not put focus back on a button that is about to leave with its row', async () => {
    deferConfirmationClose = true;
    const view = setup();
    choose(view, 'Delete template');
    confirm(view);
    await waitFor(() => expect(trigger(view).getAttribute('aria-busy')).toBe('true'));
    respond(ok());
    await waitFor(() => expect(trigger(view).getAttribute('aria-busy')).toBeNull());
    document.body.focus();
    act(() => {
      finishConfirmationClose();
    });
    expect(document.activeElement).not.toBe(trigger(view));
  });

  it('hands focus back to the button when deletion fails before the modal closes', async () => {
    deferConfirmationClose = true;
    const states: string[] = [];
    const view = setup({ onDeleteStateChange: (state) => states.push(state) });
    choose(view, 'Delete template');
    confirm(view);
    await waitFor(() => expect(states).toEqual(['deleting']));

    respond(refused());
    await waitFor(() => expect(states).toEqual(['deleting', 'idle']));
    document.body.focus();
    act(() => {
      expect(finishConfirmationClose().defaultPrevented).toBe(true);
    });
    expect(document.activeElement).toBe(trigger(view));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('reports the template back as idle when the server refuses, and does not refresh', async () => {
    const states: string[] = [];
    const view = setup({ onDeleteStateChange: (state) => states.push(state) });
    choose(view, 'Delete template');
    confirm(view);
    await waitFor(() => expect(states).toEqual(['deleting']));
    respond(refused());
    await waitFor(() => expect(states).toEqual(['deleting', 'idle']));
    await waitFor(() => expect(trigger(view).getAttribute('aria-busy')).toBeNull());
    expect(refresh).not.toHaveBeenCalled();
  });
});
