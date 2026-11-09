// Grey-box journey through the whole tree: App -> SignIn | TodoList, driven only by ls/do.
import { memoryApi, memorySessions, type SessionStore } from './api.ts';
import { AppViewModel } from './app.view-model.ts';
import { appNode, invoke, ls } from './introspection.ts';

const start = (api = memoryApi(), sessions: SessionStore = memorySessions()) => {
  const root = appNode(new AppViewModel(api, sessions));
  return {
    root,
    do: (a: string, i?: unknown) => invoke(root, a, i),
    /** Poll until the focused screen is `name` (and optionally its state matches). */
    precondition: (name: string, state: object = {}) =>
      vi.waitFor(() => expect(ls(root)).toMatchObject({ name, state })),
  };
};

const ann = { username: 'ann', password: 'secret123' };

describe('App', () => {
  it('starts on SignIn and reports bad credentials', async () => {
    const app = start();
    await app.precondition('SignIn');
    app.do('signIn', ann);
    await app.precondition('SignIn', { submitting: false, error: 'Invalid username or password' });
    app.do('signIn', { username: ' ', password: '' });
    await app.precondition('SignIn', { error: 'Enter a username and password' });
  });

  it('registers, keeps todos per user across sign-out, and lends signOut to the focused screen', async () => {
    const app = start();
    await app.precondition('SignIn');
    app.do('register', ann);
    await app.precondition('TodoList', { loading: false });
    expect(ls(app.root).actions.map((a) => a.name)).toContain('signOut');

    app.do('add', { title: 'Buy milk' });
    app.do('signOut');
    await app.precondition('SignIn');

    app.do('register', { username: 'bob', password: 'secret123' });
    await app.precondition('TodoList', { loading: false, todos: [] });
    app.do('signOut');

    app.do('signIn', ann);
    await app.precondition('TodoList', { loading: false, todos: [{ id: 1, title: 'Buy milk', done: false }] });
  });

  it('restores a saved session, and drops one the backend rejects', async () => {
    const api = memoryApi();
    const session = await api.register(ann);
    await start(api, memorySessions(session)).precondition('TodoList');

    const stale = memorySessions({ token: 'revoked', username: 'ann' });
    await start(api, stale).precondition('SignIn');
  });

  it('surfaces save failures instead of losing them silently', async () => {
    const api = memoryApi();
    const app = start(api);
    await app.precondition('SignIn');
    app.do('register', ann);
    await app.precondition('TodoList', { loading: false });
    await api.signOut('token-1'); // server-side revoke: next save gets "Not signed in"
    app.do('add', { title: 'x' });
    await app.precondition('TodoList', { error: 'Could not save: Not signed in' });
  });

  it('signing straight back in loads the list only after the previous session saves land', async () => {
    const api = memoryApi();
    const slowSaves: typeof api = {
      ...api,
      todos: (token) => {
        const storage = api.todos(token);
        return { load: storage.load, save: (t) => new Promise((r) => setTimeout(r, 30)).then(() => storage.save(t)) };
      },
    };
    const app = start(slowSaves);
    await app.precondition('SignIn');
    app.do('register', ann);
    await app.precondition('TodoList', { loading: false });
    app.do('add', { title: 'Buy milk' });
    app.do('signOut');
    app.do('signIn', ann);
    await app.precondition('TodoList', { loading: false, todos: [{ title: 'Buy milk' }] });
  });
});
