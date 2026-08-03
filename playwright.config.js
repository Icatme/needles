const { defineConfig, devices } = require('@playwright/test');

const port = Number(process.env.PORT || 4173);
const externalBaseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || '';
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;

const config = {
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    viewport: { width: 600, height: 800 },
    actionTimeout: 5_000,
    navigationTimeout: 15_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 600, height: 800 }
      }
    }
  ]
};

if (!externalBaseURL) {
  config.webServer = {
    command: `node scripts/serve-static.js ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000
  };
}

module.exports = defineConfig(config);
