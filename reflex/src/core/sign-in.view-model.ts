import type { Api, Session } from './api.ts';
import { ViewModel, type Message } from './view-model.ts';

export interface SignInState {
  submitting: boolean;
  error: string | null;
}

// The password travels in the action only; it is never kept in state.
export type SignInAction =
  | { type: 'signIn'; username: string; password: string }
  | { type: 'register'; username: string; password: string };

type SignInMessage = { type: 'succeeded' } | { type: 'failed'; error: string };

export class SignInViewModel extends ViewModel<SignInState, SignInAction, SignInMessage> {
  private readonly api: Api;
  private readonly onSignedIn: (session: Session) => void;

  constructor(api: Api, onSignedIn: (session: Session) => void) {
    super({ submitting: false, error: null });
    this.api = api;
    this.onSignedIn = onSignedIn;
  }

  protected override dispatch(msg: Message<SignInAction, SignInMessage>): void {
    const wasSubmitting = this.state().submitting;
    super.dispatch(msg);
    // Only call the API when update() accepted the action (moved to submitting).
    if (msg.type !== 'viewAction' || wasSubmitting || !this.state().submitting) return;
    const { type, username, password } = msg.action;
    this.api[type]({ username: username.trim(), password }).then(
      (session) => {
        this.dispatch({ type: 'succeeded' });
        this.onSignedIn(session);
      },
      (e: Error) => this.dispatch({ type: 'failed', error: e.message }),
    );
  }

  protected update(state: SignInState, msg: Message<SignInAction, SignInMessage>): SignInState {
    switch (msg.type) {
      case 'viewAction':
        if (state.submitting) return state;
        if (!msg.action.username.trim() || !msg.action.password) {
          return { ...state, error: 'Enter a username and password' };
        }
        return { submitting: true, error: null };
      case 'succeeded':
        return { submitting: false, error: null };
      case 'failed':
        return { submitting: false, error: msg.error };
    }
  }
}
