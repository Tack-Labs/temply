import { test as base, expect } from '@playwright/test';
import { RUN_ID } from '../env';
import { fakes } from '../fakes/client';
import type { Recorded } from '../fakes/index';
import { makeApi } from './api';
import { emulateCoarsePointer } from './phone';
import { onPhone } from './project';

type Fixtures = {
  /** Names the data a test makes: `e2e <runId> · <project> [· r<retry>] · <title> · <what>`. */
  name: (what: string) => string;
  /** What this test may ask of the fakes: `requests` is scoped to the test,
   *  and `reset` is left off on purpose (see the fixture). */
  fakes: {
    requests: (service: 'stripe' | 'imagekit' | 'resend') => Promise<Recorded[]>;
    signStripeEvent: typeof fakes.signStripeEvent;
  };
  api: ReturnType<typeof makeApi>;
};

/** A cap for scanning, not the API's: a row a run leaves behind has to say
 *  which run, project and test left it at a glance in the templates list. */
const NAME_MAX = 80;

export const test = base.extend<Fixtures>({
  // The project is part of the name: both browser projects run the same
  // test against the same database at once, and a shared title would show
  // each run the other's rows.
  //
  // A retry is part of it too: a row the first attempt left behind would
  // otherwise answer to the second attempt's name.
  //
  // `what` is the part a test tells two of its names apart by, so it is
  // never cut: a long test title is what gives way, with an ellipsis. A
  // `what` so long that no title fits at all is a mistake in the test, and
  // is refused rather than quietly folded into a name another call could
  // also produce.
  name: async ({}, use, testInfo) => {
    await use((what) => {
      const attempt = testInfo.retry ? `r${testInfo.retry} · ` : '';
      const head = `e2e ${RUN_ID} · ${testInfo.project.name} · ${attempt}`;
      const tail = ` · ${what}`;
      const room = NAME_MAX - head.length - tail.length;
      if (room < 1) throw new Error(`name(${JSON.stringify(what)}) leaves no room for the test title in ${NAME_MAX} characters`);
      const title = testInfo.title.length > room ? `${testInfo.title.slice(0, room - 1)}…` : testInfo.title;
      return `${head}${title}${tail}`;
    });
  },
  // The iPhone descriptor gives the phone project touch and the viewport,
  // but not the media feature the editor's CSS and hooks key on; every page
  // the phone project opens gets it here.
  page: async ({ page }, use, testInfo) => {
    if (onPhone(testInfo)) await emulateCoarsePointer(page);
    await use(page);
  },
  // Every worker talks to the same fake process, so a reset here would wipe
  // what a test on another worker is about to read. Isolation is by time
  // instead: this test sees only what the fakes received once it began,
  // and matches on data it named rather than on counts.
  fakes: async ({}, use) => {
    const startedAt = Date.now();
    await use({ requests: (service) => fakes.requests(service, startedAt), signStripeEvent: fakes.signStripeEvent });
  },
  // Seeding goes through the page's own cookie jar, after one page load:
  // the session token saved by setup lives about a minute, and the
  // standalone `request` fixture starts from that stale copy and never
  // refreshes it, so a test that ran late in the suite was refused with a
  // 401 before it opened anything. A document request lets Clerk's
  // middleware hand the context a fresh token, and the open page keeps it
  // fresh from then on.
  api: async ({ page }, use) => {
    await page.goto('/');
    const api = makeApi(page.request);
    await use(api);
    await api.cleanup();
  },
});

export { expect };
