import { defineConfig, devices } from '@playwright/test';
import { join } from 'node:path';
import { BASE_URL, API_URL, FAKES_URL, PORTS, stackEnv } from './env';
import { STORAGE_STATE } from './setup/storage-state';

const root = join(import.meta.dirname, '..');
const env = stackEnv();

export default defineConfig({
  testDir: '.',
  testMatch: ['specs/**/*.e2e.ts', 'setup/**/*.setup.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  // The first test in each CI worker meets a cold production server; the
  // default 5 s is enough locally and short of it there.
  expect: { timeout: process.env.CI ? 10_000 : 5_000 },
  // CI records neither a trace nor video: the HTML reporter copies every
  // attachment into the report that is uploaded as an artifact, and a trace
  // carries the test user's session cookies. A failure that needs one is
  // reproduced locally.
  use: {
    baseURL: BASE_URL,
    trace: process.env.CI ? 'off' : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'off' : 'on-first-retry',
  },
  projects: [
    // Runs once, before either browser project: signs in through Clerk and
    // saves the result as storageState for both to start from.
    { name: 'setup', testMatch: /setup\/.*\.setup\.ts/ },
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1300, height: 900 }, storageState: STORAGE_STATE },
      dependencies: ['setup'],
      // editor-phone specs (Task 5) assert phone-only layout and must never
      // run at desktop width. /setup/ is excluded too: the top-level
      // testMatch also matches *.setup.ts, so without this every browser
      // project would additionally collect the setup file as one of its own
      // tests and sign in a second time.
      testIgnore: [/setup\//, /editor-phone/],
    },
    {
      name: 'phone-chromium',
      // iPhone 14: 390px, touch, the mobile UA. Chromium rather than WebKit
      // per commit; WebKit joins in the nightly tier.
      use: { ...devices['iPhone 14'], defaultBrowserType: 'chromium', storageState: STORAGE_STATE },
      dependencies: ['setup'],
      // Same double-sign-in reason as desktop-chromium above. The stack
      // check has no viewport to assert and runs once, on desktop. Billing
      // and brand defaults move workspace-wide state and run serially on
      // one project. The desktop editor spec asserts the slash menu, the
      // bubble menus and the keyboard, none of which the phone shell
      // renders.
      testIgnore: [/setup\//, /specs\/stack\.e2e\.ts$/, /specs\/billing\.e2e\.ts$/, /specs\/brands-default\.e2e\.ts$/, /specs\/editor-desktop\.e2e\.ts$/],
    },
  ],
  webServer: [
    {
      // Started first: the API's requests to Stripe and ImageKit need this
      // listening before the API itself does.
      command: 'bun fakes/index.ts',
      cwd: import.meta.dirname,
      url: `${FAKES_URL}/__health`,
      env,
      reuseExistingServer: false,
      timeout: 15_000,
    },
    {
      // PORT steers the Elysia listener onto the e2e stack's own port so the
      // dev server already running on 3001 is left alone.
      command: 'bun src/index.ts',
      cwd: join(root, 'server'),
      url: `${API_URL}/api/health`,
      env: { ...env, PORT: String(PORTS.api) },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // Built once, served with `next start`: NEXT_PUBLIC_* is baked at
      // build, so the build runs with the same env as the server. The build
      // goes into its own directory (next.config reads NEXT_DIST_DIR) so it
      // never overwrites the `.next` a dev server on 9000 is serving from,
      // and build-client.ts puts back the two files Next rewrites for it.
      command: `bun ../e2e/build-client.ts && bunx next start -p ${PORTS.client}`,
      cwd: join(root, 'client'),
      url: BASE_URL,
      env: { ...env, NEXT_DIST_DIR: '.next-e2e' },
      reuseExistingServer: false,
      // A cold `next build` on a shared CI runner can take most of five
      // minutes; the job has the headroom.
      timeout: 600_000,
    },
  ],
});
