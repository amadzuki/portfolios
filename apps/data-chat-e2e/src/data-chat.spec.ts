import { expect, test } from '@playwright/test';

// No API key is configured in e2e, so answers come from the offline rule-based parser,
// which exercises the full loop: server action → spec → in-browser aggregation → visx.

test('home is prerendered and lists the samples', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Get a chart back',
  );
  await expect(page.getByRole('link', { name: /Kopi sales/ })).toBeVisible();
});

test('asks a sample dataset a question and edits the answer', async ({
  page,
}) => {
  await page.goto('/d/kopi-sales');
  await expect(
    page.getByRole('heading', { name: 'Kopi sales', level: 1 }),
  ).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Monthly revenue by city' }).click();
  const fig = page.getByTestId('figure').first();
  await expect(fig).toBeVisible({ timeout: 15_000 });
  await expect(fig.getByTestId('figure-source')).toHaveText('offline parser');
  await expect(fig.locator('[data-chart="line"] svg path.line')).toHaveCount(6);

  await fig.getByRole('button', { name: /Edit spec/ }).click();
  await fig.getByRole('radio', { name: 'Area' }).click();
  await expect(fig.locator('[data-chart="area"]')).toBeVisible();

  // Edits are saved in IndexedDB and survive a reload.
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByTestId('figure-source').first()).toHaveText(
    'edited by hand',
    { timeout: 15_000 },
  );
  await expect(page.locator('[data-chart="area"]')).toBeVisible();
});

test('shows exactly what would be sent, without the rows', async ({ page }) => {
  await page.goto('/d/bogor-weather');
  await page.getByText('What gets sent?').click();
  const payload = page.getByTestId('payload');
  await expect(payload).toContainText('"rainfall_mm"');
  await expect(payload).toContainText('"sample"');
  await page.getByLabel(/Share 5 sample rows/).uncheck();
  await expect(payload).not.toContainText('"sample"');
});

test('parses an uploaded CSV in the browser', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'team-scores.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'name,team,score,joined\nAyu,red,12,2024-01-05\nBima,blue,30,2024-02-11\nCitra,red,18,2024-03-02\n',
    ),
  });
  await expect(page).toHaveURL(/\/d\//, { timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: 'team-scores', level: 1 }),
  ).toBeVisible();
  await page.locator('textarea').fill('average score by team');
  await page.keyboard.press('Enter');
  await expect(
    page
      .getByTestId('figure')
      .getByRole('heading', { name: 'Average score by team' }),
  ).toBeVisible({ timeout: 15_000 });
});
