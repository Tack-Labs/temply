# Temply staged release pipeline handoff — 5 October 2026

Continues the Claude session that designed the pipeline (Draft → Staging → Sign-off → Live) and the Codex session that built most of it and stopped at its last check pass. Nothing is committed; the work is in the tree. This pass verified the tree against every gate, fixed the defects an independent review found (each confirmed in code first), and brought the tests and the e2e spec in line.

## How the pipeline works

The stage is derived, never stored: `templateStage()` in `shared/stage.ts` reads `review_requested_at`, `staged_at`, `published_at` and whether the draft has moved past the published copy. Migration `server/drizzle/0001_stage_pipeline.sql` only adds ten nullable columns to `mails`, so rolling the app back needs no schema undo.

- `stage`, `unstage` and `request-signoff` are open to any member. `approve`, `send-back`, `rollback` and `publish` are admin only. Each of these writes runs under `SELECT … FOR UPDATE` (`underLock`), and the stamps come from `nextStamp()`/`stampAfter()` so a second instance's clock cannot reorder them.
- Publishing, approving and a member taking the copy back are the only things that drop a candidate; staging again replaces it.

## Changes completed during the handoff

- **Server:** added `POST /api/v1/templates/:id/unstage`, so a copy staged by mistake does not wait for an admin. It is open to any member, takes the request for sign-off with it, and leaves the draft and live copy alone (six cases). `GET /:id/versions` now filters by org as well as template id, with a cross-org test. The `stage` 409 message points to "remove the staged copy first".
- **Phone:** the staging card sat underneath the phone editor's fixed frame, so a phone user could not reach it. It is now a "Staging and sign-off" item in the ⋯ menu (with the stage as a badge) that opens a full-height sheet. The desktop card and the sheet share `TemplateWorkflowControls` and `TemplateCopyView`.
- **Editor:** "Edit draft" was a no-op on the template's own page; it is left out there (`inEditor`) and is a link elsewhere. "Move to staging", "Ask for sign-off" and "Update staged copy" are buttons; "Review" and "View sign-off" are links to `/templates/:id/review`. The copy switcher is a radio group (Draft / Staged copy / Live copy), with a copy that does not exist disabled. The preview card stays mounted while it collapses, so the height eases rather than snaps.
- **Remove staged copy:** a ghost button behind a `ConfirmDialog`. Its wording is captured when the dialog opens, because the row changes under it the moment the request lands.
- **Publish over a candidate:** an admin's Publish now asks first when a copy is staged or waiting, since publishing closes someone else's review. `ConfirmPublish` serves the desktop button and the phone menu item.
- **Review page:** one verb per action ("Send back" from opener to toast; "Approve" in the dialog; the "Approve and go live" button is unchanged). The decision card follows the stage: "Your decision" (admin, waiting), "Waiting for an admin" (member, waiting), "Not waiting for sign-off" (staged, nobody has asked). The rollback card says the old copy goes live as the next version, `v{live + 1}`, so the history stays in order. Counts are pluralised ("1 warning"), and findings are memoised on the rendered HTML.
- **Tests:** `template-workflow.test.tsx` (20 cases: editor stage, copy fallback, the next step as link or button, unstage, publish confirm, the controls), two new cases in `template-review.test.tsx`, and `template-list.test.tsx` updated for the link. `e2e/specs/signoff.e2e.ts` follows the new wording and the radio, reaches the controls through a new `openWorkflow`/`closeWorkflow` fixture (the page on desktop, the sheet on the phone), and gains two cases: taking a staged copy back, and publishing over a waiting copy.

## Pinning a published version through the API

Added after the pipeline, at the user's request: an app can name the version it renders, so when a shared template gains a required variable each app can add the value to its payload before switching over.

