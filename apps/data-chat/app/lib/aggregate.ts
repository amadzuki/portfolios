import type { Aggregate, ChartSpec, Filter, TimeUnit } from './spec';
import type { Cell, ColumnProfile, Row } from './types';

export const OTHER = 'Other';
const MAX_SERIES = 6;
const MAX_SCATTER = 4000;

export type XValue = string | number;

export type ChartData =
  | {
      kind: 'xy';
      /** time: x is epoch ms bucket start. */
      xType: 'category' | 'time';
      points: { x: XValue; values: Record<string, number> }[];
      series: string[];
      total: number;
      matched: number;
    }
  | {
      kind: 'scatter';
      points: { x: number; y: number; series: string }[];
      series: string[];
      matched: number;
    }
  | { kind: 'value'; value: number; matched: number };

export function matchesFilter(cell: Cell, f: Filter, col?: ColumnProfile) {
  if (f.op === 'contains')
    return String(cell ?? '')
      .toLowerCase()
      .includes(f.value.toLowerCase());
  if (cell == null) return f.op === 'neq' ? f.value !== '' : f.value === '';
  let target: string | number = f.value;
  if (col?.type === 'number') target = Number(f.value);
  if (col?.type === 'date') target = Date.parse(f.value);
  if (typeof cell === 'string') {
    const a = cell.toLowerCase();
    const b = String(target).toLowerCase();
    switch (f.op) {
      case 'eq':
        return a === b;
      case 'neq':
        return a !== b;
      case 'gt':
        return a > b;
      case 'gte':
        return a >= b;
      case 'lt':
        return a < b;
      case 'lte':
        return a <= b;
    }
  }
  const t = typeof target === 'number' ? target : Number(target);
  if (!Number.isFinite(t)) return false;
  switch (f.op) {
    case 'eq':
      return col?.type === 'date' ? sameDay(cell as number, t) : cell === t;
    case 'neq':
      return cell !== t;
    case 'gt':
      return (cell as number) > t;
    case 'gte':
      return (cell as number) >= t;
    case 'lt':
      return (cell as number) < t;
    case 'lte':
      return (cell as number) <= t;
  }
  return true;
}

const sameDay = (a: number, b: number) =>
  Math.floor(a / 86_400_000) === Math.floor(b / 86_400_000);

/** Start of the UTC bucket containing `t`. Weeks start on Monday. */
export function bucket(t: number, unit: TimeUnit): number {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  switch (unit) {
    case 'hour':
      return Math.floor(t / 3_600_000) * 3_600_000;
    case 'day':
    case 'none':
      return Date.UTC(y, m, d.getUTCDate());
    case 'week': {
      const day = Date.UTC(y, m, d.getUTCDate());
      const dow = (d.getUTCDay() + 6) % 7;
      return day - dow * 86_400_000;
    }
    case 'month':
      return Date.UTC(y, m, 1);
    case 'quarter':
      return Date.UTC(y, m - (m % 3), 1);
    case 'year':
      return Date.UTC(y, 0, 1);
  }
}

class Acc {
  n = 0;
  sum = 0;
  min = Infinity;
  max = -Infinity;
  values: number[] | null = null;
  set: Set<Cell> | null = null;
  constructor(private agg: Aggregate) {
    if (agg === 'median') this.values = [];
    if (agg === 'distinct') this.set = new Set();
  }
  add(v: Cell) {
    if (this.agg === 'count') {
      this.n++;
      return;
    }
    if (v == null) return;
    if (this.set) {
      this.set.add(v);
      return;
    }
    if (typeof v !== 'number') return;
    this.n++;
    this.sum += v;
    if (v < this.min) this.min = v;
    if (v > this.max) this.max = v;
    this.values?.push(v);
  }
  result(): number {
    switch (this.agg) {
      case 'count':
        return this.n;
      case 'sum':
        return this.sum;
      case 'avg':
        return this.n ? this.sum / this.n : 0;
      case 'min':
        return this.n ? this.min : 0;
      case 'max':
        return this.n ? this.max : 0;
      case 'distinct':
        return this.set!.size;
      case 'median': {
        const v = this.values!.sort((a, b) => a - b);
        if (!v.length) return 0;
        const mid = v.length >> 1;
        return v.length % 2 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
      }
    }
  }
}

