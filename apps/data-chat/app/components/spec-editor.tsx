import { label } from '../lib/format';
import {
  AGG_LABEL,
  AGGREGATES,
  CHART_LABEL,
  CHART_TYPES,
  FILTER_OPS,
  SORTS,
  TIME_UNITS,
  type ChartSpec,
  type FilterOp,
} from '../lib/spec';
import type { ColumnProfile } from '../lib/types';

const OP_LABEL: Record<FilterOp, string> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  contains: 'contains',
};
const SORT_LABEL = {
  'y-desc': 'Largest first',
  'y-asc': 'Smallest first',
  'x-asc': 'A → Z',
  'x-desc': 'Z → A',
};

/** Hand-editing for a spec. Every control maps to one field; the chart redraws instantly. */
export function SpecEditor({
  spec,
  columns,
  onChange,
}: {
  spec: ChartSpec;
  columns: ColumnProfile[];
  onChange: (s: ChartSpec) => void;
}) {
  const set = <K extends keyof ChartSpec>(k: K, v: ChartSpec[K]) =>
    onChange({ ...spec, [k]: v });
  const xCol = columns.find((c) => c.name === spec.x);
  const numeric = columns.filter((c) => c.type === 'number');
  const groupable = columns.filter(
    (c) => c.type !== 'text' || c.distinct <= 60,
  );
  const categories = columns.filter((c) => c.type === 'category');

  return (
    <div className="grid gap-4 text-sm">
      <fieldset>
        <legend className="field-label">Chart</legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup">
          {CHART_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={spec.type === t}
              onClick={() => set('type', t)}
              className="chip data-[on=true]:border-[var(--ink)] data-[on=true]:bg-[var(--ink)] data-[on=true]:text-[var(--paper)]"
              data-on={spec.type === t}
            >
              {CHART_LABEL[t]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {spec.type !== 'number' && (
          <Select
            label={spec.type === 'scatter' ? 'X axis' : 'Group by'}
            value={spec.x ?? ''}
            onChange={(v) => set('x', v || null)}
            options={(spec.type === 'scatter' ? numeric : groupable).map(
              (c) => [c.name, label(c.name)],
            )}
          />
        )}
        {xCol?.type === 'date' && spec.type !== 'scatter' && (
          <Select
            label="Time unit"
            value={spec.timeUnit}
            onChange={(v) => set('timeUnit', v as ChartSpec['timeUnit'])}
            options={TIME_UNITS.filter((u) => u !== 'none').map((u) => [u, u])}
          />
        )}
        {spec.type !== 'scatter' && (
          <Select
            label="Measure"
            value={spec.aggregate}
            onChange={(v) => {
              const agg = v as ChartSpec['aggregate'];
              onChange({
                ...spec,
                aggregate: agg,
                y:
                  agg === 'count' ? null : (spec.y ?? numeric[0]?.name ?? null),
              });
            }}
            options={AGGREGATES.map((a) => [a, AGG_LABEL[a]])}
          />
        )}
        {(spec.type === 'scatter' || spec.aggregate !== 'count') && (
          <Select
            label={spec.type === 'scatter' ? 'Y axis' : 'Of column'}
            value={spec.y ?? ''}
            onChange={(v) => set('y', v || null)}
            options={(spec.aggregate === 'distinct' ? columns : numeric).map(
              (c) => [c.name, label(c.name)],
            )}
          />
        )}
        {spec.type !== 'number' && spec.type !== 'donut' && (
          <Select
            label="Colour by"
            value={spec.series ?? ''}
            onChange={(v) => set('series', v || null)}
            options={[
              ['', 'Nothing'],
              ...categories
                .filter((c) => c.name !== spec.x)
                .map((c) => [c.name, label(c.name)] as [string, string]),
            ]}
          />
        )}
        {spec.type !== 'number' &&
          spec.type !== 'scatter' &&
          xCol?.type !== 'date' && (
            <Select
              label="Sort"
              value={spec.sort}
              onChange={(v) => set('sort', v as ChartSpec['sort'])}
              options={SORTS.map((s) => [s, SORT_LABEL[s]])}
            />
          )}
        {spec.type !== 'number' && spec.type !== 'scatter' && (
          <label className="grid gap-1">
            <span className="field-label">
              {xCol?.type === 'date' ? 'Last N' : 'Keep top'}
            </span>
            <input
              type="number"
              min={1}
              max={500}
              inputMode="numeric"
              placeholder="All"
              className="input"
              value={spec.limit ?? ''}
              onChange={(e) =>
                set(
                  'limit',
                  e.target.value ? Math.max(1, Number(e.target.value)) : null,
                )
              }
            />
          </label>
        )}
      </div>

      <fieldset>
        <legend className="field-label">Filters</legend>
        <div className="grid gap-2">
          {spec.filters.map((f, i) => {
            const col = columns.find((c) => c.name === f.field);
            const update = (patch: Partial<typeof f>) =>
              set(
                'filters',
                spec.filters.map((g, j) => (j === i ? { ...g, ...patch } : g)),
              );
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  className="input w-auto"
                  aria-label="Filter column"
                  value={f.field}
                  onChange={(e) => update({ field: e.target.value })}
                >
                  {columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {label(c.name)}
                    </option>
                  ))}
                </select>
                <select
                  className="input w-auto"
                  aria-label="Operator"
                  value={f.op}
                  onChange={(e) => update({ op: e.target.value as FilterOp })}
                >
                  {FILTER_OPS.map((o) => (
                    <option key={o} value={o}>
                      {OP_LABEL[o]}
                    </option>
                  ))}
                </select>
                {col?.type === 'category' && f.op === 'eq' && col.top ? (
                  <input
                    className="input min-w-0 flex-1"
                    aria-label="Value"
                    list={`vals-${col.name}`}
                    value={f.value}
                    onChange={(e) => update({ value: e.target.value })}
                  />
                ) : (
                  <input
                    className="input min-w-0 flex-1"
                    aria-label="Value"
                    type={
                      col?.type === 'date'
                        ? 'date'
                        : col?.type === 'number'
                          ? 'number'
                          : 'text'
                    }
                    value={f.value}
                    onChange={(e) => update({ value: e.target.value })}
                  />
                )}
                {col?.top && (
                  <datalist id={`vals-${col.name}`}>
                    {col.top.map((t) => (
                      <option key={t.value} value={t.value} />
                    ))}
                  </datalist>
                )}
                <button
                  type="button"
                  className="chip"
                  aria-label="Remove filter"
                  onClick={() =>
                    set(
                      'filters',
                      spec.filters.filter((_, j) => j !== i),
                    )
                  }
                >
                  ✕
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="chip w-max"
            onClick={() =>
              set('filters', [
                ...spec.filters,
                {
                  field: categories[0]?.name ?? columns[0]!.name,
                  op: 'eq',
                  value: categories[0]?.top?.[0]?.value ?? '',
                },
              ])
            }
          >
            + Add filter
          </button>
        </div>
      </fieldset>

      <label className="grid gap-1">
        <span className="field-label">Title</span>
        <input
          className="input"
          value={spec.title}
          onChange={(e) => set('title', e.target.value)}
        />
      </label>
    </div>
  );
}

function Select({
  label: text,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="field-label">{text}</span>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
