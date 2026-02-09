/**
 * Playwright Configuration for Visual Regression Testing
 *
 * Compares Bootstrap Modal vs Chakra UI Modal implementations
 * using Storybook as the rendering environment.
 *
 * Usage:
 *   1. Start Storybook: bun run storybook
 *   2. Run tests: bunx playwright test
 *   3. Update baselines: bunx playwright test --update-snapshots
 *
 * Task: biensperience-cd21
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual-regression',
  outputDir: './tests/visual-regression/test-results',
  snapshotDir: './tests/visual-regression/snapshots',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{arg}{ext}',

  /* Maximum time one test can run */
  timeout: 30_000,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Reporter */
  reporter: [
    ['html', { outputFolder: './tests/visual-regression/report', open: 'never' }],
    ['list']
  ],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL for Storybook */
    baseURL: process.env.STORYBOOK_URL || 'http://localhost:6006',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Screenshot settings for visual comparison */
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'chromium-tablet',
      use: {
        ...devices['iPad (gen 7)'],
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['iPhone 13'],
      },
    },
  ],

  /* Start Storybook before running tests (only on CI or if not already running) */
  webServer: process.env.CI ? {
    command: 'bun run storybook -- --ci',
    port: 6006,
    timeout: 120_000,
    reuseExistingServer: true,
  } : undefined,
});
