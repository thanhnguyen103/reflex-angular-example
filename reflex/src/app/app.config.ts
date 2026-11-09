import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { httpApi, type Session, type SessionStore } from '../core/api.ts';
import { AppViewModel } from '../core/app.view-model.ts';
import { routes } from './app.routes';

const KEY = 'reflex-session';

/** Platform edge: the session survives reloads in localStorage. */
// shortcut: a token in localStorage is readable by any XSS on the page, move to an httpOnly cookie (plus CSRF protection) for production
export const localStorageSession: SessionStore = {
  load: () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Session | null;
    } catch {
      return null;
    }
  },
  save: (session) => {
    try {
      if (session) localStorage.setItem(KEY, JSON.stringify(session));
      else localStorage.removeItem(KEY);
    } catch {
      // storage blocked (private mode): the session lasts until reload
    }
  },
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Core is built by plain constructor calls; Angular DI only hands the root to views.
    { provide: AppViewModel, useFactory: () => new AppViewModel(httpApi(), localStorageSession) },
  ],
};
