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
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
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
      // Same double-sign-in reason as desktop-chromium above.
      testIgnore: /setup\//,
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
      // build, so the build runs with the same env as the server.
      command: `bun run build && bunx next start -p ${PORTS.client}`,
      cwd: join(root, 'client'),
      url: BASE_URL,
      env,
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
