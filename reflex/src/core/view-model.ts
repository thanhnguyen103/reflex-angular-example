import { signal, type Signal } from '@angular/core';

/** Public actions are wrapped as a `viewAction`; internal messages (service results) sit beside them. */
export type Message<A, M> = { type: 'viewAction'; action: A } | M;

/**
 * The Reflex ViewModel contract: actions in, state out, one `update`.
 * Only signals are used from Angular, so this runs headless in Node (CLI, tests).
 */
export abstract class ViewModel<S, A, M = never> {
  readonly #state;
  readonly state: Signal<S>;

  constructor(initial: S) {
    this.#state = signal(initial);
    this.state = this.#state.asReadonly();
  }

  send(action: A): void {
    this.dispatch({ type: 'viewAction', action });
  }

  protected dispatch(msg: Message<A, M>): void {
    this.#state.set(this.update(this.#state(), msg));
  }

  /** The only place state ever changes. Must be pure. */
  protected abstract update(state: S, msg: Message<A, M>): S;
}
