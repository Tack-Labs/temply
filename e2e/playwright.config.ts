import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';
import { BASE_URL, API_URL, PORTS, stackEnv } from './env';

loadEnv({ path: join(import.meta.dirname, '.env') });

const root = join(import.meta.dirname, '..');
const env = stackEnv();

export default defineConfig({
  testDir: '.',
  testMatch: ['specs/**/*.spec.ts', 'setup/**/*.setup.ts'],
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
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1300, height: 900 } } },
    {
      name: 'phone-chromium',
      // iPhone 14: 390px, touch, the mobile UA. Chromium rather than WebKit
      // per commit; WebKit joins in the nightly tier.
      use: { ...devices['iPhone 14'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: [
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
