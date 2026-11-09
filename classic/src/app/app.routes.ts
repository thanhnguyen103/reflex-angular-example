import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from './auth.service';
import { SignIn } from './sign-in';
import { TodoList } from './todo-list';

const signedIn: CanActivateFn = () => inject(AuthService).isSignedIn() || inject(Router).parseUrl('/sign-in');
const signedOut: CanActivateFn = () => !inject(AuthService).isSignedIn() || inject(Router).parseUrl('/');

export const routes: Routes = [
  { path: '', component: TodoList, canActivate: [signedIn] },
  { path: 'sign-in', component: SignIn, canActivate: [signedOut] },
  { path: '**', redirectTo: '' },
];
