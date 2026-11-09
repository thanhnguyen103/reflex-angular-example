import { memoryStorage, type TodoStorage } from './todo.view-model.ts';

export interface Session {
  token: string;
  username: string;
}

export interface Credentials {
  username: string;
  password: string;
}

/** Everything Core needs from the backend. Hosts pass `httpApi()` or the `memoryApi()` fixture. */
export interface Api {
  signIn(c: Credentials): Promise<Session>;
  register(c: Credentials): Promise<Session>;
  signOut(token: string): Promise<void>;
  me(token: string): Promise<{ username: string }>;
  todos(token: string): TodoStorage;
}

/** Where the signed-in session survives restarts (localStorage in the browser). */
export interface SessionStore {
  load(): Session | null;
  save(session: Session | null): void;
}

export const httpApi = (base = ''): Api => {
  const call = async (path: string, token?: string, method = 'GET', body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
    return res.status === 204 ? undefined : res.json();
  };
  return {
    signIn: (c) => call('/api/sign-in', undefined, 'POST', c),
    register: (c) => call('/api/register', undefined, 'POST', c),
    signOut: (token) => call('/api/sign-out', token, 'POST'),
    me: (token) => call('/api/me', token),
    todos: (token) => ({ load: () => call('/api/todos', token), save: (todos) => call('/api/todos', token, 'PUT', todos) }),
  };
};

/** In-memory backend fixture for the CLI and behavior tests: no network. */
export const memoryApi = (): Api => {
  const users = new Map<string, { password: string; storage: TodoStorage }>();
  const sessions = new Map<string, string>(); // token -> username
  let next = 0;
  const start = (username: string): Session => {
    const token = `token-${++next}`;
    sessions.set(token, username);
    return { token, username };
  };
  const userOf = (token: string) => {
    const username = sessions.get(token);
    if (!username) throw new Error('Not signed in');
    return { username, ...users.get(username)! };
  };
  return {
    register: async ({ username, password }) => {
      if (users.has(username)) throw new Error('Username is taken');
      users.set(username, { password, storage: memoryStorage() });
      return start(username);
    },
    signIn: async ({ username, password }) => {
      if (users.get(username)?.password !== password) throw new Error('Invalid username or password');
      return start(username);
    },
    signOut: async (token) => void sessions.delete(token),
    me: async (token) => ({ username: userOf(token).username }),
    todos: (token) => ({
      load: async () => userOf(token).storage.load(),
      save: async (todos) => userOf(token).storage.save(todos),
    }),
  };
};

export const memorySessions = (initial: Session | null = null): SessionStore => {
  let session = initial;
  return { load: () => session, save: (s) => void (session = s) };
};
