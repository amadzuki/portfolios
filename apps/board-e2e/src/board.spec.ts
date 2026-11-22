import { expect, test } from '@playwright/test';

const room = () => `e2e-${Math.random().toString(36).slice(2, 10)}`;
const notes = (page: import('@playwright/test').Page) =>
  page.locator('[data-note]');

test('start a board works without JavaScript (SvelteKit form action)', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByTestId('start').click();
  await expect(page).toHaveURL(/\/b\/[a-z0-9-]+\?seed=retro$/);
  await ctx.close();
});

test('two people see each other’s notes, moves and tidy-up live', async ({
  browser,
  isMobile,
}) => {
  test.skip(isMobile, 'Two-browser sync is covered on desktop.');
  const url = `/b/${room()}?seed=retro`;
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await a.goto(url);
  await expect(notes(a)).toHaveCount(14, { timeout: 15_000 });
  await b.goto(url.split('?')[0]!);
  await expect(notes(b)).toHaveCount(14, { timeout: 15_000 });
  await expect(a.getByTestId('presence').locator('span')).toHaveCount(1);

  // A adds a note by double-clicking empty canvas and types into it.
  await a.getByTestId('canvas').dblclick({ position: { x: 60, y: 160 } });
  await a.keyboard.type('Hello from A');
  await expect(notes(b)).toHaveCount(15);
  await expect(b.getByText('Hello from A')).toBeVisible();

  // Tidy-up (offline keyword mode in e2e) reaches the other browser, and undo reverts it.
  await a.getByTestId('tidy').click();
  await expect(a.getByTestId('toast')).toContainText(/grouped/i);
  await expect(b.getByTestId('frame').first()).toBeVisible();
  await a.getByRole('button', { name: 'Undo', exact: true }).last().click();
  await expect(b.getByTestId('frame')).toHaveCount(0);
});

test('deleting a note with the keyboard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Keyboard shortcut.');
  await page.goto(`/b/${room()}`);
  await expect(page.getByTestId('status')).toHaveAttribute(
    'data-status',
    'connected',
  );
  await page.keyboard.press('n');
  await page.keyboard.type('Temporary');
  await page.keyboard.press('Escape');
  await expect(notes(page)).toHaveCount(1);
  await page.keyboard.press('Delete');
  await expect(notes(page)).toHaveCount(0);
});

test('mobile: tap a note twice to edit it', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch flow.');
  await page.goto(`/b/${room()}?seed=retro`);
  await expect(notes(page)).toHaveCount(14, { timeout: 15_000 });
  const n = notes(page).first();
  await n.tap();
  await n.tap();
  await expect(page.getByLabel('Note text')).toBeFocused();
});
