import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from './auth.service';

export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

@Injectable({ providedIn: 'root' })
export class TodoService {
  private readonly http = inject(HttpClient);
  private saving = Promise.resolve();

  readonly todos = signal<Todo[]>([]);
  /** True until the list has loaded. Edits are ignored until then, even if the load fails. */
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  load(): void {
    this.loading.set(true);
    this.http.get<Todo[]>('/api/todos').subscribe({
      next: (todos) => {
        this.todos.set(todos);
        this.loading.set(false);
        this.error.set(null);
      },
      error: (e) => {
        this.error.set(`Could not load todos: ${errorMessage(e)}`);
      },
    });
  }

  add(title: string): void {
    title = title.trim();
    if (!title) return;
    const todos = this.todos();
    const id = Math.max(0, ...todos.map((t) => t.id)) + 1;
    this.save([...todos, { id, title, done: false }]);
  }

  toggle(id: number): void {
    this.save(this.todos().map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  rename(id: number, title: string): void {
    title = title.trim();
    // Empty title deletes, like classic TodoMVC.
    if (!title) return this.remove(id);
    this.save(this.todos().map((t) => (t.id === id ? { ...t, title } : t)));
  }

  remove(id: number): void {
    this.save(this.todos().filter((t) => t.id !== id));
  }

  toggleAll(): void {
    const done = this.todos().some((t) => !t.done);
    this.save(this.todos().map((t) => ({ ...t, done })));
  }

  clearCompleted(): void {
    this.save(this.todos().filter((t) => !t.done));
  }

  /** Resolves once every queued save has finished (succeeded or failed). */
  flushed(): Promise<void> {
    return this.saving;
  }

  reset(): void {
    this.loading.set(true);
    this.todos.set([]);
    this.error.set(null);
  }

  private save(todos: Todo[]): void {
    // Before the list loads, an edit would be overwritten by the load, or (if the load failed)
    // would replace the server's whole list with a partial one.
    if (this.loading()) return;
    this.todos.set(todos);
    // Chain saves so an older list can never land after a newer one.
    this.saving = this.saving.then(() =>
      firstValueFrom(this.http.put('/api/todos', todos)).then(
        () => this.error.set(null),
        (e) => this.error.set(`Could not save: ${errorMessage(e)}`),
      ),
    );
  }
}
