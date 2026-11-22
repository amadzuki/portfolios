import { json } from '@sveltejs/kit';
import { z } from 'zod';
import {
  clusterByKeywords,
  normalizeClusters,
  type Cluster,
} from '#lib/cluster.ts';
import type { RequestHandler } from './$types';

const body = z.object({
  notes: z
    .array(z.object({ id: z.string().max(40), text: z.string().max(600) }))
    .min(2)
    .max(150),
});

const answer = z.object({
  groups: z
    .array(
      z.object({
        label: z.string().describe('2-4 word theme, Title Case'),
        noteIds: z.array(z.string()),
      }),
    )
    .max(8),
});

const SYSTEM = `You organise sticky notes from a collaborative whiteboard into themes.
Return JSON: {"groups": [{"label": "Short theme", "noteIds": ["id", ...]}]}.
Rules:
- 2 to 7 groups. Every note id appears in exactly one group. Use only the given ids.
- Labels are 1-4 words, Title Case, specific ("Deploy pipeline", not "Issues").
- Group by meaning, not by shared words. Put true outliers in a group called "Other".
- Notes may be in any language; label in the language most notes use.`;

let guard: ReturnType<typeof import('@portfolios/llm').createGuard> | undefined;

/** Clusters notes by theme. Falls back to keyword grouping when the model isn't available. */
export const POST: RequestHandler = async ({ request }) => {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return json(
      { error: 'Add at least two notes with text first.' },
      { status: 400 },
    );
  const notes = parsed.data.notes.filter((n) => n.text.trim());
  const ids = notes.map((n) => n.id);
  const offline = (note: string) =>
    json({
      groups: clusterByKeywords(notes),
      source: 'offline',
      note,
    } satisfies TidyResponse);

  if (notes.length < 2)
    return json(
      { error: 'Add at least two notes with text first.' },
      { status: 400 },
    );

  // Lazy import keeps the LLM layer (and API keys) out of anything the client could load.
  const { llm, createGuard, clientKey } = await import('@portfolios/llm');
  const missing = llm.missingCredentials();
  if (missing)
    return offline(
      `No ${missing} set, so notes were grouped by shared keywords.`,
    );
  guard ??= createGuard({ limit: 6, windowMs: 60_000, dailyBudget: 500 });
  const gate = guard(clientKey(request.headers));
  if (!gate.ok)
    return offline(
      'The model is rate limited right now, so notes were grouped by keywords.',
    );

  try {
    const { object } = await llm.generateObject({
      role: 'fast',
      schema: answer,
      system: SYSTEM,
      prompt: JSON.stringify(
        notes.map((n) => ({ id: n.id, text: n.text.slice(0, 300) })),
      ),
      temperature: 0.2,
      maxOutputTokens: 1200,
      signal: request.signal,
    });
    return json({
      groups: normalizeClusters(object.groups, ids),
      source: 'model',
    } satisfies TidyResponse);
  } catch (err) {
    console.error('[board] tidy failed', err);
    return offline(
      'The model didn’t answer cleanly, so notes were grouped by keywords.',
    );
  }
};

export interface TidyResponse {
  groups: Cluster[];
  source: 'model' | 'offline';
  note?: string;
}
