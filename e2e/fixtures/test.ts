import { test as base, expect } from '@playwright/test';
import { RUN_ID } from '../env';
import { fakes } from '../fakes/client';
import { makeApi } from './api';

type Fixtures = {
  /** Names the data a test makes: `e2e <runId> · <project> · <title> · <what>`. */
  name: (what: string) => string;
  fakes: typeof fakes;
  api: ReturnType<typeof makeApi>;
};

export const test = base.extend<Fixtures>({
  // The project is part of the name: both browser projects run the same
  // test against the same database at once, and a shared title would show
  // each run the other's rows.
  name: async ({}, use, testInfo) => {
    await use((what) => `e2e ${RUN_ID} · ${testInfo.project.name} · ${testInfo.title} · ${what}`.slice(0, 80));
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
