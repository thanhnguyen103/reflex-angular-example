// User journeys written once, run everywhere ("share the test, not the code"):
//   headless against the in-memory backend: src/core/journeys.spec.ts (Vitest)
//   on the real build + real backend:       e2e/journeys.spec.ts (Playwright)
// They see only what the UI sees, the focused screen's state and actions: no DOM, no internals.
import type { Credentials, Session } from './testing.ts';

export type Journey = (s: Session, user: Credentials) => Promise<void>;

export const journeys: Record<string, Journey> = {
  'rejects unknown credentials': async (s, user) => {
    await s.precondition('SignIn');
    await s.do('signIn', user, 'SignIn', { submitting: false, error: 'Invalid username or password' });
  },

  'manages todos and keeps them across sign-out': async (s, user) => {
    await s.precondition('SignIn');
    await s.do('register', user, 'TodoList', { loading: false, todos: [] });
    await s.do('add', { title: 'Buy milk' }, 'TodoList', { remaining: 1 });
    await s.do('add', { title: 'Walk dog' }, 'TodoList', { remaining: 2 });
    await s.do('toggle', { id: 1 }, 'TodoList', { remaining: 1 });
    await s.do('setFilter', { filter: 'active' }, 'TodoList', { visible: [{ title: 'Walk dog' }] });
    await s.do('clearCompleted', {}, 'TodoList', { todos: [{ id: 2, title: 'Walk dog', done: false }] });
    await s.do('rename', { id: 2, title: 'Walk the dog' }, 'TodoList', { todos: [{ title: 'Walk the dog' }] });

    await s.do('signOut', {}, 'SignIn');
    await s.do('signIn', user, 'TodoList', { loading: false, todos: [{ id: 2, title: 'Walk the dog', done: false }] });
  },
};
