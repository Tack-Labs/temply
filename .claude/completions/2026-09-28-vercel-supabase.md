# 2026-09-28 — Vercel + Supabase, the code half

Branch `feature/vercel-supabase`, uncommitted. Plan: `handoff.md`, whose
status line and checklists now say what's done.

## Done

- **Phase 2 (Postgres).**
  - `pg` + `drizzle-orm/node-postgres` rather than postgres.js, because
    `attachDatabasePool` is documented for `pg`. The pool is made lazily in
    `server/src/plugins/db.ts`, so nothing connects on import.
  - Schema moved to pg-core. Migrations live in `server/drizzle/` and are
    applied by `server/scripts/migrate.ts`.
  - RLS is on for all 12 tables.
  - `sqlite-to-postgres.ts` copies the SQLite data across, tested.
  - Tests run on PGlite. e2e makes a database per run (`e2e/database.ts`).
    `compose.yaml` provides Postgres 17.
- **Phase 3 (API in Next).**
  - `server/src/app.ts` is served in-process by `/api/[[...path]]`
    (`client/lib/call-api.ts`); `API_URL` sends calls to a standalone API.
  - Vercel Cron route `server/src/routes/cron.ts`, checked with
    `matchesSecret`.
  - Errors are reported through `@sentry/core`.
  - Images are capped at 4 MB, under Vercel's 4.5 MB body limit.
  - The rate limit keys on `x-forwarded-for`.
- **Phase 4 (the code).**
  - `client/vercel.json`: lhr1, the cron, and no Git deploys of main or
    staging.
  - `ci.yml`:
    - an e2e job on a postgres:17 service;
    - a drift check;
    - a Vercel deploy that builds, then migrates, then releases, then
      health-checks. It replaces the `container` and Railway `deploy`
      jobs.
  - `backup.yml` runs a nightly `pg_dump`, encrypts it with age and uploads
    it to S3/R2.
- **Docs.**
  - `.env.example`
  - README: Setup, the environment table, *Production on Vercel and
    Supabase*, Backups with the restore, and the Railway section kept until
    the cutover.
  - `CLAUDE.md`: expand, then contract.
  - `e2e/README.md`
  - handoff §§4–6, §9 and §12.

## Verified

- `bun run typecheck`, `bun run lint`, `bun test` (604 pass).
- `check:contrast`, `check:editor-contrast`, `check:email-dark`,
  `check:motion`.
- `db:generate` reports no schema changes.
- `next start` on Node: health, render, multipart, 413, the cron's 503, and
  the rate limit on XFF.
- A dump and restore round trip against a local Postgres. Both YAML files
  parse.

## Not verified

- `bun run e2e`: there are no Clerk keys locally.
- The deploy job, the backup upload, and anything on Vercel or Supabase.
- Supabase SSL with `pg`: `sslmode=require` means verify-full in
  pg-connection-string 2.14 (handoff §12).

## Notes

- The IDE flags path traversal in `e2e/database.ts` and the scripts, and SQL
  injection in the `CREATE/DROP DATABASE` identifiers. These are false
  positives. The paths are repository-relative constants. Database names go
  through `escapeIdentifier`, and the prefix lookup is parameterised.
- The e2e client port moved to 9300, because Flutter DevTools holds 9101 on
  this machine.
- `server/drizzle/` must be committed, or CI's drift check fails.
