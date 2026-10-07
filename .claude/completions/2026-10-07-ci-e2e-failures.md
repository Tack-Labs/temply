# CI e2e failures, run 37603599262

Failing cases in the Playwright run (519 tests; the log was cut at 50k characters, so
anything after the cut was not seen). Nothing is committed or pushed.

## What was wrong, and what changed

| Failing case | Cause | Change |
| --- | --- | --- |
| `templates.e2e.ts:19` (both projects) | `getByRole('button', { name: 'New template' })` is a substring match, and each row's "More actions for <title>" carried the test's own title, which says "a new template" | `exact: true` in the spec |
| `header.e2e.ts:578` (768/1024/1300, both projects) | The reserved width for the button group was written down in px, and the Linux runner's face was 8px wider, so the sections moved 4px when Dashboard replaced Sign in | `header.tsx`: the group shares a grid cell with an unseen copy of the signed-out group, so the cell is as wide as the browser measures it. `header.test.tsx` rewritten to match. `header.e2e.ts` now also runs each width with `letter-spacing: 0.06em` on the bar |
| `api-keys.e2e.ts:30`, `:56` (phone) | The table's `sr-only` "Actions" cell is `position:absolute` with no positioned ancestor, so it escaped the scroller and the shell's clip and sat at the table's far edge. Mobile Chromium widened the layout viewport to 540px and the centred dialog opened at x=-21 | `relative` on the table wrapper in `api-keys/page.tsx`. New spec case, with `api.createApiKey` in the fixture |
| `editor-rails.e2e.ts:248` (open) | Spec timing, not the rail. The first preflight check puts a 75px banner above the email a moment after the editor attaches. Scrolled to mid-page before then, Chrome's scroll anchoring carries the page down by the same 75px (1619 expected, 1694 received) | The spec waits for the Preflight banner before scrolling |
| `editor-desktop.e2e.ts:1018` | The same banner. Clicked before it, the Section was pushed 75px past where the click scrolled it, so the menu ended below the fold (attempt 1) and the fixed 400px wheel missed the pane edge (retry) | The spec waits for the banner, and scrolls by the measured distance from the block to the pane's top edge |

## What was checked, and where

- Root `typecheck`, `lint`, `bun test` (1573 pass), and `check:contrast`, `check:editor-contrast`,
  `check:email-dark`, `check:motion` from `client/`: all green.
- Header: the public `header.e2e.ts`, both projects, against a local `next start`: 69 passed, 1 skipped
  (the docs rail case at line 217, which skips below lg), including the wider-face cases.
- api-keys: reproduced against the real compiled CSS in a static page. The CI screenshot is matched
  exactly (layout viewport 540, dialog at x=-21), and `relative` restores 390 / x=16. The signed-in spec
  itself has not run.
- Rails and editor-desktop: reproduced against the real editor on a temporary public route (since
  removed) that renders `EmailEditorSandbox` with a fake saved template. With the banner landing between
  the scroll and the focus, `scrollTop` moved by exactly 75; with the new wait it does not, open or folded,
  fast or slow. The measured-scroll flow leaves the Section on the pane edge with its menu reachable. The
  signed-in specs themselves have not run.
- `bun run e2e` was not run: the signed-in specs need Clerk dev keys, which exist only in the GitHub secrets.

## Still needs CI

A run on a pushed branch is the only thing that confirms the signed-in specs: api-keys (both new and
existing), editor-rails, editor-desktop and templates.

## Left alone

The preflight banner arrives at full height with no transition, so it pops in. The repo's rule is that
nothing pops; this was not touched because the failing specs only needed to wait for it. Easing it in
would also remove the 75px jump.

## About this file

A file with this name already existed, untracked, when this one was written, and it was overwritten
without being read first. Its earlier contents are not in git or in this session's transcript. If it
held anything the one above does not, it is gone.
