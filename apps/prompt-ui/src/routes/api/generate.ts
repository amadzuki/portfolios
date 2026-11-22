import { createFileRoute } from '@tanstack/react-router';
import { buildMessages, generateRequest, SYSTEM } from '../../lib/prompt';

/**
 * Streams generated component source as plain text. The LLM layer is imported lazily so it
 * (and any API keys it reads) can never end up in the client bundle.
 */
export const Route = createFileRoute('/api/generate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { llm, createGuard, clientKey } = await import('@portfolios/llm');
        guard ??= createGuard({ limit: 6, windowMs: 60_000, dailyBudget: 600 });

        const missing = llm.missingCredentials();
        if (missing) {
          return Response.json(
            {
              error: `Generation is offline (${missing} is not set). Try the examples meanwhile.`,
            },
            { status: 503 },
          );
        }
        const gate = guard(clientKey(request.headers));
        if (!gate.ok) {
          return Response.json(
            {
              error:
                gate.reason === 'rate_limited'
                  ? 'Slow down a little, try again in a minute.'
                  : 'Daily generation budget used up.',
            },
            {
              status: 429,
              headers: {
                'Retry-After': String(Math.ceil(gate.retryAfterMs / 1000)),
              },
            },
          );
        }
        const parsed = generateRequest.safeParse(
          await request.json().catch(() => null),
        );
        if (!parsed.success)
          return Response.json(
            { error: 'Describe the component in at least a few words.' },
            { status: 400 },
          );

        const result = llm.streamText({
          role: 'code',
          system: SYSTEM,
          messages: buildMessages(parsed.data),
          maxOutputTokens: 4000,
          temperature: 0.5,
          signal: request.signal,
        });
        return result.toTextStreamResponse({
          headers: { 'Cache-Control': 'no-store' },
        });
      },
    },
  },
});

let guard: ReturnType<typeof import('@portfolios/llm').createGuard> | undefined;
