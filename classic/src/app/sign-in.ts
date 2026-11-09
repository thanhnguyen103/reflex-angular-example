import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, errorMessage } from './auth.service';

@Component({
  selector: 'app-sign-in',
  imports: [ReactiveFormsModule],
  template: `
    <main class="mx-auto mt-16 max-w-sm px-4">
      <h1 class="mb-6 text-center text-5xl font-extralight">todos</h1>
      <form class="space-y-4" [formGroup]="form" (ngSubmit)="submit('signIn')">
        <label class="block text-sm font-medium">
          Username <input class="field mt-1" formControlName="username" name="username" autocomplete="username" required />
        </label>
        <label class="block text-sm font-medium">
          Password
          <input
            class="field mt-1"
            formControlName="password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>
        @if (error()) {
          <p role="alert" class="alert">{{ error() }}</p>
        }
        <div class="flex gap-2">
          <button type="submit" class="btn btn-primary flex-1" [disabled]="submitting()">Sign in</button>
          <button type="button" class="btn flex-1" [disabled]="submitting()" (click)="submit('register')">
            Create account
          </button>
        </div>
      </form>
    </main>
  `,
})
export class SignIn {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = inject(NonNullableFormBuilder).group({ username: '', password: '' });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(mode: 'signIn' | 'register'): void {
    const { username, password } = this.form.getRawValue();
    if (!username.trim() || !password) return this.error.set('Enter a username and password');

    this.submitting.set(true);
    this.error.set(null);
    this.auth[mode]({ username: username.trim(), password }).subscribe({
      next: () => void this.router.navigateByUrl('/'),
      error: (e) => {
        this.submitting.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }
}
