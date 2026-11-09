import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { TodoService } from './todo.service';

type Filter = 'all' | 'active' | 'completed';

@Component({
  selector: 'app-todo-list',
  templateUrl: './todo-list.html',
})
export class TodoList implements OnInit {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly todoService = inject(TodoService);

  protected readonly filters: Filter[] = ['all', 'active', 'completed'];
  protected readonly filter = signal<Filter>('all');
  protected readonly visible = computed(() => {
    const filter = this.filter();
    const todos = this.todoService.todos();
    return filter === 'all' ? todos : todos.filter((t) => t.done === (filter === 'completed'));
  });
  protected readonly remaining = computed(() => this.todoService.todos().filter((t) => !t.done).length);

  ngOnInit(): void {
    this.todoService.load();
  }

  protected async signOut(): Promise<void> {
    await this.todoService.flushed(); // let queued saves land before the token is revoked
    this.auth.signOut();
    this.todoService.reset();
    await this.router.navigateByUrl('/sign-in');
  }
}
