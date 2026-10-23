import { expect, test } from '@playwright/test';

test('separate investigator and administrator login portals enforce the selected role', async ({ page }) => {
  await page.goto('/admin-login');
  await expect(page.getByRole('heading', { name: 'Administrator Console Login' })).toBeVisible();
  await expect(page.getByLabel('Administrator email')).toBeVisible();
  await expect(page.getByRole('button', { name: /investigator account/i })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Investigator Login' }).click();
  await expect(page).toHaveURL(/\/investigator-login$/);
  await expect(page.getByRole('heading', { name: 'Investigator Workspace Login' })).toBeVisible();
  await expect(page.getByLabel('Investigator email')).toBeVisible();
  await expect(page.getByRole('button', { name: /investigator account/i })).toBeVisible();

  await page.getByRole('tab', { name: 'Administrator Login' }).click();
  await expect(page).toHaveURL(/\/admin-login$/);
  await expect(page.getByRole('heading', { name: 'Administrator Console Login' })).toBeVisible();
});

test('direct investigator URL remains a distinct portal after reload', async ({ page }) => {
  await page.goto('/investigator-login');
  await expect(page.getByRole('heading', { name: 'Investigator Workspace Login' })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/investigator-login$/);
  await expect(page.getByLabel('Investigator email')).toBeVisible();
  await expect(page.getByLabel('Administrator email')).toHaveCount(0);
});
