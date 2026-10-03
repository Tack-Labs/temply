# Temply redesign handoff — 3 October 2026

Continued Claude session `e42b29c6-1537-44d0-a778-f3cdac7ea33e`, which stopped during the final marketing review fixes. The approved scope is the marketing site, dashboard, templates and editor chrome, friendlier fonts, and improved SEO. Existing work is preserved in the working tree.

## Changes completed during the handoff

- Finished verification of the interrupted reveal, contact feedback, pricing bounds, clipped-content checks and colour guards. Corrected the reveal's initial geometry on rectangular viewports: IntersectionObserver percentage margins use root width, including vertical margins ([specification](https://www.w3.org/TR/intersection-observer/#intersectionobserver-root-intersection-rectangle)). Added portrait and landscape regression cases.
- Made the theme toggle's accessible name stable (`Dark theme`), with `aria-pressed` expressing its state. Browser coverage checks both directions and persistence through reload.
- Made the home content and CSS showreel server components. Small client wrappers own reveal and parallax; the seat stepper, contact form and navigation retain their interactions. Home copy now describes transactional email templates and the rendering API.
- Added a shared footer outside `main`, with Docs, playground, pricing, contact, terms and privacy links on every marketing route.
- Added `SITE_NOINDEX=1` support to metadata and response headers, wired it into staging CI builds, and covered builds without `VERCEL_ENV`. Production canonicals stay pinned to the public origin. Restored `Disallow: /api/`, since deployed API traffic goes to a separate service.
- Simplified public structured data to WebPage; removed invisible breadcrumbs; added WebSite on the home page. The Team offer describes the free trial and overage using the same plan constants as the page.
- Set `en-GB`, added server-rendered playground introduction and links, removed its unnecessary dynamic override, and increased the PNG favicon to 48px.
- Re-rendered the brand PNGs from the cobalt vector mark and the 1200×630 social card using the app's self-hosted fonts. The social PNG is about 26 KB, down from about 637 KB. The existing WebP sample used inside email templates remains separate from the social PNG.

## Validation

| Check | Result |
| --- | --- |
| Root `bun test` | 915 passed, 0 failed; 93 files, 5 snapshots |
| Root `bun run lint` | Passed; existing Biome configuration deprecation info only |
| Client contrast, editor contrast, email dark and motion gates | All passed |
| Production build through the e2e stack | Passed |
| Public marketing, design, SEO and header specs, desktop and phone | 144 passed, 4 skipped, 14 failed |
| Root `bun run typecheck` | Client and e2e passed; 3 existing Stripe setup errors remain |
| Full `bun run e2e` | Clerk setup failed because credentials are empty; 354 cases did not run |
| `git diff --check` | Passed |

The 14 public failures are the same environment failures recorded by Claude: the crawler case expects a configured Clerk host, and six private-route noindex cases per browser project reach middleware without a publishable key. Every added UI/SEO case passes. The temporary public Playwright configuration was removed and the preview processes were stopped.

The standalone server-package test run loaded its local environment, reproduced Stripe authentication failures and stalled; it was stopped. The required root suite subsequently passed in full.

## Visual evidence

Inspected home, docs and playground at 390px and 1300px in both themes. Hero text pixel samples cleared their thresholds: smallest body-text ratio was 4.85:1 on desktop light and 4.88:1 on phone light; button text cleared 5.13:1. Four initial-load browser PerformanceObserver samples recorded zero layout shift and no page errors. These are local browser samples, not a Lighthouse report or field measurements.

- [Phone home, light](/tmp/temply-codex-review/home-390-light.png)
- [Desktop home, dark](/tmp/temply-codex-review/home-1300-dark.png)
- [Phone playground, light](/tmp/temply-codex-review/playground-390-light.png)
- [Social card](/tmp/temply-codex-review/social.png)
- [Measurements](/tmp/temply-codex-review/measurements.json)

## Remaining release verification

Implementation is ready for review; the repository's all-green release condition has not been met.

1. Fix the existing billing-script type errors in `server/scripts/stripe-setup.ts:61`, `:68` and `:73` in a separate billing change.
2. Populate the local Clerk development keys and test-user credentials described in `e2e/README.md`, then run the full suite. Authenticated dashboard, templates, editor and Clerk visuals are still unverified in a browser.
3. Verify the actual staging domain's noindex headers after deployment. The flag's metadata/header behavior and its CI configuration have been verified locally; no deployment or live staging change was made.

The earlier implementation's deliberate product decisions remain: theme-aware sidebar, confirmed permanent deletion, Published / Unpublished changes / Draft status vocabulary, Inter isolated to the email canvas, and no invented per-template check counts or “Needs a look” data.
