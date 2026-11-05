import { expect, test } from '@playwright/test';

test('home renders the name, work and lab sections without errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Ahmad Marzuki',
  );
  await expect(
    page.getByRole('img', { name: /drawn with interactive particles/ }),
  ).toBeAttached();
  await expect(page.getByText('Twelve letters, six techniques.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('lab pages navigate with the glyph strip and arrow keys', async ({
  page,
}) => {
  await page.goto('/lab/a-attraction');
  await expect(
    page.getByRole('heading', { level: 2, name: 'A is for Attraction' }),
  ).toBeVisible();

  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/\/lab\/h-height$/);
  await expect(
    page.getByRole('heading', { level: 2, name: 'H is for Height' }),
  ).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Lab experiments' })
    .getByTitle('D is for Dunes')
    .click();
  await expect(page).toHaveURL(/\/lab\/d-dunes$/);
});
