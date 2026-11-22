import type { Cell, ColumnProfile, ColumnType, Row } from './types';

const NUMBER = /^[-+]?(?:\d{1,3}(?:,\d{3})+|\d*)(?:\.\d+)?(?:e[-+]?\d+)?%?$/i;
const DATE =
  /^\d{4}-\d{1,2}-\d{1,2}(?:[T ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const SLASH_DATE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
const EMPTY = new Set(['', 'na', 'n/a', 'null', 'none', '-', 'nan']);

export const isEmpty = (v: string | undefined | null) =>
  v == null || EMPTY.has(v.trim().toLowerCase());

export function parseNumber(v: string): number | null {
  const s = v.trim();
  if (!s || !NUMBER.test(s) || s === '-' || s === '+' || s === '.') return null;
  const n = Number(s.replace(/,/g, '').replace(/%$/, ''));
  return Number.isFinite(n) ? n : null;
}

export function parseDate(v: string): number | null {
  const s = v.trim();
  if (DATE.test(s)) {
    // Pad "2024-1-5" to ISO; date-only ISO strings parse as UTC, which keeps buckets stable.
    const [date = '', time] = s.split(/[T ]/);
    const [y, m, d] = date.split('-');
    const isoDate = `${y}-${m?.padStart(2, '0')}-${d?.padStart(2, '0')}`;
    const t = Date.parse(time ? `${isoDate}T${time}` : isoDate);
    return Number.isFinite(t) ? t : null;
  }
  if (SLASH_DATE.test(s)) {
    const [m, d, y] = s.split('/').map(Number);
    if (!m || !d || !y || m > 12 || d > 31) return null;
    return Date.UTC(y, m - 1, d);
  }
  return null;
}

/**
 * Picks a type per column from the raw strings. A type wins when at least 95% of the
 * non-empty values parse as it; low-cardinality strings become categories.
 */
export function inferType(values: string[]): ColumnType {
  const present = values.filter((v) => !isEmpty(v));
  if (present.length === 0) return 'text';
  const share = (fn: (v: string) => unknown) =>
    present.reduce((n, v) => n + (fn(v) != null ? 1 : 0), 0) / present.length;
  if (share(parseDate) >= 0.95) return 'date';
  if (share(parseNumber) >= 0.95) return 'number';
  const distinct = new Set(present).size;
  const limit = Math.max(12, Math.min(200, present.length * 0.2));
  const avgLen = present.reduce((n, v) => n + v.length, 0) / present.length;
  return distinct <= limit && avgLen < 48 ? 'category' : 'text';
}

export function convert(value: string | undefined, type: ColumnType): Cell {
  if (isEmpty(value)) return null;
  const v = (value as string).trim();
  if (type === 'number') return parseNumber(v);
  if (type === 'date') return parseDate(v);
  return v;
}

const BINS = 16;

export function profileColumn(
  name: string,
  type: ColumnType,
  cells: Cell[],
  hasTime = false,
): ColumnProfile {
  let nulls = 0;
  const seen = new Map<string | number, number>();
  for (const c of cells) {
    if (c == null) {
      nulls++;
      continue;
    }
    seen.set(c, (seen.get(c) ?? 0) + 1);
  }
  const p: ColumnProfile = { name, type, nulls, distinct: seen.size };
  if (type === 'number' || type === 'date') {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let n = 0;
    for (const c of cells)
      if (typeof c === 'number') {
        if (c < min) min = c;
        if (c > max) max = c;
        sum += c;
        n++;
      }
    if (n) {
      p.min = min;
      p.max = max;
      p.mean = sum / n;
      const hist = new Array<number>(BINS).fill(0);
      const span = max - min || 1;
      for (const c of cells)
        if (typeof c === 'number')
          hist[Math.min(BINS - 1, Math.floor(((c - min) / span) * BINS))]!++;
      p.histogram = hist;
    }
    if (type === 'date') p.hasTime = hasTime;
  } else {
    p.top = [...seen]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([value, count]) => ({ value: String(value), count }));
  }
  return p;
}

/** Turns raw string records into typed rows plus a profile for each column. */
export function buildDataset(
  fields: string[],
  raw: Record<string, string>[],
): { rows: Row[]; columns: ColumnProfile[] } {
  const names = dedupe(fields.map((f, i) => f.trim() || `column_${i + 1}`));
  const sampleSize = Math.min(raw.length, 2000);
  const step = raw.length / sampleSize || 1;
  const types = fields.map((f) => {
    const sample: string[] = [];
    for (let i = 0; i < sampleSize; i++)
      sample.push(raw[Math.floor(i * step)]?.[f] ?? '');
    return inferType(sample);
  });
  const rows: Row[] = raw.map((r) => {
    const row: Row = {};
    fields.forEach((f, i) => (row[names[i]!] = convert(r[f], types[i]!)));
    return row;
  });
  const columns = names.map((name, i) => {
    const type = types[i]!;
    const hasTime =
      type === 'date' && raw.some((r) => (r[fields[i]!] ?? '').length > 10);
    return profileColumn(
      name,
      type,
      rows.map((r) => r[name] ?? null),
      hasTime,
    );
  });
  return { rows, columns };
}

function dedupe(names: string[]) {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const c = seen.get(n) ?? 0;
    seen.set(n, c + 1);
    return c ? `${n}_${c + 1}` : n;
  });
}
