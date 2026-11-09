// The one UI-level flow: checks the views are wired to the ViewModels (clicks, typing, rendering).
// Behavior lives in the journeys; this only proves the screen drives them.
import { expect, test } from '@playwright/test';

test('a user can register, add a todo and sign out through the UI', async ({ page }) => {
  const username = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill('secret123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText(`Signed in as ${username}`)).toBeVisible();

  const newTodo = page.getByLabel('New todo');
  await newTodo.fill('Buy milk');
  await newTodo.press('Enter');
  await expect(page.getByLabel('Edit Buy milk')).toHaveValue('Buy milk');
  await page.getByLabel('Toggle Buy milk').check();
  await expect(page.getByText('0 items left')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});
