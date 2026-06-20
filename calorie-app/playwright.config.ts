import { defineConfig, devices } from '@playwright/test';

// Dedicated port so tests never collide with a manually started dev server
// (which may be running with VITE_MOCK_MODE=true from .env.local).
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // Process env overrides .env.local, so tests always run against the
    // real API code paths regardless of local developer flags.
    env: {
      VITE_MOCK_MODE: 'false',
      VITE_OFFLINE_MODE: 'false',
    },
  },
});
