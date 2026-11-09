import { Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AppViewModel } from '../core/app.view-model.ts';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    @if (vm.state().restoring) {
      <p class="mt-16 text-center text-neutral-500">Loading…</p>
    } @else {
      <router-outlet />
    }
  `,
})
export class App {
  protected readonly vm = inject(AppViewModel);

  constructor() {
    const router = inject(Router);
    // Navigate whenever Core's session changes (restore, sign-in, sign-out).
    effect(() => {
      const { restoring, session } = this.vm.state();
      if (!restoring) void router.navigateByUrl(session ? '/' : '/sign-in');
    });

    // Dev-only bridge so an agent can drive the live app: reflex.ls(), reflex.do('add', {title: 'x'}).
    // Production builds define ngDevMode as false, so this branch and the introspection chunk are compiled out.
    if (typeof ngDevMode !== 'undefined' && ngDevMode) {
      void import('../core/introspection.ts').then(({ appNode, invoke, ls }) => {
        const root = appNode(this.vm);
        Object.assign(globalThis, { reflex: { ls: () => ls(root), do: (a: string, i?: unknown) => invoke(root, a, i) } });
      });
    }
  }
}
