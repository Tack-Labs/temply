# e2e

Playwright, against a stack Playwright starts itself: a fakes server (Stripe,
ImageKit, Resend), the API on a fresh SQLite, and the built client. The
stack takes its own ports (client 9101, API 3101, fakes 3999, Stripe 3998)
and builds the client into `client/.next-e2e` rather than `.next`, so a dev
checkout on 9000/3001 is left alone, including the build it serves from.

## Run

    bun run e2e                                      # everything, both Chromium projects
    bun run e2e -- --project=phone-chromium specs/editor-phone.e2e.ts
    bun run e2e:ui                                   # Playwright UI mode

First time: `bun run --filter @temply/e2e install-browsers`, and create
`e2e/.env` with the Clerk dev keys and the two test users:

    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…
    CLERK_SECRET_KEY=sk_test_…
    E2E_USER_EMAIL=e2e@…
    E2E_USER_PASSWORD=…
    E2E_USER_2_EMAIL=e2e-2@…
    E2E_USER_2_PASSWORD=…

Both users exist on the Clerk dev instance with password sign-in. The
secret key has to be a dev-instance one (`sk_test_`): setup refuses any
other, since it writes memberships and roles through Clerk's backend API.

### Test data

Setup signs in the first user, makes their own "e2e first workspace" the
active one (created through Clerk's backend API on the first run, and never
whichever workspace Clerk last remembered for them), and puts it on
Enterprise through the app's checkout and a forged
`checkout.session.completed` — every spec seeds into it and both browser
projects run at once, so it needs the plan with no ceilings. The second
user is a member of that workspace and the admin of "e2e second
workspace"; setup makes both once and never removes them, since Clerk keeps
them across runs and the app's database does not, and it puts a role back
if someone changed it by hand in the Clerk dashboard. `e2e/.auth/workspaces.json` carries the ids, and
`fixtures/workspaces.ts` reads them; `fixtures/session.ts` signs the second
user into either workspace in a context of its own.

`billing.e2e.ts` and `brands-default.e2e.ts` run on desktop only, and
serially, because they move workspace-wide state: a plan change or a new
default brand would be seen by every test running beside them.

The stack inherits the shell environment plus `server/.env` and
`client/.env` (Bun and Next load them from their working directories);
`stackEnv()` in `env.ts` overrides everything that has to agree between
the API and the client.

Spec files end in `.e2e.ts`, not `.spec.ts`: Bun's own runner collects
`*.spec.ts` from anywhere in the repo, and a Playwright file loaded that way
throws before its first test. `bun run typecheck` from the root covers this
package too.

### Clerk dev instance

Two dashboard settings the suite depends on, both of which have stopped a
run before:

- The test users' passwords must not appear in a breach list. Clerk rejects
  a compromised password at sign-in, and `clerk.signIn` reports it as a
  generic failure.
- Client trust must be off for the dev instance (Configure → Attack
  protection). With it on, a fresh browser context is challenged on every
  sign-in and the setup project cannot get past it.

## CI

`.github/workflows/ci.yml` runs the suite as the `Browser tests` job on
pushes to `main` and `feature/**`, and on every pull request, alongside the
typecheck-and-build job. It reads six repository secrets:

    E2E_CLERK_PUBLISHABLE_KEY
    E2E_CLERK_SECRET_KEY
    E2E_USER_EMAIL
    E2E_USER_PASSWORD
    E2E_USER_2_EMAIL
    E2E_USER_2_PASSWORD

On failure the job uploads the screenshots under `test-results/` and the
HTML report as the `playwright` artifact, kept for three days. Traces and
video are not uploaded: they record every request with its headers, which
means the test user's Clerk session, and the repository is public. To get a
trace, reproduce the failure locally: outside CI a retry records one, and
`bun run e2e -- --retries=1 --trace on` forces one.

`Browser tests` should be a required check in the branch protection for
`main`; that is a repository setting, so it needs an admin.

## Rules

- Locate by role, label or text. The editor is the exception, and the list of
  exceptions is closed — anything not on it needs a role, a label or a new
  entry here with its reason:
  - `.ProseMirror` — the canvas is a contenteditable and ProseMirror's class
    names are its contract, `.ProseMirror-selectednode` included: a node
    selection is a state of the document, and nothing else says it happened.
  - `#slash-command` — the block panel is a tippy popup with no role and no
    name, and the id is the product's own handle on it.
  - `.tippy-box` — every bubble menu is re-parented into one, and it is the
    element that carries `data-placement` and the box an anchoring assertion
    measures.
  - `[inert]` — the phone's bar keeps all four faces mounted and marks the
    three that are down `inert`; Playwright's role engine is blind to it, so
    `phone.live` excludes them by selector or a control asserted visible
    would pass in every face.
  - `[data-editor-bottom-bar]` — the bar's controls share their names with
    the sheets that open above them, so the bar is what makes a name mean
    one of them.
  - `.node-variable`, `.mly-repeat-copy`, `[data-repeat-indicator]` and
    `div[data-maily-component="spacer"]` — those nodes carry no attribute of
    their own. `@tiptap/react` builds a pill's outer element itself and puts
    only that class on it; a Repeat's preview rows are `aria-hidden` by
    design, being a picture of repetition rather than places to type; the
    indicator is a `role="button"` among many; and a Spacer is a band of
    nothing with no `data-type` at all.

  Six of these are a product finding standing in for a role, and retiring the
  finding retires the hook: the slash panel and its "No result" panel have no
  role, name or `aria-activedescendant`; no bubble menu has a name; the
  Repeat indicator is a `role="button"` with no name at count 1; and the
  pill, the preview copies and the Spacer would each be reachable by role or
  attribute if the node view set one. `.ProseMirror`, `.tippy-box` and
  `[inert]` are not findings — they are the contract of a contenteditable, of
  the popup library, and of a tool limitation respectively.
- No `waitForTimeout`. Wait for a state with an assertion.
- Every test stands alone: it seeds through `api`, names data with `name()`,
  and the fixture deletes what it made.
- Assert what the customer sees or receives: content, a toast, the URL, or
  what a fake recorded (`fakes.requests('resend')`).
- A UI change ships with its spec case.

## Layout

    setup/     sign in once, save storageState; the plan, the second user,
               and one editor open so no spec meets the route cold
    fixtures/  test (name, api, fakes, coarse pointer), phone and editor helpers,
               the second user's session, the workspace ids, the phone predicate
    fakes/     the three fakes and their client
    specs/     one file per feature

The editor is covered twice because it is two products.
`editor-desktop.e2e.ts` asserts the slash menu, the bubble menus and the
keyboard, on `desktop-chromium` only; `editor-phone.e2e.ts` asserts the tap
model, the bar's faces, the sheets and the dock, on `phone-chromium` only.
Delete's escalation through wrappers is asserted on the phone because
`deleteBlock` is wired only to the phone's action bar — the desktop's delete
paths remove exactly the block.
