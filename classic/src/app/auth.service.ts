import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

export interface Session {
  token: string;
  username: string;
}

export interface Credentials {
  username: string;
  password: string;
}

const KEY = 'classic-session';

/** Server error text if there is one, else the HTTP message. */
export const errorMessage = (e: HttpErrorResponse): string => e.error?.error ?? e.message;

// shortcut: a token in localStorage is readable by any XSS on the page, move to an httpOnly cookie (plus CSRF protection) for production
const readSession = (): Session | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly _session = signal<Session | null>(readSession());

  readonly session = this._session.asReadonly();
  readonly isSignedIn = computed(() => this._session() !== null);

  signIn(credentials: Credentials): Observable<Session> {
    return this.http.post<Session>('/api/sign-in', credentials).pipe(tap((s) => this.setSession(s)));
  }

  register(credentials: Credentials): Observable<Session> {
    return this.http.post<Session>('/api/register', credentials).pipe(tap((s) => this.setSession(s)));
  }

  signOut(): void {
    const token = this._session()?.token;
    if (token) {
      // Local sign-out wins even if the server is down.
      this.http.post('/api/sign-out', null, { headers: { Authorization: `Bearer ${token}` } }).subscribe({ error: () => {} });
    }
    this.setSession(null);
  }

  /** Called by the interceptor when the server rejects our token. */
  expire(): void {
    this.setSession(null);
    void this.router.navigateByUrl('/sign-in');
  }

  private setSession(session: Session | null): void {
    this._session.set(session);
    try {
      if (session) localStorage.setItem(KEY, JSON.stringify(session));
      else localStorage.removeItem(KEY);
    } catch {
      // storage blocked (private mode): the session lasts until reload
    }
  }
}
