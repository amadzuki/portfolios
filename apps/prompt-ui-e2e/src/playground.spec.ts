import { expect, test, type Page } from '@playwright/test';

const generated = `\`\`\`tsx
import { useState } from 'react';
export default function App() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)} className="m-8 rounded-xl bg-violet-600 px-4 py-2 text-white">Clicked {n}</button>;
}
\`\`\``;

const preview = (page: Page) =>
  page.frameLocator('iframe[title="Component preview"]');

test('renders the default example in the sandbox and switches examples', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  await expect(
    preview(page).getByRole('heading', { name: 'Simple pricing' }),
  ).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Habit tracker' }).click();
  await expect(page).toHaveURL(/example=habits/);
  await expect(
    preview(page).getByRole('heading', { name: 'Habits' }),
  ).toBeVisible({ timeout: 20_000 });
  if (!isMobile)
    await expect(page.getByRole('region', { name: 'Code' })).toContainText(
      'Habit',
    );
});

test('streams a generated component, renders it, and records a version', async ({
  page,
  isMobile,
}) => {
  await page.route('**/api/generate', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: generated,
    }),
  );
  await page.goto('/');
  await page.getByLabel('Describe a component').fill('a counter button');
  await page.getByRole('button', { name: 'Generate' }).click();

  const button = preview(page).getByRole('button', { name: 'Clicked 0' });
  await expect(button).toBeVisible({ timeout: 20_000 });
  await button.click();
  await expect(
    preview(page).getByRole('button', { name: 'Clicked 1' }),
  ).toBeVisible();
  if (!isMobile)
    await expect(
      page.getByRole('button', { name: /v2\s*a counter button/ }),
    ).toBeVisible();
});

test('shows API errors and keeps the previous component', async ({ page }) => {
  await page.route('**/api/generate', (route) =>
    route.fulfill({
      status: 503,
      json: { error: 'Generation is offline (GLM_API_KEY is not set).' },
    }),
  );
  await page.goto('/');
  await page.getByLabel('Describe a component').fill('anything at all');
  await page.getByRole('button', { name: 'Generate' }).click();
  await expect(page.getByRole('alert')).toContainText('Generation is offline');
  await expect(
    preview(page).getByRole('heading', { name: 'Simple pricing' }),
  ).toBeVisible({ timeout: 20_000 });
});

test('the sandbox cannot reach the host page', async ({ page }) => {
  await page.goto('/');
  const sandbox = await page
    .locator('iframe[title="Component preview"]')
    .getAttribute('sandbox');
  expect(sandbox).not.toContain('allow-same-origin');
});
