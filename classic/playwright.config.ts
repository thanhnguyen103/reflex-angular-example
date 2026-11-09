import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env['CI'];

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  use: { baseURL: 'http://localhost:4301', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // A throwaway backend (in-memory SQLite) and a dev build on their own ports:
  // your dev servers and backend/todos.db are never touched. Needs `npm install` in ../backend.
  webServer: [
    {
      command: 'npm --prefix ../backend start',
      env: { PORT: '3101', DB_PATH: ':memory:' },
      port: 3101,
      reuseExistingServer: false,
    },
    {
      command: 'npx ng serve --port 4301 --proxy-config proxy.e2e.json',
      url: 'http://localhost:4301',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
