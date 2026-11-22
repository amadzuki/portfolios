import type { ColumnProfile } from './types';

export const CHART_TYPES = [
  'bar',
  'hbar',
  'line',
  'area',
  'scatter',
  'donut',
  'number',
] as const;
export const AGGREGATES = [
  'count',
  'sum',
  'avg',
  'median',
  'min',
  'max',
  'distinct',
] as const;
export const TIME_UNITS = [
  'none',
  'hour',
  'day',
  'week',
  'month',
  'quarter',
  'year',
] as const;
export const SORTS = ['x-asc', 'x-desc', 'y-desc', 'y-asc'] as const;
export const FILTER_OPS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
] as const;

export type ChartType = (typeof CHART_TYPES)[number];
export type Aggregate = (typeof AGGREGATES)[number];
export type TimeUnit = (typeof TIME_UNITS)[number];
export type SortOrder = (typeof SORTS)[number];
export type FilterOp = (typeof FILTER_OPS)[number];

export interface Filter {
  field: string;
  op: FilterOp;
  value: string;
}

/** Everything needed to draw a chart. The LLM produces one; people can edit it by hand. */
export interface ChartSpec {
  title: string;
  type: ChartType;
  /** Grouping / x-axis column. Ignored by `number`. */
  x: string | null;
  timeUnit: TimeUnit;
  /** Measured column. null means "count rows". */
  y: string | null;
  aggregate: Aggregate;
  /** Optional second grouping, drawn as colours. */
  series: string | null;
  filters: Filter[];
  sort: SortOrder;
  limit: number | null;
  /** One or two sentences on why this chart answers the question. */
  explanation: string;
}

export const CHART_LABEL: Record<ChartType, string> = {
  bar: 'Bars',
  hbar: 'Rows',
  line: 'Line',
  area: 'Area',
  scatter: 'Scatter',
  donut: 'Donut',
  number: 'Number',
};

export const AGG_LABEL: Record<Aggregate, string> = {
  count: 'Count of rows',
  sum: 'Sum',
  avg: 'Average',
  median: 'Median',
  min: 'Minimum',
  max: 'Maximum',
  distinct: 'Distinct values',
};

export const emptySpec = (): ChartSpec => ({
  title: 'Untitled figure',
  type: 'bar',
  x: null,
  timeUnit: 'none',
  y: null,
  aggregate: 'count',
  series: null,
  filters: [],
  sort: 'y-desc',
  limit: null,
  explanation: '',
});

const oneOf = <T extends string>(list: readonly T[], v: unknown, d: T): T =>
  list.includes(v as T) ? (v as T) : d;

/**
 * Makes any spec-shaped value safe to render against these columns: unknown fields are
 * dropped or replaced, and chart types that cannot work with the chosen columns are
 * swapped for one that can. Returns notes describing every repair, so the UI can be honest
 * about what the model asked for versus what is drawn.
 */
