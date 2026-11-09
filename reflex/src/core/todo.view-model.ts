import { computed } from '@angular/core';
import { ViewModel, type Message } from './view-model.ts';

export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

export const FILTERS = ['all', 'active', 'completed'] as const;
export type Filter = (typeof FILTERS)[number];

export interface TodoState {
  /** True until the list has loaded. Edits are refused until then, even if the load fails. */
  loading: boolean;
  todos: Todo[];
  filter: Filter;
  error: string | null;
}

export type TodoAction =
  | { type: 'add'; title: string }
  | { type: 'toggle'; id: number }
  | { type: 'rename'; id: number; title: string }
  | { type: 'remove'; id: number }
  | { type: 'toggleAll' }
  | { type: 'clearCompleted' }
  | { type: 'setFilter'; filter: Filter };

type TodoMessage =
  | { type: 'loaded'; todos: Todo[] }
  | { type: 'loadFailed'; error: string }
  | { type: 'saved' }
  | { type: 'failed'; error: string };

/** Platform edge: Core declares it, hosts (browser, CLI, tests) supply it. */
export interface TodoStorage {
  load(): Promise<Todo[]>;
  save(todos: Todo[]): Promise<void>;
}

export const memoryStorage = (seed: Todo[] = []): TodoStorage => {
  let data = structuredClone(seed);
  return {
    load: async () => structuredClone(data),
    save: async (todos) => void (data = structuredClone(todos)),
  };
};

const visibleTodos = ({ todos, filter }: TodoState): Todo[] =>
  filter === 'all' ? todos : todos.filter((t) => t.done === (filter === 'completed'));

export class TodoViewModel extends ViewModel<TodoState, TodoAction, TodoMessage> {
  private readonly storage: TodoStorage;
  private saving = Promise.resolve();

  /** Everything the screen shows, derived values included. The view and the introspection node both read this. */
  readonly screen = computed(() => {
    const s = this.state();
    return { ...s, visible: visibleTodos(s), remaining: s.todos.filter((t) => !t.done).length };
  });

  constructor(storage: TodoStorage) {
    super({ loading: true, todos: [], filter: 'all', error: null });
    this.storage = storage;
    storage.load().then(
      (todos) => this.dispatch({ type: 'loaded', todos }),
      (e: Error) => this.dispatch({ type: 'loadFailed', error: `Could not load todos: ${e.message}` }),
    );
  }

  /** Resolves once every queued save has finished (succeeded or failed). */
  flushed(): Promise<void> {
    return this.saving;
  }

  protected override dispatch(msg: Message<TodoAction, TodoMessage>): void {
    const before = this.state().todos;
    super.dispatch(msg);
    const after = this.state().todos;
    if (after === before || msg.type === 'loaded') return;
    // Chain saves so an older list can never land after a newer one.
    this.saving = this.saving.then(() =>
      this.storage.save(after).then(
        () => this.dispatch({ type: 'saved' }),
        (e: Error) => this.dispatch({ type: 'failed', error: `Could not save: ${e.message}` }),
      ),
    );
  }

  protected update(state: TodoState, msg: Message<TodoAction, TodoMessage>): TodoState {
    if (msg.type === 'loaded') return { ...state, loading: false, todos: msg.todos, error: null };
    if (msg.type === 'saved') return state.error ? { ...state, error: null } : state;
    if (msg.type === 'loadFailed') return { ...state, error: msg.error };
    if (msg.type === 'failed') return { ...state, error: msg.error };

    const a = msg.action;
    // Before the list loads, an edit would be overwritten by the load, or (if the load failed)
    // would replace the server's whole list with a partial one. Filtering is safe.
    if (state.loading && a.type !== 'setFilter') return state;
    const todos = state.todos;
    const map = (id: number, f: (t: Todo) => Todo) => todos.map((t) => (t.id === id ? f(t) : t));

    switch (a.type) {
      case 'add': {
        const title = a.title.trim();
        if (!title) return state;
        const id = Math.max(0, ...todos.map((t) => t.id)) + 1; // deterministic, keeps update pure
        return { ...state, todos: [...todos, { id, title, done: false }] };
      }
      case 'toggle':
        return { ...state, todos: map(a.id, (t) => ({ ...t, done: !t.done })) };
      case 'rename': {
        const title = a.title.trim();
        // Empty title deletes, like classic TodoMVC.
        if (!title) return { ...state, todos: todos.filter((t) => t.id !== a.id) };
        return { ...state, todos: map(a.id, (t) => ({ ...t, title })) };
      }
      case 'remove':
        return { ...state, todos: todos.filter((t) => t.id !== a.id) };
      case 'toggleAll': {
        const done = todos.some((t) => !t.done);
        return { ...state, todos: todos.map((t) => ({ ...t, done })) };
      }
      case 'clearCompleted':
        return { ...state, todos: todos.filter((t) => !t.done) };
      case 'setFilter':
        return { ...state, filter: a.filter };
    }
  }
}
