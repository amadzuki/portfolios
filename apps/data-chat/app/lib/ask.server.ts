/**
 * Server half of "ask a question". Only the dataset's schema (and, if allowed, five sample
 * rows) arrives here; the full data never leaves the browser. The `.server` suffix makes
 * React Router refuse to bundle this module into client code.
 */
import { z } from 'zod';
import { heuristicSpec } from './heuristic';
import { payloadColumns, type AskPayload } from './payload';
import {
  AGGREGATES,
  CHART_TYPES,
  FILTER_OPS,
  repairSpec,
  SORTS,
  TIME_UNITS,
  type ChartSpec,
} from './spec';

const name = z.string().max(120);
const spec = z
  .object({
    title: z.string().max(200),
    type: z.enum(CHART_TYPES),
    x: name.nullable(),
    timeUnit: z.enum(TIME_UNITS),
    y: name.nullable(),
    aggregate: z.enum(AGGREGATES),
    series: name.nullable(),
    filters: z
      .array(
        z.object({
          field: name,
          op: z.enum(FILTER_OPS),
          value: z.coerce.string().max(200),
        }),
      )
      .max(8),
    sort: z.enum(SORTS),
    limit: z.number().int().positive().max(500).nullable(),
    explanation: z.string().max(600),
  })
  .describe('A chart specification');

export const payloadSchema: z.ZodType<AskPayload> = z.object({
  question: z.string().trim().min(3).max(500),
  dataset: z.object({
    name: z.string().max(200),
    rowCount: z.number().int().nonnegative(),
    columns: z
      .array(
        z.object({
          name,
          type: z.enum(['number', 'date', 'category', 'text']),
          distinct: z.number().int().nonnegative(),
          nulls: z.number().int().nonnegative(),
          min: z.union([z.number(), z.string().max(40)]).optional(),
          max: z.union([z.number(), z.string().max(40)]).optional(),
          examples: z.array(z.string().max(60)).max(8).optional(),
        }),
      )
      .min(1)
      .max(80),
    sample: z
      .array(z.record(z.string(), z.string().max(80)))
      .max(8)
      .optional(),
  }),
  base: spec.partial().nullable().optional() as z.ZodType<
    ChartSpec | null | undefined
  >,
});

export const SYSTEM = `You turn questions about a tabular dataset into a chart specification.
You never see the full data, only its columns (with types and stats) and maybe a few sample rows. The chart is computed in the user's browser from your spec.

Return JSON with exactly these keys:
{
  "title": short figure title, sentence case, no trailing period,
  "type": one of ${CHART_TYPES.join(' | ')},
  "x": column to group by (category or date), or for scatter the numeric x column, or null for "number",
  "timeUnit": one of ${TIME_UNITS.join(' | ')} (only for a date x; otherwise "none"),
  "y": numeric column to measure, or null to count rows,
  "aggregate": one of ${AGGREGATES.join(' | ')},
  "series": optional second category column to split into colours, or null,
  "filters": [{ "field": column, "op": ${FILTER_OPS.join(' | ')}, "value": string }],
  "sort": one of ${SORTS.join(' | ')},
  "limit": number of groups to keep (e.g. for "top 5"), or null,
  "explanation": one or two plain sentences on what the chart shows and why this form answers the question
}

Rules:
- Use column names exactly as given. Never invent columns.
- Time trends: "line" (several series) or "area" (one series) with a date x and a sensible timeUnit.
- Rankings and comparisons across categories: "bar", or "hbar" when there are many categories or long labels.
- Part-to-whole with few categories: "donut". Relationship between two numeric columns: "scatter".
- A single figure ("what is the total ..."): "number" with x null.
- "count" ignores y. Use "distinct" to count unique values of a non-numeric y.
- Filter values for categories must match an example value when examples are given. Dates as YYYY-MM-DD.
- If a previous figure is given, the question is a follow-up: change only what the user asks for and keep the rest.
- If the question can't be answered from these columns, pick the closest useful chart and say so in the explanation.`;

export function buildPrompt(p: AskPayload): string {
  const cols = p.dataset.columns
    .map((c) => {
      const range = c.min != null ? `, range ${c.min} … ${c.max}` : '';
      const ex = c.examples?.length
        ? `, e.g. ${c.examples.map((e) => JSON.stringify(e)).join(', ')}`
        : '';
      return `- ${c.name} (${c.type}, ${c.distinct} distinct${c.nulls ? `, ${c.nulls} empty` : ''}${range}${ex})`;
    })
    .join('\n');
  const sample = p.dataset.sample?.length
    ? `\n\nSample rows:\n${JSON.stringify(p.dataset.sample)}`
    : '';
  const base = p.base
    ? `\n\nPrevious figure (refine it):\n${JSON.stringify(p.base)}`
    : '';
  return `Dataset "${p.dataset.name}", ${p.dataset.rowCount} rows.\nColumns:\n${cols}${sample}${base}\n\nQuestion: ${p.question}`;
}

export type AskResult =
  | {
      ok: true;
      spec: ChartSpec;
      notes: string[];
      source: 'model' | 'offline';
      question: string;
    }
  | { ok: false; error: string };

let guard: ReturnType<typeof import('@portfolios/llm').createGuard> | undefined;

export async function ask(request: Request, raw: unknown): Promise<AskResult> {
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: 'Ask a question of at least a few words.' };
  const payload = parsed.data;
  const columns = payloadColumns(payload);
  const offline = (note: string): AskResult => ({
    ok: true,
    spec: heuristicSpec(payload.question, columns, payload.base),
    notes: [note],
    source: 'offline',
    question: payload.question,
  });

  // Imported lazily so API keys and SDKs stay in the server bundle only.
  const { llm, createGuard, clientKey } = await import('@portfolios/llm');
  const missing = llm.missingCredentials();
  if (missing)
    return offline(
      `Offline mode: ${missing} isn't set, so a rule-based parser drew this.`,
    );

  guard ??= createGuard({ limit: 8, windowMs: 60_000, dailyBudget: 800 });
  const gate = guard(clientKey(request.headers));
  if (!gate.ok)
    return offline(
      gate.reason === 'rate_limited'
        ? 'Rate limited for a minute, so the rule-based parser answered.'
        : "Today's model budget is used up, so the rule-based parser answered.",
    );

  try {
    const { object } = await llm.generateObject({
      role: 'fast',
      schema: spec,
      system: SYSTEM,
      prompt: buildPrompt(payload),
      temperature: 0.2,
      maxOutputTokens: 800,
      signal: request.signal,
    });
    const repaired = repairSpec(object, columns);
    return {
      ok: true,
      spec: repaired.spec,
      notes: repaired.notes,
      source: 'model',
      question: payload.question,
    };
  } catch (err) {
    console.error('[data-chat] model call failed', err);
    return offline(
      "The model didn't answer cleanly, so the rule-based parser drew this.",
    );
  }
}
