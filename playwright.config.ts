import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for LokulMem testing
 *
 * Provides:
 * - Browser-based integration testing
 * - Manual test page testing
 * - React demo app testing
 */
export default defineConfig({
  testDir: './tests/integration',

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests by default */
  workers: 1,

  /* Reporter to use */
  reporter: 'html',

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:8086',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'python3 -m http.server 8086',
    url: 'http://localhost:8086',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
