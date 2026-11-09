// Runs the shared journeys headless: real ViewModels and reducers, in-memory backend fixture, network blocked.
import { memoryApi, memorySessions } from './api.ts';
import { AppViewModel } from './app.view-model.ts';
import { appNode, invoke, ls } from './introspection.ts';
import { journeys } from './journeys.ts';
import { session } from './testing.ts';

describe('journeys (headless)', () => {
  let networkAttempts: unknown[];

  // Zero-network guard: fails the test on any attempt, even if the app caught the error and recovered.
  beforeEach(() => {
    networkAttempts = [];
    vi.stubGlobal('fetch', (url: unknown) => {
      networkAttempts.push(url);
      return Promise.reject(new Error('Network access is blocked in behavior tests'));
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    expect(networkAttempts, 'a journey tried to reach the network').toEqual([]);
  });

  for (const [name, journey] of Object.entries(journeys)) {
    it(name, async () => {
      const root = appNode(new AppViewModel(memoryApi(), memorySessions()));
      await journey(session({ ls: () => ls(root), do: (a, i) => invoke(root, a, i) }), {
        username: 'ann',
        password: 'secret123',
      });
    });
  }

  it('precondition fails on the wrong screen and reports the last state seen', async () => {
    const root = appNode(new AppViewModel(memoryApi(), memorySessions()));
    const s = session({ ls: () => ls(root), do: (a, i) => invoke(root, a, i) }, 100);
    await expect(s.precondition('TodoList')).rejects.toThrow(/last saw SignIn/);
  });
});
