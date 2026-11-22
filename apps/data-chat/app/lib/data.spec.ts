import { describe, expect, it } from 'vitest';
import { aggregate, bucket } from './aggregate';
import { heuristicSpec, suggestQuestions } from './heuristic';
import { buildDataset, inferType, parseDate, parseNumber } from './profile';
import { repairSpec, type ChartSpec } from './spec';

const raw = [
  {
    date: '2024-01-03',
    city: 'Bogor',
    drink: 'Latte',
    qty: '2',
    revenue: '64,000',
  },
  {
    date: '2024-01-20',
    city: 'Jakarta',
    drink: 'Latte',
    qty: '1',
    revenue: '32000',
  },
  {
    date: '2024-02-02',
    city: 'Bogor',
    drink: 'Americano',
    qty: '3',
    revenue: '75000',
  },
  {
    date: '2024-02-14',
    city: 'Bandung',
    drink: 'Latte',
    qty: '',
    revenue: '0',
  },
  {
    date: '2024-03-01',
    city: 'Jakarta',
    drink: 'Matcha',
    qty: '4',
    revenue: '140000',
  },
];
const { rows, columns } = buildDataset(Object.keys(raw[0]!), raw);
const col = (n: string) => columns.find((c) => c.name === n)!;

describe('profiling', () => {
  it('parses numbers and dates conservatively', () => {
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('12%')).toBe(12);
    expect(parseNumber('12a')).toBeNull();
    expect(parseNumber('-')).toBeNull();
    expect(parseDate('2024-1-5')).toBe(Date.UTC(2024, 0, 5));
    expect(parseDate('03/15/2024')).toBe(Date.UTC(2024, 2, 15));
    expect(parseDate('2024')).toBeNull();
  });

  it('infers column types', () => {
    expect(col('date').type).toBe('date');
    expect(col('city').type).toBe('category');
    expect(col('qty').type).toBe('number');
    expect(col('revenue').type).toBe('number');
    expect(col('qty').nulls).toBe(1);
    expect(col('revenue').max).toBe(140000);
    expect(col('city').top?.[0]).toEqual({ value: 'Bogor', count: 2 });
    expect(inferType(['a', 'b', 'c'].concat(Array(40).fill('x')))).toBe(
      'category',
    );
    expect(inferType(Array.from({ length: 100 }, (_, i) => `note ${i}`))).toBe(
      'text',
    );
  });
});

const spec = (s: Partial<ChartSpec>) => repairSpec(s, columns).spec;

describe('aggregate', () => {
  it('sums by category, sorted by value', () => {
    const d = aggregate(
      spec({ type: 'bar', x: 'city', y: 'revenue', aggregate: 'sum' }),
      rows,
      columns,
    );
    expect(d.kind).toBe('xy');
    if (d.kind !== 'xy') return;
    expect(d.points.map((p) => [p.x, p.values['value']])).toEqual([
      ['Jakarta', 172000],
      ['Bogor', 139000],
      ['Bandung', 0],
    ]);
  });

  it('buckets dates by month and splits series', () => {
    const d = aggregate(
      spec({
        type: 'line',
        x: 'date',
        timeUnit: 'month',
        aggregate: 'count',
        series: 'drink',
      }),
      rows,
      columns,
    );
    if (d.kind !== 'xy') throw new Error('expected xy');
    expect(d.xType).toBe('time');
    expect(d.points.map((p) => p.x)).toEqual([
      Date.UTC(2024, 0, 1),
      Date.UTC(2024, 1, 1),
      Date.UTC(2024, 2, 1),
    ]);
    expect(d.points[1]!.values).toEqual({ Americano: 1, Latte: 1 });
  });

  it('applies filters, averages and single values', () => {
    const d = aggregate(
      spec({
        type: 'number',
        y: 'qty',
        aggregate: 'avg',
        filters: [{ field: 'city', op: 'eq', value: 'bogor' }],
      }),
      rows,
      columns,
    );
    expect(d).toEqual({ kind: 'value', value: 2.5, matched: 2 });
    const med = aggregate(
      spec({ type: 'number', y: 'revenue', aggregate: 'median' }),
      rows,
      columns,
    );
    expect(med.kind === 'value' && med.value).toBe(64000);
  });

  it('week buckets start on Monday', () => {
    // 2024-01-03 is a Wednesday.
    expect(bucket(Date.UTC(2024, 0, 3), 'week')).toBe(Date.UTC(2024, 0, 1));
    expect(bucket(Date.UTC(2024, 4, 20), 'quarter')).toBe(Date.UTC(2024, 3, 1));
  });
});

describe('repairSpec', () => {
  it('fixes unknown columns and impossible chart types', () => {
    const { spec: s, notes } = repairSpec(
      {
        type: 'scatter',
        x: 'city',
        y: 'nope',
        filters: [{ field: 'ghost', op: 'eq', value: '1' }],
      },
      columns,
    );
    expect(s.type).toBe('scatter');
    expect([s.x, s.y]).toEqual(['qty', 'revenue']);
    expect(s.filters).toEqual([]);
    expect(notes.length).toBeGreaterThan(0);
    expect(repairSpec({ type: 'bar', x: 'Date' }, columns).spec).toMatchObject({
      x: 'date',
      timeUnit: 'day',
    });
    expect(
      repairSpec(
        { type: 'bar', x: 'city', y: 'drink', aggregate: 'sum' },
        columns,
      ).spec.aggregate,
    ).toBe('distinct');
  });
});

describe('heuristicSpec', () => {
  it('reads common question shapes', () => {
    expect(heuristicSpec('Average revenue by city', columns)).toMatchObject({
      type: 'bar',
      x: 'city',
      y: 'revenue',
      aggregate: 'avg',
    });
    expect(
      heuristicSpec('Monthly revenue trend by drink', columns),
    ).toMatchObject({
      type: 'line',
      x: 'date',
      timeUnit: 'month',
      series: 'drink',
      y: 'revenue',
    });
    expect(heuristicSpec('qty vs revenue', columns)).toMatchObject({
      type: 'scatter',
      x: 'qty',
      y: 'revenue',
    });
    expect(heuristicSpec('Share of orders by drink', columns)).toMatchObject({
      type: 'donut',
      x: 'drink',
    });
    expect(
      heuristicSpec('Top 2 cities by total revenue in Bogor', columns),
    ).toMatchObject({
      limit: 2,
      filters: [{ field: 'city', op: 'eq', value: 'Bogor' }],
    });
  });

  it('refines a previous figure', () => {
    const base = heuristicSpec('Total revenue by city', columns);
    expect(heuristicSpec('as a donut', columns, base)).toMatchObject({
      type: 'donut',
      x: 'city',
    });
  });

  it('suggests answerable questions', () => {
    const qs = suggestQuestions(columns);
    expect(qs.length).toBeGreaterThan(2);
    for (const q of qs)
      expect(heuristicSpec(q, columns).x ?? 'ok').toBeTruthy();
  });
});
