import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.LAZARUS_E2E_BASE_URL || 'http://127.0.0.1:4174',
    browserName: 'chromium',
    headless: true,
    launchOptions: process.env.LAZARUS_E2E_CHROME
      ? { executablePath: process.env.LAZARUS_E2E_CHROME }
      : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
