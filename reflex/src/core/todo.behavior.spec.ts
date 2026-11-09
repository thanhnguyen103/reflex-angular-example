// Grey-box behavior tests: drive the app only through the introspection node (ls/do), like the CLI does.
import { invoke, ls, todoNode } from './introspection.ts';
import { memoryStorage, TodoViewModel, type Todo } from './todo.view-model.ts';

const start = async (seed: Todo[] = []) => {
  const storage = memoryStorage(seed);
  const root = todoNode(new TodoViewModel(storage));
  await vi.waitFor(() => expect(ls(root).state).toMatchObject({ loading: false }));
  const state = () => ls(root).state as ReturnType<typeof ls>['state'] & { todos: Todo[]; visible: Todo[]; remaining: number };
  return { storage, root, state, do: (a: string, i?: unknown) => invoke(root, a, i) };
};

describe('TodoList', () => {
  it('lists its screen name and every action', async () => {
    const { root } = await start();
    const view = ls(root);
    expect(view.name).toBe('TodoList');
    expect(view.actions.map((a) => a.name)).toEqual(['add', 'toggle', 'rename', 'remove', 'toggleAll', 'clearCompleted', 'setFilter']);
  });

  it('adds, toggles, filters and clears', async () => {
    const app = await start();
    app.do('add', { title: '  Buy milk ' });
    app.do('add', { title: 'Walk dog' });
    app.do('add', { title: '   ' }); // ignored
    expect(app.state().todos.map((t) => t.title)).toEqual(['Buy milk', 'Walk dog']);

    app.do('toggle', { id: 1 });
    expect(app.state().remaining).toBe(1);

    app.do('setFilter', { filter: 'completed' });
    expect(app.state().visible.map((t) => t.id)).toEqual([1]);

    app.do('clearCompleted');
    expect(app.state().todos.map((t) => t.id)).toEqual([2]);
  });

  it('toggleAll completes all, then un-completes all', async () => {
    const app = await start([{ id: 1, title: 'a', done: true }, { id: 2, title: 'b', done: false }]);
    app.do('toggleAll');
    expect(app.state().remaining).toBe(0);
    app.do('toggleAll');
    expect(app.state().remaining).toBe(2);
  });

  it('renaming to empty deletes the todo', async () => {
    const app = await start([{ id: 1, title: 'a', done: false }]);
    app.do('rename', { id: 1, title: 'b' });
    expect(app.state().todos[0].title).toBe('b');
    app.do('rename', { id: 1, title: ' ' });
    expect(app.state().todos).toEqual([]);
  });

  it('persists changes through the storage service', async () => {
    const app = await start();
    app.do('add', { title: 'x' });
    await vi.waitFor(async () => expect(await app.storage.load()).toEqual([{ id: 1, title: 'x', done: false }]));
  });

  it('rejects unknown actions and malformed input before reaching the ViewModel', async () => {
    const app = await start();
    expect(() => app.do('fly')).toThrow(/Unknown action "fly". Available: add/);
    expect(() => app.do('toggle', { id: '1' })).toThrow(/expects id: number/);
    expect(() => app.do('setFilter', { filter: 'done' })).toThrow(/all\|active\|completed/);
    expect(() => app.do('toString')).toThrow(/Unknown action/);
  });

  it('refuses edits until the list has loaded, so the load cannot overwrite them', async () => {
    let finishLoad!: (todos: Todo[]) => void;
    const saved: Todo[][] = [];
    const vm = new TodoViewModel({
      load: () => new Promise((r) => (finishLoad = r)),
      save: async (t) => void saved.push(t),
    });
    const root = todoNode(vm);
    invoke(root, 'add', { title: 'too early' });
    finishLoad([{ id: 1, title: 'from server', done: false }]);
    await vi.waitFor(() => expect(ls(root).state).toMatchObject({ loading: false, todos: [{ title: 'from server' }] }));
    expect(saved).toEqual([]);
  });

  it('keeps refusing edits when the load fails, so a partial list never replaces the server copy', async () => {
    const saved: Todo[][] = [];
    const root = todoNode(new TodoViewModel({ load: () => Promise.reject(new Error('offline')), save: async (t) => void saved.push(t) }));
    await vi.waitFor(() => expect(ls(root).state).toMatchObject({ error: 'Could not load todos: offline' }));
    invoke(root, 'add', { title: 'x' });
    expect(ls(root).state).toMatchObject({ loading: true, todos: [] });
    expect(saved).toEqual([]);
  });
});