/** Runs a spec against the rows. Pure and synchronous: it runs in the browser, on all rows. */
export function aggregate(
  spec: ChartSpec,
  rows: Row[],
  columns: ColumnProfile[],
): ChartData {
  const byName = new Map(columns.map((c) => [c.name, c]));
  const filters = spec.filters.map((f) => ({ f, col: byName.get(f.field) }));
  const filtered = filters.length
    ? rows.filter((r) =>
        filters.every(({ f, col }) =>
          matchesFilter(r[f.field] ?? null, f, col),
        ),
      )
    : rows;

  if (spec.type === 'number' || !spec.x) {
    const acc = new Acc(spec.aggregate);
    for (const r of filtered) acc.add(spec.y ? (r[spec.y] ?? null) : 1);
    return { kind: 'value', value: acc.result(), matched: filtered.length };
  }

  if (spec.type === 'scatter' && spec.y) {
    const step = Math.max(1, filtered.length / MAX_SCATTER);
    const points: { x: number; y: number; series: string }[] = [];
    const series = topSeries(filtered, spec.series);
    for (let i = 0; i < filtered.length; i += step) {
      const r = filtered[Math.floor(i)]!;
      const x = r[spec.x];
      const y = r[spec.y];
      if (typeof x !== 'number' || typeof y !== 'number') continue;
      points.push({ x, y, series: seriesKey(r, spec.series, series.set) });
    }
    return {
      kind: 'scatter',
      points,
      series: series.list,
      matched: filtered.length,
    };
  }

  const xCol = byName.get(spec.x);
  const isTime = xCol?.type === 'date';
  const unit = spec.timeUnit;
  const series = topSeries(filtered, spec.series);
  const groups = new Map<XValue, Map<string, Acc>>();
  for (const r of filtered) {
    const raw = r[spec.x];
    if (raw == null) continue;
    const x: XValue = isTime ? bucket(raw as number, unit) : String(raw);
    const s = seriesKey(r, spec.series, series.set);
    let g = groups.get(x);
    if (!g) groups.set(x, (g = new Map()));
    let acc = g.get(s);
    if (!acc) g.set(s, (acc = new Acc(spec.aggregate)));
    acc.add(spec.y ? (r[spec.y] ?? null) : 1);
  }

  let points = [...groups].map(([x, g]) => {
    const values: Record<string, number> = {};
    for (const [s, acc] of g) values[s] = acc.result();
    return { x, values };
  });
  const sum = (p: (typeof points)[number]) =>
    Object.values(p.values).reduce((a, b) => a + b, 0);

  if (isTime) {
    points.sort((a, b) => (a.x as number) - (b.x as number));
    if (spec.limit) points = points.slice(-spec.limit);
  } else {
    const byX = (a: (typeof points)[number], b: (typeof points)[number]) =>
      naturalCompare(String(a.x), String(b.x));
    const sorters = {
      'x-asc': byX,
      'x-desc': (a: (typeof points)[number], b: (typeof points)[number]) =>
        byX(b, a),
      'y-desc': (a: (typeof points)[number], b: (typeof points)[number]) =>
        sum(b) - sum(a),
      'y-asc': (a: (typeof points)[number], b: (typeof points)[number]) =>
        sum(a) - sum(b),
    };
    points.sort(sorters[spec.sort]);
    const limit = spec.limit ?? (spec.type === 'donut' ? 8 : 40);
    if (points.length > limit) {
      const kept = points.slice(0, limit);
      // Fold the long tail into "Other" for part-to-whole charts so shares stay honest.
      if (spec.type === 'donut' && additive(spec.aggregate)) {
        const rest = points.slice(limit);
        const values: Record<string, number> = {};
        for (const p of rest)
          for (const [k, v] of Object.entries(p.values))
            values[k] = (values[k] ?? 0) + v;
        kept.push({ x: OTHER, values });
      }
      points = kept;
    }
  }

  const total = points.reduce((a, p) => a + sum(p), 0);
  return {
    kind: 'xy',
    xType: isTime ? 'time' : 'category',
    points,
    series: series.list,
    total,
    matched: filtered.length,
  };
}

const additive = (a: Aggregate) => a === 'sum' || a === 'count';

function topSeries(rows: Row[], field: string | null) {
  if (!field) return { list: ['value'], set: null as Set<string> | null };
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = r[field];
    const k = v == null ? '(empty)' : String(v);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const sorted = [...counts].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const top = sorted.slice(0, MAX_SERIES);
  const list = sorted.length > MAX_SERIES ? [...top, OTHER] : top;
  return { list, set: new Set(top) };
}

function seriesKey(r: Row, field: string | null, top: Set<string> | null) {
  if (!field) return 'value';
  const v = r[field];
  const k = v == null ? '(empty)' : String(v);
  return top?.has(k) ? k : OTHER;
}

const collator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
});
export const naturalCompare = (a: string, b: string) => collator.compare(a, b);
