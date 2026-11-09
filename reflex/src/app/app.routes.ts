import { inject } from '@angular/core';
import { Router, type Routes } from '@angular/router';
import { AppViewModel } from '../core/app.view-model.ts';
import { SignIn } from './sign-in';
import { TodoList } from './todo-list';

/** The URL mirrors Core's session state; Core stays the source of truth. */
const whenSignedIn = (signedIn: boolean) => () => {
  const { restoring, session } = inject(AppViewModel).state();
  // While restoring, let it through: App redirects once Core knows the answer.
  return restoring || !!session === signedIn || inject(Router).parseUrl(signedIn ? '/sign-in' : '/');
};

export const routes: Routes = [
  { path: '', component: TodoList, canActivate: [whenSignedIn(true)] },
  { path: 'sign-in', component: SignIn, canActivate: [whenSignedIn(false)] },
  { path: '**', redirectTo: '' },
];
