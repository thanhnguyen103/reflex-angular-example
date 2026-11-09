// The same journeys as src/core/journeys.spec.ts, now on the real build with the real backend.
// Transport: the dev-only window.reflex bridge, which talks to the same ViewModels the screen is bound to.
import { test } from '@playwright/test';
import { journeys } from '../src/core/journeys.ts';
import { session, type Driver, type Screen } from '../src/core/testing.ts';

type Bridge = { reflex: { ls(): Screen; do(action: string, input?: unknown): void } };

for (const [name, journey] of Object.entries(journeys)) {
  test(name, async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => 'reflex' in window);
    const driver: Driver = {
      ls: () => page.evaluate(() => (window as unknown as Bridge).reflex.ls()),
      do: (action, input) =>
        page.evaluate(([a, i]) => (window as unknown as Bridge).reflex.do(a, i), [action, input] as const),
    };
    // Each run gets a fresh user, since the backend is shared by parallel tests.
    const username = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    await journey(session(driver, 5000), { username, password: 'secret123' });
  });
}
