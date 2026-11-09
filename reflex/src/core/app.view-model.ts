import { signal } from '@angular/core';
import type { Api, Session, SessionStore } from './api.ts';
import { SignInViewModel } from './sign-in.view-model.ts';
import { TodoViewModel } from './todo.view-model.ts';
import { ViewModel, type Message } from './view-model.ts';

export interface AppState {
  restoring: boolean;
  session: Session | null;
}

export type AppAction = { type: 'signOut' };

type AppMessage = { type: 'restored'; session: Session | null } | { type: 'signedIn'; session: Session };

/** Root of the tree: owns the session and decides which screen is on top. */
export class AppViewModel extends ViewModel<AppState, AppAction, AppMessage> {
  readonly signIn: SignInViewModel;
  readonly #todos = signal<TodoViewModel | null>(null);
  /** The todo screen exists only while signed in, bound to that session's token. */
  readonly todos = this.#todos.asReadonly();
  private readonly api: Api;
  private readonly sessions: SessionStore;
  /** Resolves when every earlier todo screen's queued saves have landed. */
  private settled = Promise.resolve();

  constructor(api: Api, sessions: SessionStore) {
    super({ restoring: true, session: null });
    this.api = api;
    this.sessions = sessions;
    this.signIn = new SignInViewModel(api, (session) => this.dispatch({ type: 'signedIn', session }));

    const saved = sessions.load();
    // A saved token is only trusted after the backend confirms it.
    (saved ? api.me(saved.token).then(() => saved, () => null) : Promise.resolve(null)).then((session) =>
      this.dispatch({ type: 'restored', session }),
    );
  }

  protected override dispatch(msg: Message<AppAction, AppMessage>): void {
    const before = this.state().session;
    super.dispatch(msg);
    const after = this.state().session;
    if (after === before) return;
    const previous = this.#todos();
    if (previous) this.settled = this.settled.then(() => previous.flushed());
    const settled = this.settled;

    // Queued saves land before the token is revoked; local sign-out wins even if the server is down.
    if (before && !after) settled.then(() => this.api.signOut(before.token)).catch(() => {});
    this.sessions.save(after);

    if (!after) return this.#todos.set(null);
    // Signing straight back in must not load the list until the last session's saves have landed.
    const storage = this.api.todos(after.token);
    this.#todos.set(new TodoViewModel({ load: () => settled.then(() => storage.load()), save: (t) => storage.save(t) }));
  }

  protected update(state: AppState, msg: Message<AppAction, AppMessage>): AppState {
    switch (msg.type) {
      case 'viewAction': // signOut
        return { ...state, session: null };
      case 'restored':
      case 'signedIn':
        return { restoring: false, session: msg.session };
    }
  }
}
