import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { memoryApi, memorySessions } from '../core/api.ts';
import { AppViewModel } from '../core/app.view-model.ts';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  it('shows the sign-in route, then the todo list after signing in', async () => {
    const vm = new AppViewModel(memoryApi(), memorySessions());
    TestBed.configureTestingModule({ providers: [provideRouter(routes), { provide: AppViewModel, useValue: vm }] });
    const fixture = TestBed.createComponent(App);
    const el = fixture.nativeElement as HTMLElement;

    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(el.querySelector('input[name="username"]')).toBeTruthy();
    });

    vm.signIn.send({ type: 'register', username: 'ann', password: 'secret123' });
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(el.textContent).toContain('Signed in as ann');
    });

    vm.todos()!.send({ type: 'add', title: 'Buy milk' });
    await fixture.whenStable();
    expect(el.querySelector<HTMLInputElement>('li .title')?.value).toBe('Buy milk');
    expect(el.textContent).toContain('1 item left');
  });
});
