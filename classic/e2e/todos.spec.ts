// Classic e2e: no introspection layer, so every check goes through the rendered page.
import { expect, test, type Page } from '@playwright/test';

const newUser = () => ({
  username: `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
  password: 'secret123',
});

async function fillCredentials(page: Page, user: { username: string; password: string }) {
  // Right after an in-app navigation the input exists before Angular forms binds it, and binding
  // writes the control's initial '' over anything typed. ng-pristine appears once it is bound.
  await expect(page.getByLabel('Username')).toHaveClass(/ng-pristine/);
  await page.getByLabel('Username').fill(user.username);
  await page.getByLabel('Password').fill(user.password);
}

test('sends signed-out users to the sign-in page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('rejects unknown credentials', async ({ page }) => {
  await page.goto('/sign-in');
  await fillCredentials(page, newUser());
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password');
});

test('manages todos and keeps them across sign-out', async ({ page }) => {
  const user = newUser();
  await page.goto('/sign-in');
  await fillCredentials(page, user);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText(`Signed in as ${user.username}`)).toBeVisible();

  const newTodo = page.getByLabel('New todo');
  for (const title of ['Buy milk', 'Walk dog']) {
    await newTodo.fill(title);
    await newTodo.press('Enter');
  }
  await expect(page.getByText('2 items left')).toBeVisible();

  await page.getByLabel('Toggle Buy milk').check();
  await expect(page.getByText('1 item left')).toBeVisible();

  await page.getByRole('button', { name: /^active$/i }).click();
  await expect(page.getByLabel('Edit Buy milk')).toHaveCount(0);
  await expect(page.getByLabel('Edit Walk dog')).toBeVisible();
  await page.getByRole('button', { name: /^all$/i }).click();

  await page.getByRole('button', { name: 'Clear completed' }).click();
  await expect(page.getByLabel('Edit Buy milk')).toHaveCount(0);

  const walk = page.getByLabel('Edit Walk dog');
  await walk.fill('Walk the dog');
  await walk.press('Enter'); // commits via the change event
  await expect(page.getByLabel('Edit Walk the dog')).toHaveValue('Walk the dog');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await fillCredentials(page, user);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByLabel('Edit Walk the dog')).toHaveValue('Walk the dog');
  await expect(page.getByText('1 item left')).toBeVisible();
});
