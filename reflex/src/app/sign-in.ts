import { Component, inject } from '@angular/core';
import { AppViewModel } from '../core/app.view-model.ts';

@Component({
  selector: 'app-sign-in',
  template: `
    @let s = vm.state();
    <main class="mx-auto mt-16 max-w-sm px-4">
      <h1 class="mb-6 text-center text-5xl font-extralight">todos</h1>
      <form
        class="space-y-4"
        (submit)="$event.preventDefault(); vm.send({ type: 'signIn', username: username.value, password: password.value })"
      >
        <label class="block text-sm font-medium">
          Username <input #username class="field mt-1" name="username" autocomplete="username" required />
        </label>
        <label class="block text-sm font-medium">
          Password
          <input #password class="field mt-1" name="password" type="password" autocomplete="current-password" required />
        </label>
        @if (s.error) {
          <p role="alert" class="alert">{{ s.error }}</p>
        }
        <div class="flex gap-2">
          <button type="submit" class="btn btn-primary flex-1" [disabled]="s.submitting">Sign in</button>
          <button
            type="button"
            class="btn flex-1"
            [disabled]="s.submitting"
            (click)="vm.send({ type: 'register', username: username.value, password: password.value })"
          >
            Create account
          </button>
        </div>
      </form>
    </main>
  `,
})
export class SignIn {
  protected readonly vm = inject(AppViewModel).signIn;
}
