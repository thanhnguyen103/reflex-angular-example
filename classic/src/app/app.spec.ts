import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { authInterceptor } from './auth.interceptor';
import { routes } from './app.routes';
import { TodoService } from './todo.service';

const typeInto = (root: Element, selector: string, value: string) => {
  const input = root.querySelector<HTMLInputElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
};

describe('Classic todo app', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const signedInAs = (token: string) => localStorage.setItem('classic-session', JSON.stringify({ token, username: 'ann' }));

  it('redirects to sign-in, signs in, then loads and saves todos with the bearer token', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/sign-in');

    const el = harness.fixture.nativeElement as HTMLElement;
    typeInto(el, 'input[name="username"]', 'ann');
    typeInto(el, 'input[name="password"]', 'secret123');
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    http.expectOne({ method: 'POST', url: '/api/sign-in' }).flush({ token: 't1', username: 'ann' });

    await vi.waitFor(() => {
      const load = http.expectOne('/api/todos');
      expect(load.request.headers.get('Authorization')).toBe('Bearer t1');
      load.flush([]);
    });
    await harness.fixture.whenStable();
    expect(el.textContent).toContain('Signed in as ann');

    typeInto(el, 'input[aria-label="New todo"]', 'Buy milk');
    el.querySelector('main form')!.dispatchEvent(new Event('submit'));
    await vi.waitFor(() => {
      const put = http.expectOne({ method: 'PUT', url: '/api/todos' });
      expect(put.request.body).toEqual([{ id: 1, title: 'Buy milk', done: false }]);
      put.flush(null);
    });
    await harness.fixture.whenStable();
    expect(el.textContent).toContain('1 item left');
  });

  it('shows the server error when sign-in fails', async () => {
    const harness = await RouterTestingHarness.create('/sign-in');
    const el = harness.fixture.nativeElement as HTMLElement;
    typeInto(el, 'input[name="username"]', 'ann');
    typeInto(el, 'input[name="password"]', 'wrong-pass');
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    http
      .expectOne('/api/sign-in')
      .flush({ error: 'Invalid username or password' }, { status: 401, statusText: 'Unauthorized' });
    await harness.fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Invalid username or password');
  });

  it('signs out and returns to sign-in when the server rejects the token', async () => {
    signedInAs('revoked');
    await RouterTestingHarness.create('/');
    http.expectOne('/api/todos').flush({ error: 'Not signed in' }, { status: 401, statusText: 'Unauthorized' });
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/sign-in'));
    expect(localStorage.getItem('classic-session')).toBeNull();
  });

  it('waits for a pending save before signing out', async () => {
    signedInAs('t1');
    const harness = await RouterTestingHarness.create('/');
    http.expectOne('/api/todos').flush([]);
    await harness.fixture.whenStable();

    const el = harness.fixture.nativeElement as HTMLElement;
    typeInto(el, 'input[aria-label="New todo"]', 'x');
    el.querySelector('main form')!.dispatchEvent(new Event('submit'));
    el.querySelector<HTMLButtonElement>('header button')!.click();

    const put = await vi.waitFor(() => http.expectOne({ method: 'PUT', url: '/api/todos' }));
    expect(http.match('/api/sign-out')).toEqual([]); // not revoked while the save is in flight
    put.flush(null);

    await vi.waitFor(() => {
      const signOut = http.expectOne({ method: 'POST', url: '/api/sign-out' });
      expect(signOut.request.headers.get('Authorization')).toBe('Bearer t1');
      signOut.flush(null);
    });
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/sign-in'));
  });

  it('ignores edits made before the list has loaded, so the load cannot overwrite them', async () => {
    signedInAs('t1');
    const harness = await RouterTestingHarness.create('/');
    const todos = TestBed.inject(TodoService);
    todos.add('too early'); // the input is disabled while loading; this is the service-level guard
    http.expectOne('/api/todos').flush([{ id: 1, title: 'from server', done: false }]);
    await harness.fixture.whenStable();
    expect(todos.todos()).toEqual([{ id: 1, title: 'from server', done: false }]);
    http.expectNone({ method: 'PUT', url: '/api/todos' });
  });

  it('keeps refusing edits when the load fails, so a partial list never replaces the server copy', async () => {
    signedInAs('t1');
    const harness = await RouterTestingHarness.create('/');
    http.expectOne('/api/todos').flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    await harness.fixture.whenStable();
    const todos = TestBed.inject(TodoService);
    todos.add('x');
    expect(todos.todos()).toEqual([]);
    http.expectNone({ method: 'PUT', url: '/api/todos' });
    expect((harness.fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('Could not load todos');
  });
});
