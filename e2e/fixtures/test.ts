import { test as base, expect } from '@playwright/test';
import { RUN_ID } from '../env';
import { fakes } from '../fakes/client';

type Fixtures = {
  /** Names the data a test makes: `e2e <runId> · <title>`. */
  name: (what: string) => string;
  fakes: typeof fakes;
};

export const test = base.extend<Fixtures>({
  name: async ({}, use, testInfo) => {
    await use((what) => `e2e ${RUN_ID} · ${testInfo.title} · ${what}`.slice(0, 80));
  },
  fakes: async ({}, use) => {
    await fakes.reset();
    await use(fakes);
  },
});

export { expect };
