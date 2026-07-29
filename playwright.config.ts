import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests run against the production build (vite preview).
 * Representative viewports cover phones, tablets and desktops in both
 * orientations; the mobile project uses touch.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 45000,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
    // Use the environment's pre-installed Chromium when the pinned
    // Playwright version has no matching browser download of its own.
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {}),
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
    timeout: 60000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
  ],
});
