import express, { type RequestHandler } from 'express';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

const SCHEMA = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS todos (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id INTEGER NOT NULL,
    title TEXT NOT NULL,
    done INTEGER NOT NULL,
    PRIMARY KEY (user_id, id)
  );
`;

const hash = (password: string, salt = randomBytes(16).toString('hex')) =>
  `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;

const verify = (password: string, stored: string) => {
  const [salt, key] = stored.split(':');
  return timingSafeEqual(Buffer.from(key, 'hex'), scryptSync(password, salt, 64));
};

// Validation at the trust boundary: never trust the client's shape.
const isCredentials = (b: any): b is { username: string; password: string } =>
  typeof b?.username === 'string' &&
  /^\w{3,32}$/.test(b.username) &&
  typeof b.password === 'string' &&
  b.password.length >= 8 &&
  b.password.length <= 200;

const isTodos = (b: unknown): b is Todo[] =>
  Array.isArray(b) &&
  b.length <= 1000 &&
  b.every(
    (t) =>
      Number.isSafeInteger(t?.id) &&
      typeof t.title === 'string' &&
      t.title.trim().length > 0 &&
      t.title.length <= 500 &&
      typeof t.done === 'boolean',
  ) &&
  new Set(b.map((t) => t.id)).size === b.length;

export function createServer(dbPath = ':memory:') {
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);

  const findUser = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?');
  const insertUser = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id');
  const insertSession = db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)');
  const deleteSession = db.prepare('DELETE FROM sessions WHERE token = ?');
  const sessionUser = db.prepare(
    'SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id WHERE token = ?',
  );
  const selectTodos = db.prepare('SELECT id, title, done FROM todos WHERE user_id = ? ORDER BY id');
  const deleteTodos = db.prepare('DELETE FROM todos WHERE user_id = ?');
  const insertTodo = db.prepare('INSERT INTO todos (user_id, id, title, done) VALUES (?, ?, ?, ?)');

  // shortcut: sessions never expire, add an expires_at column if tokens must age out
  const startSession = (userId: number, username: string) => {
    const token = randomBytes(32).toString('base64url');
    insertSession.run(token, userId);
    return { token, username };
  };

  const auth: RequestHandler = (req, res, next) => {
    const token = req.get('authorization')?.replace(/^Bearer /, '');
    const user = token ? sessionUser.get(token) : undefined;
    if (!user) return void res.status(401).json({ error: 'Not signed in' });
    res.locals['user'] = user;
    res.locals['token'] = token;
    next();
  };

  const app = express();
  app.use(express.json({ limit: '200kb' }));

  app.post('/api/register', (req, res) => {
    if (!isCredentials(req.body)) {
      return void res
        .status(400)
        .json({ error: 'Username must be 3–32 letters, digits or _, password at least 8 characters' });
    }
    const { username, password } = req.body;
    if (findUser.get(username)) return void res.status(409).json({ error: 'Username is taken' });
    const { id } = insertUser.get(username, hash(password)) as { id: number };
    res.status(201).json(startSession(id, username));
  });

  app.post('/api/sign-in', (req, res) => {
    const user = isCredentials(req.body)
      ? (findUser.get(req.body.username) as { id: number; username: string; password_hash: string } | undefined)
      : undefined;
    if (!user || !verify(req.body.password, user.password_hash)) {
      return void res.status(401).json({ error: 'Invalid username or password' });
    }
    res.json(startSession(user.id, user.username));
  });

  app.post('/api/sign-out', auth, (_req, res) => {
    deleteSession.run(res.locals['token']);
    res.status(204).end();
  });

  app.get('/api/me', auth, (_req, res) => {
    res.json({ username: res.locals['user'].username });
  });

  app.get('/api/todos', auth, (_req, res) => {
    const rows = selectTodos.all(res.locals['user'].id) as { id: number; title: string; done: number }[];
    res.json(rows.map((r) => ({ ...r, done: r.done === 1 })));
  });

  // shortcut: whole-list replace, last write wins; switch to per-todo endpoints if several tabs/devices edit at once
  app.put('/api/todos', auth, (req, res) => {
    if (!isTodos(req.body)) return void res.status(400).json({ error: 'Invalid todo list' });
    const userId = res.locals['user'].id;
    db.exec('BEGIN');
    try {
      deleteTodos.run(userId);
      for (const t of req.body) insertTodo.run(userId, t.id, t.title, t.done ? 1 : 0);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    res.status(204).end();
  });

  return app;
}
