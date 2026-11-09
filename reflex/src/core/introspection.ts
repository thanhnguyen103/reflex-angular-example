import type { AppViewModel } from './app.view-model.ts';
import type { SignInViewModel } from './sign-in.view-model.ts';
import { FILTERS, type TodoViewModel } from './todo.view-model.ts';

/** Input schema: field name -> 'string' | 'number' | allowed string values. */
type InputSchema = Record<string, 'string' | 'number' | readonly string[]>;

export interface ActionEntry {
  title: string;
  input?: InputSchema;
  run(input: Record<string, unknown>): void;
}

export interface IntrospectionNode {
  name: string;
  readonly state: unknown;
  actions: Record<string, ActionEntry>;
  /** Actions a container lends to whichever screen is focused below it (e.g. signOut). */
  lends?: Record<string, ActionEntry>;
  readonly child?: IntrospectionNode;
}

/** Follow `child` to the deepest node (the focused screen); ancestors' lent actions join its own. */
export const focused = (root: IntrospectionNode) => {
  let node = root;
  const actions: Record<string, ActionEntry> = {};
  while (node.child) {
    Object.assign(actions, node.lends);
    node = node.child;
  }
  return { name: node.name, state: node.state, actions: Object.assign(actions, node.actions) };
};

/** `ls`: what an agent sees. */
export const ls = (root: IntrospectionNode) => {
  const node = focused(root);
  return {
    name: node.name,
    state: node.state,
    actions: Object.entries(node.actions).map(([name, a]) => ({ name, title: a.title, input: a.input })),
  };
};

/** `do`: validate the JSON input at the trust boundary, then run the action. Throws on bad input. */
export const invoke = (root: IntrospectionNode, name: string, input: unknown = {}): void => {
  const node = focused(root);
  const action = Object.hasOwn(node.actions, name) ? node.actions[name] : undefined;
  if (!action) throw new Error(`Unknown action "${name}". Available: ${Object.keys(node.actions).join(', ')}`);
  if (typeof input !== 'object' || input === null) throw new Error('Input must be a JSON object');
  const fields = input as Record<string, unknown>;
  for (const [key, type] of Object.entries(action.input ?? {})) {
    const v = fields[key];
    const ok = Array.isArray(type) ? type.includes(v as string) : typeof v === type;
    if (!ok) throw new Error(`"${name}" expects ${key}: ${Array.isArray(type) ? type.join('|') : type}`);
  }
  action.run(fields);
};

/** Lists every action every time, no conditionals: business rules stay in `update`. */
export const todoNode = (vm: TodoViewModel): IntrospectionNode => ({
  name: 'TodoList',
  get state() {
    return vm.screen(); // the same object the view renders, derived values included
  },
  actions: {
    add: { title: 'Add todo', input: { title: 'string' }, run: (i) => vm.send({ type: 'add', title: i['title'] as string }) },
    toggle: { title: 'Toggle todo', input: { id: 'number' }, run: (i) => vm.send({ type: 'toggle', id: i['id'] as number }) },
    rename: {
      title: 'Rename todo',
      input: { id: 'number', title: 'string' },
      run: (i) => vm.send({ type: 'rename', id: i['id'] as number, title: i['title'] as string }),
    },
    remove: { title: 'Delete todo', input: { id: 'number' }, run: (i) => vm.send({ type: 'remove', id: i['id'] as number }) },
    toggleAll: { title: 'Toggle all', run: () => vm.send({ type: 'toggleAll' }) },
    clearCompleted: { title: 'Clear completed', run: () => vm.send({ type: 'clearCompleted' }) },
    setFilter: {
      title: 'Filter list',
      input: { filter: FILTERS },
      run: (i) => vm.send({ type: 'setFilter', filter: i['filter'] as (typeof FILTERS)[number] }),
    },
  },
});

const credentials = { username: 'string', password: 'string' } as const;

export const signInNode = (vm: SignInViewModel): IntrospectionNode => ({
  name: 'SignIn',
  get state() {
    return vm.state();
  },
  actions: {
    signIn: {
      title: 'Sign in',
      input: credentials,
      run: (i) => vm.send({ type: 'signIn', username: i['username'] as string, password: i['password'] as string }),
    },
    register: {
      title: 'Create account',
      input: credentials,
      run: (i) => vm.send({ type: 'register', username: i['username'] as string, password: i['password'] as string }),
    },
  },
});

export const appNode = (vm: AppViewModel): IntrospectionNode => {
  const signIn = signInNode(vm.signIn);
  return {
    name: 'App',
    get state() {
      const { restoring, session } = vm.state();
      return { restoring, username: session?.username ?? null }; // the token stays out of agent-visible JSON
    },
    actions: {},
    lends: { signOut: { title: 'Sign out', run: () => vm.send({ type: 'signOut' }) } },
    get child() {
      const s = vm.state();
      const todoVm = vm.todos();
      if (s.restoring) return undefined;
      return s.session && todoVm ? todoNode(todoVm) : signIn;
    },
  };
};
