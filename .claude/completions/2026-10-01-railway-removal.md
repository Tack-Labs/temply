# 2026-10-01 — webhook fix, Railway removal, sitemap history

Branch `fix/webhook-body-and-deploy-cleanup`, four commits off
`origin/main` (the last is this note), not pushed.

## Done

- **Webhooks.** The Stripe and Clerk routes set `parse: 'none'`. In
  Next's minified build Elysia read the body before the handler, so every
  webhook failed with "Body already used". This kept the e2e job red in CI
  and would have broken both webhooks on Vercel. `server/src/app.test.ts`
  builds the minified app and posts to both routes.
- **Railway.** Removed the Dockerfile, `railway.json`, `deploy/railway/`,
  the two ignore files, the CI syntax check, `make deploy` and
  `make logs`, `NEXT_OUTPUT=standalone` and the server's `build` script.
  The README's Railway section is gone. What was not Railway-specific
  moved into the Vercel section.
- **Sitemap dates.** The `deploy` job now fetches full history, because
  `vercel build` runs on the runner and `app/sitemap.ts` reads `git log`.

## Verified

- `bun run typecheck`, `bun run lint`, `bun test` (597 pass), and the
  four client gates: `check:contrast`, `check:editor-contrast`,
  `check:email-dark`, `check:motion`.
- `ci.yml` parses, with jobs `check`, `e2e` and `deploy`.

## Not verified

- `bun run e2e`: there are no Clerk keys locally, so it only runs in CI.
- The `deploy` job. No Vercel project exists in the `tack-labs` team, and
  GitHub has no Vercel secrets or `staging` environment yet.
- Staging search exclusion. Staging is a preview deployment on its own
  domain, and `app/robots.ts` has no staging rule. Vercel should send
  `X-Robots-Tag: noindex` for previews. Check it with `curl -I` after the
  first staging deploy.
- The search checks in the standards (title length, description length,
  one `h1`, canonical link, `x-robots-tag` on signed-in pages) are not
  audited in full. `e2e/specs/marketing.e2e.ts` covers JSON-LD, three page
  titles and the sitemap dates. Signed-in pages use a robots meta tag, not
  the header.

## Left in place

- `biome.json` still lists `deploy/**`. A hook blocks edits to that file.
  The glob matches nothing, so lint passes.
- `server/scripts/sqlite-to-postgres.ts`, for the cutover's data copy.
- The Railway service itself, until rollback is off the table
  (`handoff.md` §9).