export function repairSpec(
  input: Partial<ChartSpec> | null | undefined,
  columns: ColumnProfile[],
): { spec: ChartSpec; notes: string[] } {
  const notes: string[] = [];
  const base = emptySpec();
  const raw = input ?? {};
  const byName = new Map(columns.map((c) => [c.name, c]));
  const find = (name: unknown): ColumnProfile | undefined => {
    if (typeof name !== 'string' || !name) return undefined;
    return (
      byName.get(name) ??
      columns.find((c) => c.name.toLowerCase() === name.toLowerCase().trim())
    );
  };
  const groupable = columns.filter(
    (c) => c.type === 'category' || c.type === 'date',
  );
  const numeric = columns.filter((c) => c.type === 'number');

  const spec: ChartSpec = {
    title:
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim().slice(0, 120)
        : base.title,
    type: oneOf(CHART_TYPES, raw.type, 'bar'),
    x: find(raw.x)?.name ?? null,
    timeUnit: oneOf(TIME_UNITS, raw.timeUnit, 'none'),
    y: find(raw.y)?.name ?? null,
    aggregate: oneOf(AGGREGATES, raw.aggregate, raw.y ? 'sum' : 'count'),
    series: find(raw.series)?.name ?? null,
    filters: [],
    sort: oneOf(SORTS, raw.sort, 'y-desc'),
    limit:
      typeof raw.limit === 'number' && raw.limit > 0
        ? Math.min(Math.round(raw.limit), 500)
        : null,
    explanation:
      typeof raw.explanation === 'string'
        ? raw.explanation.trim().slice(0, 400)
        : '',
  };

  if (raw.x && !spec.x) notes.push(`No column named “${String(raw.x)}”.`);
  if (raw.y && !spec.y) notes.push(`No column named “${String(raw.y)}”.`);

  for (const f of Array.isArray(raw.filters) ? raw.filters : []) {
    const col = find(f?.field);
    if (!col) {
      notes.push(`Dropped a filter on unknown column “${String(f?.field)}”.`);
      continue;
    }
    spec.filters.push({
      field: col.name,
      op: oneOf(FILTER_OPS, f.op, 'eq'),
      value: String(f.value ?? ''),
    });
  }

  const y = spec.y ? byName.get(spec.y) : undefined;
  if (
    y &&
    y.type !== 'number' &&
    !['count', 'distinct'].includes(spec.aggregate)
  ) {
    notes.push(
      `“${y.name}” isn't numeric, so counting distinct values instead.`,
    );
    spec.aggregate = 'distinct';
  }
  if (spec.aggregate === 'count') spec.y = null;
  if (!spec.y && spec.aggregate !== 'count') {
    spec.aggregate = 'count';
  }

  if (spec.type === 'scatter') {
    const x = spec.x ? byName.get(spec.x) : undefined;
    if (x?.type !== 'number' || y?.type !== 'number') {
      if (numeric.length >= 2) {
        spec.x = x?.type === 'number' ? x.name : numeric[0]!.name;
        spec.y =
          y?.type === 'number' && y.name !== spec.x
            ? y.name
            : numeric.find((c) => c.name !== spec.x)!.name;
      } else {
        notes.push('A scatter plot needs two numeric columns; showing bars.');
        spec.type = 'bar';
      }
    }
    spec.aggregate = 'sum';
  }

  if (spec.type !== 'number' && spec.type !== 'scatter') {
    const x = spec.x ? byName.get(spec.x) : undefined;
    if (!x) {
      const fallback = groupable[0] ?? columns[0];
      if (!fallback) return { spec: { ...spec, type: 'number' }, notes };
      spec.x = fallback.name;
      if (raw.x == null) notes.push(`Grouped by “${fallback.name}”.`);
    }
    const xCol = byName.get(spec.x!)!;
    if (xCol.type === 'date') {
      if (spec.timeUnit === 'none') spec.timeUnit = autoTimeUnit(xCol);
      if (spec.type === 'donut') spec.type = 'bar';
    } else {
      spec.timeUnit = 'none';
    }
    if (spec.series === spec.x) spec.series = null;
    if (spec.type === 'donut') spec.series = null;
  } else if (spec.type === 'number') {
    spec.series = null;
  }
  if (spec.series && byName.get(spec.series)?.type === 'number') {
    notes.push(`Can't split colours by numeric “${spec.series}”.`);
    spec.series = null;
  }
  return { spec, notes };
}

/** Picks a time bucket that gives roughly 12–60 points across the column's range. */
export function autoTimeUnit(col: ColumnProfile): TimeUnit {
  const span = (col.max ?? 0) - (col.min ?? 0);
  const days = span / 86_400_000;
  if (days <= 2 && col.hasTime) return 'hour';
  if (days <= 62) return 'day';
  if (days <= 366) return 'week';
  if (days <= 366 * 5) return 'month';
  if (days <= 366 * 15) return 'quarter';
  return 'year';
}
