import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env['CI'];

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  use: { baseURL: 'http://localhost:4201', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // A throwaway backend (in-memory SQLite) and a dev build on their own ports:
  // your dev servers and backend/todos.db are never touched. Needs `npm install` in ../backend.
  webServer: [
    {
      command: 'npm --prefix ../backend start',
      env: { PORT: '3100', DB_PATH: ':memory:' },
      port: 3100,
      reuseExistingServer: false,
    },
    {
      // Dev build on purpose: it carries the window.reflex bridge, compiled out of production builds.
      command: 'npx ng serve --port 4201 --proxy-config proxy.e2e.json',
      url: 'http://localhost:4201',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
