// Runs the real Express + SQLite server in-process and talks to it over HTTP.
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Todo } from './server.ts';

type Credentials = { username: string; password: string };
type Session = { token: string; username: string };

let server: Server;
let base: string;

/** Minimal client: returns the JSON body, throws the server's `error` text on failure. */
const call = async (path: string, token?: string, method = 'GET', body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
  return res.status === 204 ? undefined : res.json();
};

const api = {
  register: (c: Credentials): Promise<Session> => call('/api/register', undefined, 'POST', c),
  signIn: (c: Credentials): Promise<Session> => call('/api/sign-in', undefined, 'POST', c),
  signOut: (token: string) => call('/api/sign-out', token, 'POST'),
  me: (token: string) => call('/api/me', token),
  todos: (token: string) => ({
    load: (): Promise<Todo[]> => call('/api/todos', token),
    save: (todos: Todo[]) => call('/api/todos', token, 'PUT', todos),
  }),
};

beforeAll(async () => {
  server = createServer(':memory:').listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
afterAll(() => void server.close());

const ann = { username: 'ann', password: 'secret123' };

describe('server', () => {
  it('registers, signs in, stores todos per user, and signs out', async () => {
    const { token } = await api.register(ann);
    expect(await api.me(token)).toEqual({ username: 'ann' });

    const todos = [{ id: 1, title: 'Buy milk', done: true }];
    await api.todos(token).save(todos);
    expect(await api.todos(token).load()).toEqual(todos);

    const bob = await api.register({ username: 'bob', password: 'secret123' });
    expect(await api.todos(bob.token).load()).toEqual([]);

    const again = await api.signIn(ann);
    expect(await api.todos(again.token).load()).toEqual(todos);

    await api.signOut(token);
    await expect(api.me(token)).rejects.toThrow('Not signed in');
    expect(await api.me(again.token)).toEqual({ username: 'ann' }); // other sessions survive
  });

  it('rejects bad credentials, duplicates and weak input', async () => {
    await expect(api.signIn({ username: 'nobody', password: 'secret123' })).rejects.toThrow('Invalid username or password');
    await api.register({ username: 'cat', password: 'secret123' });
    await expect(api.signIn({ username: 'cat', password: 'wrong-pass' })).rejects.toThrow('Invalid username or password');
    await expect(api.register({ username: 'CAT', password: 'secret123' })).rejects.toThrow('Username is taken');
    await expect(api.register({ username: 'dee', password: 'short' })).rejects.toThrow(/at least 8/);
  });

  it('validates todo lists and requires a token', async () => {
    const { token } = await api.register({ username: 'eve', password: 'secret123' });
    const todos = api.todos(token);
    await expect(todos.save([{ id: 1, title: '', done: false }])).rejects.toThrow('Invalid todo list');
    await expect(todos.save([{ id: 1, title: 'a', done: false }, { id: 1, title: 'b', done: false }])).rejects.toThrow('Invalid todo list');
    await expect(todos.save({} as never)).rejects.toThrow('Invalid todo list');
    expect((await fetch(`${base}/api/todos`)).status).toBe(401);
  });
});
