import {
  repairSpec,
  type Aggregate,
  type ChartSpec,
  type TimeUnit,
} from './spec';
import type { ColumnProfile } from './types';

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[_\-./]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

const stem = (w: string) =>
  w.replace(/(ies|es|s)$/, (m) => (m === 'ies' ? 'y' : ''));

/** Where in the question each column is mentioned (-1 when it isn't). */
function mentions(question: string, columns: ColumnProfile[]) {
  const q = words(question).map(stem);
  const text = ` ${q.join(' ')} `;
  return columns.map((c) => {
    const parts = words(c.name)
      .map(stem)
      .filter((p) => !['idr', 'usd', 'pct', 'c', 'mm', 'at', 'id'].includes(p));
    if (!parts.length) return { col: c, at: -1 };
    const full = text.indexOf(` ${parts.join(' ')} `);
    if (full >= 0) return { col: c, at: full };
    // Fall back to the most distinctive word of the column name.
    const key = [...parts].sort((a, b) => b.length - a.length)[0]!;
    const at = key.length >= 3 ? text.indexOf(` ${key} `) : -1;
    return { col: c, at };
  });
}

const AGG_WORDS: [RegExp, Aggregate][] = [
  [/\b(average|avg|mean|typical)\b/, 'avg'],
  [/\bmedian\b/, 'median'],
  [/\b(how many|count|number of|frequency)\b/, 'count'],
  [/\b(total|sum|overall)\b/, 'sum'],
  [/\b(max|maximum|highest|peak|biggest|largest)\b/, 'max'],
  [/\b(min|minimum|lowest|smallest)\b/, 'min'],
  [/\b(unique|distinct)\b/, 'distinct'],
];
const TIME_WORDS: [RegExp, TimeUnit][] = [
  [/\b(hourly|per hour|by hour)\b/, 'hour'],
  [/\b(daily|per day|by day|each day)\b/, 'day'],
  [/\b(weekly|per week|by week|each week)\b/, 'week'],
  [/\b(monthly|per month|by month|each month)\b/, 'month'],
  [/\b(quarterly|per quarter|by quarter)\b/, 'quarter'],
  [/\b(yearly|annual|per year|by year|each year)\b/, 'year'],
];

/**
 * A rule-based stand-in for the model, used when no API key is configured (and as a safety
 * net when a call fails). It handles the common shapes of question surprisingly well:
 * "average X by Y", "X over time", "top 5 Y by X", "share of X", "X vs Y".
 */
export function heuristicSpec(
  question: string,
  columns: ColumnProfile[],
  base?: ChartSpec | null,
): ChartSpec {
  const q = question.toLowerCase();
  const found = mentions(question, columns)
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((m) => m.col);
  const numeric = found.filter((c) => c.type === 'number');
  const group = found.filter((c) => c.type === 'category' || c.type === 'date');
  const dateCol = columns.find((c) => c.type === 'date');

  // Follow-ups like "as a line chart" or "only Jakarta" tweak the previous figure.
  if (base) {
    const next: ChartSpec = { ...base, filters: [...base.filters] };
    const t = chartTypeWord(q);
    if (t) next.type = t;
    for (const [re, unit] of TIME_WORDS) if (re.test(q)) next.timeUnit = unit;
    for (const [re, agg] of AGG_WORDS) if (re.test(q)) next.aggregate = agg;
    if (numeric[0] && !/\bby\b/.test(q)) next.y = numeric[0].name;
    const by = afterBy(question, columns);
    if (by && by.name !== next.x) next.series = by.name;
    next.filters.push(...valueFilters(q, columns));
    const n = topN(q);
    if (n) {
      next.limit = n;
      next.sort = 'y-desc';
    }
    return repairSpec(next, columns).spec;
  }

  let aggregate: Aggregate | null = null;
  for (const [re, agg] of AGG_WORDS)
    if (re.test(q)) {
      aggregate = agg;
      break;
    }
  let timeUnit: TimeUnit = 'none';
  for (const [re, unit] of TIME_WORDS) if (re.test(q)) timeUnit = unit;
  const overTime =
    timeUnit !== 'none' ||
    /\b(over time|trend|timeline|history|across time|season|growth)\b/.test(q);

  const by = afterBy(question, columns);
  let x = by ?? group[0] ?? null;
  let series: string | null = null;
  if (overTime && dateCol) {
    if (x && x.type !== 'date') series = x.name;
    x = dateCol;
  } else if (by && group.length > 1) {
    series = group.find((g) => g.name !== by.name)?.name ?? null;
  }

  let type = chartTypeWord(q);
  const y = numeric.find((c) => c.name !== x?.name) ?? null;
  if (!type) {
    if (
      numeric.length >= 2 &&
      /\b(vs|versus|against|correlat|relationship|relate)/.test(q)
    )
      type = 'scatter';
    else if (/\b(share|proportion|breakdown|split|percentage|mix)\b/.test(q))
      type = 'donut';
    else if (!x) type = 'number';
    else if (x.type === 'date') type = series ? 'line' : 'area';
    else type = x.distinct > 8 ? 'hbar' : 'bar';
  }

  if (!aggregate) aggregate = y ? 'sum' : 'count';
  const n = topN(q);
  const scatterX = type === 'scatter' ? numeric[0]?.name : undefined;
  const scatterY = type === 'scatter' ? numeric[1]?.name : undefined;
  const spec: Partial<ChartSpec> = {
    title: titleFor(question),
    type,
    x: scatterX ?? x?.name ?? null,
    timeUnit,
    y: scatterY ?? y?.name ?? null,
    aggregate,
    series,
    filters: valueFilters(q, columns),
    sort: /\b(lowest|least|bottom|worst)\b/.test(q) ? 'y-asc' : 'y-desc',
    limit: n,
    explanation: '',
  };
  return repairSpec(spec, columns).spec;
}