- **Request:** `POST /api/public/v1/templates/:shortCode/render` takes an optional `version` (a positive integer) beside `data`. Left out, the live copy renders as before. The render response, the metadata response and the list now carry `version`: the live version number, or `null` for a test key's draft.
- **Both key kinds can pin.** A pin is served from `template_versions`, scoped to the key's account like any other lookup. A test key can therefore check the next version with the draft or with a pin, and a live key moves from version 2 to 3 by changing one number.
- **Errors:** 404 for a number never made ("Version N does not exist. The newest is M.") or a template never published; 410 for a version that was pruned ("Version N was removed to make room for newer ones…"). Neither counts as a call. A pinned render that succeeds counts like any other.
- **Retention:** publishing, approving and rolling back keep the plan's newest versions (10, 50 with a template pack, 100 on Enterprise) and now also spare any version an API call pinned within `PINNED_VERSION_KEPT_DAYS` (30). `template_versions.pinned_at` is stamped by a pinned call at most once a day, so a version in use costs one write a day rather than one per render. Migration `0002_version_pinning.sql` adds the nullable column, so it is expand-only.
- **Where:** `server/src/lib/versions.ts` (the live-version subquery, `pinnedSince`, `notePin`), `pinnedCopy` and `resolve` in `server/src/routes/public.ts`, the prune in `snapshotVersion`, `gone()` in `server/src/lib/errors.ts`. Docs: a "Pin a version" section (`#api-versions`) in `api-reference.tsx`, the errors table, and a line in the History paragraph.
- **Tests:** `public.test.ts` ("pinning a version", including what an app's pin keeps) and `templates.test.ts` ("a version an app pins": a pin spared past the newest N, an expired one pruned, rollback numbering). `e2e/specs/api-keys.e2e.ts` has a live key pin an earlier version after the template moved on, and `header.e2e.ts` checks `#api-versions` clears the header.

Known edges:

- Protection starts with the first pinned call, so a version nobody has called yet can still be pruned.
- Spared versions are kept in addition to the newest N, so the dashboard history list can show more than N, while `version-history-dialog.tsx` still says "Only the last N are kept." Left as is; the copy is a little loose rather than wrong for most templates.
- A version from before the `theme` column has no theme and renders unthemed when pinned.

## Validation

| Check | Result |
| --- | --- |
| Root `bun run typecheck` | Client, server and e2e passed |
| Root `bun run lint` | Passed; the existing Biome configuration deprecation info only |
| Root `bun test` | 1061 passed, 0 failed; 103 files |
| `check:contrast`, `check:editor-contrast`, `check:email-dark`, `check:motion` | All passed |
| `bun run e2e -- signoff`, `bun run e2e -- api-keys` | **Did not run.** Postgres is not running locally, and `e2e/.env` and `client/.env` have empty Clerk keys and test-user credentials |

The e2e failure is the environment, not the code: the web server stops on `ECONNREFUSED 127.0.0.1:5432`, and even with `docker compose up -d` the signed-in setup needs the Clerk keys and `E2E_USER_*` credentials described in `e2e/README.md`. Nothing was bypassed.

## Not verified in a browser

Every signed-in case is unproven in a browser, including all of `signoff.e2e.ts`. Specifically unconfirmed: the phone sheet (More → "Staging and sign-off", the radio switcher and the dialogs inside it), toasts showing above that sheet, and whether the phone ⋯ menu stays open under the publish dialog (the spec presses Escape if it is, as with History, Delete and Share link). The earlier Codex browser evidence (`/tmp/temply-workflow-review/`) used a harness that bypassed the real editor shell, which is why it missed the phone defect.

## Remaining release verification

1. Populate the Clerk development keys and test-user credentials, start Postgres, and run `bun run e2e -- signoff`, then the full `bun run e2e`, on the desktop and phone projects.
2. Check `0001_stage_pipeline.sql` and `0002_version_pinning.sql` in a deploy. Both are expand-only, and CI fails a schema change without its migration file, so commit them with `shared/schema.ts`. The new `api-keys` and `header` cases need the same environment as signoff.
3. Decide the product questions below.

## Left as product decisions

- The first release cannot be pulled: there is no unpublish, and a rollback needs an earlier version to go back to.
- Rollback goes live as a new version (`v{live + 1}`) and offers the version before the current one, so a second rollback undoes the first and flips between two copies instead of stepping further back.
- A test API key serves the draft and a live key serves the published copy, so neither reaches a staged copy. It is previewed and test-sent from the dashboard only.
- `POST /templates/:id/discard` is the one pipeline write that reads and then updates without `underLock`. It predates this work and was left alone.
