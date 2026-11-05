import { expect, test } from '@playwright/test';

/** A canned UI-message stream, so the test runs without any LLM credentials. */
const stream = (text: string) =>
  [
    { type: 'start' },
    { type: 'start-step' },
    { type: 'text-start', id: 't' },
    ...text
      .split(/(?<= )/)
      .map((delta) => ({ type: 'text-delta', id: 't', delta })),
    { type: 'text-end', id: 't' },
    { type: 'finish-step' },
    { type: 'finish' },
  ]
    .map((c) => `data: ${JSON.stringify(c)}\n\n`)
    .join('') + 'data: [DONE]\n\n';

test('Ask Ahmad streams an answer and renders citations as links', async ({
  page,
}) => {
  await page.route('**/api/chat', (route) =>
    route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'x-vercel-ai-ui-message-stream': 'v1',
      },
      body: stream(
        'He managed 4 concurrent projects at ProSpace [exp-prospace].',
      ),
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Ask Ahmad' }).click();
  await page
    .getByRole('button', { name: 'What did he build at ProSpace?' })
    .click();

  const chat = page.getByRole('region', { name: 'Ask Ahmad chat' });
  await expect(
    chat.getByText('He managed 4 concurrent projects'),
  ).toBeVisible();
  await expect(
    chat.getByRole('link', { name: 'Frontend Developer, ProSpace' }),
  ).toHaveAttribute('href', '/#exp-prospace');
});

test('Ask Ahmad shows a friendly error when the model is not configured', async ({
  page,
}) => {
  await page.route('**/api/chat', (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Ask Ahmad isn't connected to a model yet." },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Ask Ahmad' }).click();
  await page.getByRole('textbox', { name: 'Your question' }).fill('hi');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(
    page.getByText("Ask Ahmad isn't connected to a model yet."),
  ).toBeVisible();
});
