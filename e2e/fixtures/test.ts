import { test as base, expect } from '@playwright/test';
import { RUN_ID } from '../env';
import { fakes } from '../fakes/client';
import { makeApi } from './api';
import { emulateCoarsePointer } from './phone';

type Fixtures = {
  /** Names the data a test makes: `e2e <runId> · <project> · <title> · <what>`. */
  name: (what: string) => string;
  fakes: typeof fakes;
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
  // `what` is the part a test tells two of its names apart by, so it is
  // never cut: a long test title is what gives way, with an ellipsis. A
  // `what` so long that no title fits at all is a mistake in the test, and
  // is refused rather than quietly folded into a name another call could
  // also produce.
  name: async ({}, use, testInfo) => {
    await use((what) => {
      const head = `e2e ${RUN_ID} · ${testInfo.project.name} · `;
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
    if (testInfo.project.name.startsWith('phone')) await emulateCoarsePointer(page);
    await use(page);
  },
  fakes: async ({}, use) => {
    await fakes.reset();
    await use(fakes);
  },
  api: async ({ request }, use) => {
    const api = makeApi(request);
    await use(api);
    await api.cleanup();
  },
});

export { expect };
