import { Component, inject } from '@angular/core';
import { AppViewModel } from '../core/app.view-model.ts';
import { FILTERS, type TodoAction } from '../core/todo.view-model.ts';

@Component({
  selector: 'app-todo-list',
  templateUrl: './todo-list.html',
})
export class TodoList {
  // The View reads `screen` and calls `send`. Nothing else.
  protected readonly app = inject(AppViewModel);
  protected readonly filters = FILTERS;

  protected send(action: TodoAction) {
    this.app.todos()?.send(action);
  }
}