function chartTypeWord(q: string): ChartSpec['type'] | null {
  if (/\b(pie|donut|doughnut)\b/.test(q)) return 'donut';
  if (/\bscatter\b/.test(q)) return 'scatter';
  if (/\barea\b/.test(q)) return 'area';
  if (/\bline\b/.test(q)) return 'line';
  if (/\b(horizontal|rows?|ranking)\b/.test(q)) return 'hbar';
  if (/\b(bar|bars|column chart)\b/.test(q)) return 'bar';
  if (/\b(kpi|single number|just the number)\b/.test(q)) return 'number';
  return null;
}

function topN(q: string): number | null {
  const m = /\b(top|bottom|first|best|worst)\s+(\d{1,3})\b/.exec(q);
  return m ? Number(m[2]) : null;
}

/** The column named right after "by"/"per"/"for each". */
function afterBy(question: string, columns: ColumnProfile[]) {
  const m = /\b(?:by|per|for each|across|grouped by|split by)\s+(.+)$/i.exec(
    question,
  );
  if (!m) return null;
  const hit = mentions(m[1]!, columns)
    .filter(
      (x) => x.at >= 0 && (x.col.type === 'category' || x.col.type === 'date'),
    )
    .sort((a, b) => a.at - b.at)[0];
  return hit?.col ?? null;
}

/** "in Jakarta", "only delivery": matches words in the question against known categories. */
function valueFilters(q: string, columns: ColumnProfile[]) {
  const filters: ChartSpec['filters'] = [];
  const text = ` ${words(q).join(' ')} `;
  for (const c of columns) {
    if (c.type !== 'category' || !c.top) continue;
    if (c.distinct > 60) continue;
    for (const { value } of c.top) {
      const v = words(value).join(' ');
      if (
        v.length >= 3 &&
        text.includes(` ${v} `) &&
        !isColumnWord(v, columns)
      ) {
        filters.push({ field: c.name, op: 'eq', value });
        break;
      }
    }
  }
  return filters;
}

const isColumnWord = (v: string, columns: ColumnProfile[]) =>
  columns.some((c) => words(c.name).join(' ') === v);

function titleFor(q: string) {
  const t = q.trim().replace(/[?.!]+$/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** A few questions that are guaranteed to produce a sensible chart for this dataset. */
export function suggestQuestions(columns: ColumnProfile[]): string[] {
  const nums = columns.filter((c) => c.type === 'number');
  const cats = columns
    .filter((c) => c.type === 'category' && c.distinct > 1 && c.distinct <= 40)
    .sort((a, b) => a.distinct - b.distinct);
  const date = columns.find((c) => c.type === 'date');
  const label = (c: ColumnProfile) => c.name.replace(/_/g, ' ');
  const out: string[] = [];
  const main =
    nums.find((n) => !/(^|_)(id|hour|year)$/.test(n.name)) ?? nums[0];
  const wide = cats.at(-1);
  const narrow = cats[0];
  if (main && wide) out.push(`Total ${label(main)} by ${label(wide)}`);
  if (main && date)
    out.push(
      narrow
        ? `Monthly ${label(main)} over time by ${label(narrow)}`
        : `Average ${label(main)} by month`,
    );
  if (narrow) out.push(`Share of rows by ${label(narrow)}`);
  if (nums.length >= 2) out.push(`${label(nums[0]!)} vs ${label(nums[1]!)}`);
  if (main && cats[1])
    out.push(`Top 5 ${label(cats[1])} by average ${label(main)}`);
  return out.slice(0, 4);
}
