# e2e

Playwright, against a stack Playwright starts itself: a fakes server (Stripe,
ImageKit, Resend), the API on a fresh SQLite, and the built client. The
stack takes its own ports (client 9101, API 3101, fakes 3999, Stripe 3998)
so a dev checkout on 9000/3001 is left alone.

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

Both users exist on the Clerk dev instance with password sign-in.

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
every push and pull request, alongside the typecheck-and-build job. It
reads six repository secrets:

    E2E_CLERK_PUBLISHABLE_KEY
    E2E_CLERK_SECRET_KEY
    E2E_USER_EMAIL
    E2E_USER_PASSWORD
    E2E_USER_2_EMAIL
    E2E_USER_2_PASSWORD

On failure the job uploads `test-results/` (traces, screenshots, video) and
the HTML report as the `playwright` artifact.

`Browser tests` should be a required check in the branch protection for
`main`; that is a repository setting, so it needs an admin.

## Rules

- Locate by role, label or text. `.ProseMirror` selectors are the one
  exception: the canvas is a contenteditable and its classes are its contract.
- No `waitForTimeout`. Wait for a state with an assertion.
- Every test stands alone: it seeds through `api`, names data with `name()`,
  and the fixture deletes what it made.
- Assert what the customer sees or receives: content, a toast, the URL, or
  what a fake recorded (`fakes.requests('resend')`).
- A UI change ships with its spec case.

## Layout

    setup/     sign in once, save storageState
    fixtures/  test (name, api, fakes, coarse pointer), phone helpers
    fakes/     the three fakes and their client
    specs/     one file per feature
