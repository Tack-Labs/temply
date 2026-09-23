# temply

Bun monorepo (never npm/yarn). `client/` is Next.js 15 (dashboard behind
Clerk; tiptap editor core in `client/core/editor`; editing surface in
`client/components/email-editor-sandbox.tsx`). `server/` is an Elysia API on
:3001 with the renderer in `server/src/render/engine.tsx`. `shared/` holds
theme types, contrast maths and the preflight checks used by both.

Gates, all of them, before calling anything done: `bun run typecheck`,
`bun run lint`, `bun test` and `bun run e2e` from the root; `bun run check:contrast`,
`check:editor-contrast`, `check:email-dark` and `check:motion` from
`client/`. Then the spec is the test for UI: a change to something a
customer sees ships with its case in `e2e/specs`, and
`bun run e2e -- <spec>` is green before anything is called done.

## Two theme systems that never touch

The app UI themes through the `.dark` class and `--ds-*` tokens. The editor
canvas is painted from the template's `RendererThemeOptions` (inline styles
and `--mly-*` vars) and deliberately ignores app dark mode. Never wire one
into the other. Colours belong in the token layer, not in components — the
contrast gates exist because component-level colours shipped broken three
times.

## A component is finished UX, not a widget

The bar is "would a paying customer notice this was rushed". A control that
merely works is a proof of concept. Before a UI change is done:

- **Nothing pops.** Anything that appears, disappears or changes size
  transitions — height via the `grid-rows-[0fr]`→`[1fr]` pattern in
  `template-theme-panel.tsx`, entrances via opacity/transform, always with
  `motion-reduce:transition-none`. Timing comes from the tokens in
  `globals.css`: `duration-fast` for a colour under the pointer, `-base` for
  show/hide/lift, `-slow` for a long travel; `ease-out` to settle, `ease-in`
  to leave, `ease-spring` to pop. Never a number or a `cubic-bezier` in a
  class list — `check:motion` fails on it. Shadows run `xs`–`xl` by what
  sits at each rung (see the ladder comment in `globals.css`). A chevron
  that rotates but a body that snaps is still a snap.
- **Every state is designed**, not just the happy path: loading, empty,
  error (distinct from empty — see `ErrorState` in `ui/surfaces.tsx`),
  disabled, and the narrow viewport.
- **Severity speaks through tokens**: `danger` blocks, `warn` deserves a
  look, `accent` is interactive/informational, `success` confirms. Don't
  make one colour do two of those jobs.
- **Reuse the vocabulary** before inventing: `Card`, `Badge`, `EmptyState`,
  `ErrorState`, `PageHeader` in `ui/surfaces.tsx`; `ConfirmDialog` for every
  destructive action; the `size-7` icon-button + `Popover` pairing in the
  Content header for auxiliary controls. A new pattern needs a reason the
  existing one can't serve.
- **Keyboard and screen readers get the same product**: `aria-expanded` on
  disclosures, `aria-label` on icon-only buttons, `aria-hidden` on collapsed
  content, visible focus from the global ring.
- **Copy is part of the design.** Plain verbs, sentence case, the same word
  for an action from button to toast. Counts and units beat sentences
  ("2 errors", "~5 KB of 102 KB") when the reader is scanning.

## Comments and commits

Comments state constraints the code can't show, in prose, matching the
repo's style; no change-log comments. Commits use a conventional-commit
prefix. Push is the user's call — never ask about it or run it.
