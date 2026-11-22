import type { ChartSpec } from './spec';
import type { ColumnProfile, DatasetMeta, Row } from './types';

/**
 * Exactly what leaves the browser when a question is asked. Built on the client, shown to
 * the user verbatim in "What gets sent", and validated again on the server.
 */
export interface AskPayload {
  question: string;
  dataset: {
    name: string;
    rowCount: number;
    columns: {
      name: string;
      type: ColumnProfile['type'];
      distinct: number;
      nulls: number;
      min?: number | string;
      max?: number | string;
      examples?: string[];
    }[];
    /** A handful of rows, only if the user allows it. */
    sample?: Record<string, string>[];
  };
  /** The figure being refined, for follow-ups. */
  base?: ChartSpec | null;
}

export const SAMPLE_ROWS = 5;

const fmtCell = (v: Row[string], col: ColumnProfile) =>
  v == null
    ? ''
    : col.type === 'date' && typeof v === 'number'
      ? new Date(v).toISOString().slice(0, col.hasTime ? 16 : 10)
      : String(v);

export function buildPayload(
  meta: DatasetMeta,
  rows: Row[],
  opts: { question: string; includeSample: boolean; base?: ChartSpec | null },
): AskPayload {
  const columns = meta.columns.map((c) => {
    const out: AskPayload['dataset']['columns'][number] = {
      name: c.name,
      type: c.type,
      distinct: c.distinct,
      nulls: c.nulls,
    };
    if (c.type === 'number') {
      out.min = round(c.min);
      out.max = round(c.max);
    }
    if (c.type === 'date' && c.min != null && c.max != null) {
      out.min = new Date(c.min).toISOString().slice(0, 10);
      out.max = new Date(c.max).toISOString().slice(0, 10);
    }
    // Category names help the model write filters ("only Jakarta"). Free text never goes.
    if (opts.includeSample && c.type === 'category' && c.top)
      out.examples = c.top.map((t) => t.value.slice(0, 40));
    return out;
  });
  const payload: AskPayload = {
    question: opts.question.trim(),
    dataset: { name: meta.name, rowCount: meta.rowCount, columns },
  };
  if (opts.includeSample) {
    const step = Math.max(1, Math.floor(rows.length / SAMPLE_ROWS));
    payload.dataset.sample = Array.from(
      { length: Math.min(SAMPLE_ROWS, rows.length) },
      (_, i) => {
        const r = rows[i * step]!;
        const o: Record<string, string> = {};
        for (const c of meta.columns)
          o[c.name] = fmtCell(r[c.name] ?? null, c).slice(0, 60);
        return o;
      },
    );
  }
  if (opts.base) payload.base = opts.base;
  return payload;
}

const round = (n?: number) =>
  n == null
    ? undefined
    : Math.abs(n) >= 100
      ? Math.round(n)
      : Math.round(n * 100) / 100;

/** Reconstructs just enough of a column profile on the server to repair a spec. */
export function payloadColumns(p: AskPayload): ColumnProfile[] {
  return p.dataset.columns.map((c) => ({
    name: c.name,
    type: c.type,
    distinct: c.distinct,
    nulls: c.nulls,
    min: typeof c.min === 'string' ? Date.parse(c.min) : c.min,
    max: typeof c.max === 'string' ? Date.parse(c.max) : c.max,
    top: c.examples?.map((value) => ({ value, count: 1 })),
  }));
}
