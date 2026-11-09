// The Reflex test SDK: framework-free, so the same journeys run headless (Vitest) and on the real build (Playwright).
import type { ls } from './introspection.ts';

export type Screen = ReturnType<typeof ls>;

/** Any transport that speaks ls/do: the in-process node tree, or the browser's dev-only `window.reflex` bridge. */
export interface Driver {
  ls(): Screen | Promise<Screen>;
  do(action: string, input?: unknown): unknown;
}

export interface Credentials {
  username: string;
  password: string;
}

/** Deep partial match: objects match on the listed keys, arrays element by element with equal length. */
export const matches = (expected: unknown, actual: unknown): boolean => {
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && actual.length === expected.length && expected.every((e, i) => matches(e, actual[i]));
  }
  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object') return false;
    return Object.entries(expected).every(([k, v]) => matches(v, (actual as Record<string, unknown>)[k]));
  }
  return Object.is(expected, actual);
};

export interface Session {
  /** Waits until the focused screen is `name` and its state matches; fails with the last screen seen. */
  precondition(name: string, state?: object): Promise<Screen>;
  /** Runs an action, then waits for the expected screen/state (when given). */
  do(action: string, input?: unknown, name?: string, state?: object): Promise<void>;
}

export const session = (driver: Driver, timeoutMs = 3000): Session => {
  const precondition = async (name: string, state: object = {}) => {
    const deadline = Date.now() + timeoutMs;
    let last: Screen | undefined;
    do {
      last = await driver.ls();
      if (last.name === name && matches(state, last.state)) return last;
      await new Promise((r) => setTimeout(r, 20)); // poll interval, not a sleep-and-hope
    } while (Date.now() < deadline);
    throw new Error(
      `Expected ${name} with ${JSON.stringify(state)}, last saw ${last.name} with ${JSON.stringify(last.state)}`,
    );
  };
  return {
    precondition,
    async do(action, input = {}, name, state) {
      await driver.do(action, input);
      if (name) await precondition(name, state);
    },
  };
};
