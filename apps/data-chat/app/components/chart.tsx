import { AxisBottom, AxisLeft } from '@visx/axis';
import { curveMonotoneX } from '@visx/curve';
import { GridRows } from '@visx/grid';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { scaleBand, scaleLinear, scaleTime } from '@visx/scale';
import { AreaClosed, Arc, LinePath, Pie } from '@visx/shape';
import { useId, useMemo, useState, type ReactNode } from 'react';
import type { ChartData, XValue } from '../lib/aggregate';
import { formatNumber, formatTime, label } from '../lib/format';
import { AGG_LABEL, type ChartSpec } from '../lib/spec';

export const PALETTE = [
  'var(--c1)',
  'var(--c2)',
  'var(--c3)',
  'var(--c4)',
  'var(--c5)',
  'var(--c6)',
  'var(--c7)',
];
const colorFor = (series: string[], s: string) =>
  s === 'Other'
    ? 'var(--muted-ink)'
    : PALETTE[series.indexOf(s) % PALETTE.length]!;

interface ChartProps {
  spec: ChartSpec;
  data: ChartData;
}

/** Renders any spec/data pair. Sizes to its container; draws in with CSS on mount. */
export function Chart({ spec, data }: ChartProps) {
  if (data.kind === 'value')
    return <BigNumber spec={spec} value={data.value} matched={data.matched} />;
  const empty =
    data.kind === 'scatter' ? !data.points.length : !data.points.length;
  if (empty)
    return (
      <div className="grid h-56 place-items-center text-sm text-[var(--muted-ink)]">
        No rows match these filters.
      </div>
    );
  const height =
    spec.type === 'hbar' && data.kind === 'xy'
      ? Math.max(160, data.points.length * 30 + 40)
      : spec.type === 'donut'
        ? 300
        : 320;
  return (
    <div>
      {data.series.length > 1 && <Legend series={data.series} />}
      <div className="chart relative" style={{ height }} data-chart={spec.type}>
        <ParentSize debounceTime={30}>
          {({ width }) =>
            width < 10 ? null : data.kind === 'scatter' ? (
              <Scatter spec={spec} data={data} width={width} height={height} />
            ) : spec.type === 'line' || spec.type === 'area' ? (
              <Lines spec={spec} data={data} width={width} height={height} />
            ) : spec.type === 'hbar' ? (
              <HBars spec={spec} data={data} width={width} height={height} />
            ) : spec.type === 'donut' ? (
              <Donut spec={spec} data={data} width={width} height={height} />
            ) : (
              <Bars spec={spec} data={data} width={width} height={height} />
            )
          }
        </ParentSize>
      </div>
    </div>
  );
}

type XY = Extract<ChartData, { kind: 'xy' }>;
type Sized<T> = { spec: ChartSpec; data: T; width: number; height: number };

const tick = {
  fill: 'var(--muted-ink)',
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
};
const fmtX = (spec: ChartSpec, data: XY, x: XValue, short = true) =>
  data.xType === 'time'
    ? formatTime(x as number, spec.timeUnit, short)
    : String(x);

function measureLabel(spec: ChartSpec) {
  if (spec.aggregate === 'count') return 'rows';
  return `${AGG_LABEL[spec.aggregate].toLowerCase()} of ${label(spec.y ?? '')}`;
}

function Tooltip({
  x,
  y,
  width,
  children,
}: {
  x: number;
  y: number;
  width: number;
  children: ReactNode;
}) {
  const left = Math.min(Math.max(x + 14, 0), width - 200);
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 w-max max-w-[220px] rounded-md border border-[var(--rule)] bg-[var(--paper)]/95 px-3 py-2 text-xs shadow-[0_8px_30px_-12px_rgba(40,30,20,0.35)] backdrop-blur"
      style={{
        left: x + 220 > width ? x - 210 : left,
        top: Math.max(0, y - 10),
      }}
    >
      {children}
    </div>
  );
}

function Values({
  data,
  values,
}: {
  data: { series: string[] };
  values: Record<string, number>;
}) {
  const entries = data.series.filter((s) => values[s] != null);
  return (
    <ul className="mt-1 space-y-0.5 font-mono">
      {entries.map((s) => (
        <li key={s} className="flex items-center gap-2">
          {s !== 'value' && (
            <span
              className="size-2 rounded-full"
              style={{ background: colorFor(data.series, s) }}
            />
          )}
          {s !== 'value' && (
            <span className="truncate text-[var(--muted-ink)]">{s}</span>
          )}
          <span className="ml-auto tabular-nums">
            {formatNumber(values[s]!, { compact: false })}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── Vertical bars (stacked when there is a series) ───────────────────────────────────────
function Bars({ spec, data, width, height }: Sized<XY>) {
  const m = { top: 24, right: 8, bottom: 44, left: 52 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.points.map((p) =>
    data.series.reduce((a, s) => a + (p.values[s] ?? 0), 0),
  );
  const x = scaleBand({
    domain: data.points.map((_, i) => i),
    range: [0, w],
    padding: 0.28,
  });
  const y = scaleLinear({
    domain: [Math.min(0, ...totals), Math.max(0, ...totals) || 1],
    range: [h, 0],
    nice: true,
  });
  const every = Math.ceil(data.points.length / Math.max(1, Math.floor(w / 64)));
  const showValues = data.points.length <= 14 && data.series.length === 1;
  return (
    <>
      <svg width={width} height={height} role="img" aria-label={spec.title}>
        <Group left={m.left} top={m.top}>
          <GridRows
            scale={y}
            width={w}
            numTicks={4}
            stroke="var(--rule)"
            strokeDasharray="2 4"
          />
          {data.points.map((p, i) => {
            let acc = 0;
            const bx = x(i) ?? 0;
            return (
              <g
                key={String(p.x)}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                opacity={hover == null || hover === i ? 1 : 0.45}
                style={{ transition: 'opacity .2s' }}
              >
                <rect
                  x={bx - 4}
                  y={0}
                  width={x.bandwidth() + 8}
                  height={h}
                  fill="transparent"
                />
                {data.series.map((s) => {
                  const v = p.values[s] ?? 0;
                  const y0 = y(acc);
                  acc += v;
                  const y1 = y(acc);
                  return (
                    <rect
                      key={s}
                      className="bar"
                      style={{ animationDelay: `${i * 18}ms` }}
                      x={bx}
                      y={Math.min(y0, y1)}
                      width={x.bandwidth()}
                      height={Math.abs(y0 - y1)}
                      fill={colorFor(data.series, s)}
                      rx={Math.min(3, x.bandwidth() / 4)}
                    />
                  );
                })}
                {showValues && (
                  <text
                    x={bx + x.bandwidth() / 2}
                    y={y(totals[i]!) - 6}
                    textAnchor="middle"
                    {...tick}
                    fill="var(--ink)"
                    fontSize={10}
                  >
                    {formatNumber(totals[i]!)}
                  </text>
                )}
              </g>
            );
          })}
          <AxisLeft
            scale={y}
            numTicks={4}
            hideAxisLine
            hideTicks
            tickFormat={(v) => formatNumber(Number(v))}
            tickLabelProps={() => ({
              ...tick,
              textAnchor: 'end',
              dx: -4,
              dy: 3,
            })}
          />
          <AxisBottom
            top={h}
            scale={x}
            stroke="var(--ink)"
            hideTicks
            tickValues={x.domain().filter((i) => i % every === 0)}
            tickFormat={(i) =>
              truncate(fmtX(spec, data, data.points[i as number]!.x), 14)
            }
            tickLabelProps={() => ({ ...tick, textAnchor: 'middle', dy: 6 })}
          />
        </Group>
      </svg>
      {hover != null && data.points[hover] && (
        <Tooltip
          x={m.left + (x(hover) ?? 0) + x.bandwidth()}
          y={m.top + y(totals[hover]!)}
          width={width}
        >
          <div className="font-medium">
            {fmtX(spec, data, data.points[hover]!.x, false)}
          </div>
          <Values data={data} values={data.points[hover]!.values} />
        </Tooltip>
      )}
    </>
  );
}

// ─── Horizontal ranking ───────────────────────────────────────────────────────────────────
function HBars({ spec, data, width, height }: Sized<XY>) {
  const labelW = Math.min(180, Math.max(80, width * 0.3));
  const m = { top: 8, right: 56, bottom: 28, left: labelW };
  const w = Math.max(10, width - m.left - m.right);
  const h = height - m.top - m.bottom;
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.points.map((p) =>
    data.series.reduce((a, s) => a + (p.values[s] ?? 0), 0),
  );
  const y = scaleBand({
    domain: data.points.map((_, i) => i),
    range: [0, h],
    padding: 0.3,
  });
  const x = scaleLinear({
    domain: [0, Math.max(...totals) || 1],
    range: [0, w],
    nice: true,
  });
  return (
    <>
      <svg width={width} height={height} role="img" aria-label={spec.title}>
        <Group left={m.left} top={m.top}>
          {data.points.map((p, i) => {
            let acc = 0;
            const by = y(i) ?? 0;
            return (
              <g
                key={String(p.x)}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                opacity={hover == null || hover === i ? 1 : 0.45}
                style={{ transition: 'opacity .2s' }}
              >
                <rect
                  x={-labelW}
                  y={by - 3}
                  width={width}
                  height={y.bandwidth() + 6}
                  fill="transparent"
                />
                <text
                  x={-10}
                  y={by + y.bandwidth() / 2 + 4}
                  textAnchor="end"
                  fontSize={12}
                  fill="var(--ink)"
                >
                  {truncate(fmtX(spec, data, p.x), Math.floor(labelW / 7))}
                </text>
                <line
                  x1={0}
                  x2={w}
                  y1={by + y.bandwidth() / 2}
                  y2={by + y.bandwidth() / 2}
                  stroke="var(--rule)"
                  strokeDasharray="1 4"
                />
                {data.series.map((s) => {
                  const v = p.values[s] ?? 0;
                  const x0 = x(acc);
                  acc += v;
                  return (
                    <rect
                      key={s}
                      className="hbar"
                      style={{ animationDelay: `${i * 22}ms` }}
                      x={x0}
                      y={by}
                      width={Math.max(0, x(acc) - x0)}
                      height={y.bandwidth()}
                      rx={2}
                      fill={colorFor(data.series, s)}
                    />
                  );
                })}
                <text
                  x={x(totals[i]!) + 6}
                  y={by + y.bandwidth() / 2 + 4}
                  {...tick}
                  fill="var(--ink)"
                >
                  {formatNumber(totals[i]!)}
                </text>
              </g>
            );
          })}
          <AxisBottom
            top={h}
            scale={x}
            numTicks={Math.max(2, Math.floor(w / 90))}
            stroke="var(--ink)"
            hideTicks
            tickFormat={(v) => formatNumber(Number(v))}
            tickLabelProps={() => ({ ...tick, textAnchor: 'middle', dy: 4 })}
          />
        </Group>
      </svg>
      {hover != null && data.series.length > 1 && (
        <Tooltip
          x={m.left + x(totals[hover]!)}
          y={m.top + (y(hover) ?? 0)}
          width={width}
        >
          <div className="font-medium">
            {fmtX(spec, data, data.points[hover]!.x, false)}
          </div>
          <Values data={data} values={data.points[hover]!.values} />
        </Tooltip>
      )}
    </>
  );
}

// ─── Lines and areas over time (or ordered categories) ────────────────────────────────────
function Lines({ spec, data, width, height }: Sized<XY>) {
  const gid = useId().replace(/:/g, '');
  const m = { top: 24, right: 16, bottom: 40, left: 52 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const [hover, setHover] = useState<number | null>(null);
  const isTime = data.xType === 'time';
  const pos = useMemo(() => {
    if (isTime) {
      const xs = data.points.map((p) => p.x as number);
      const s = scaleTime({
        domain: [new Date(Math.min(...xs)), new Date(Math.max(...xs))],
        range: [0, w],
      });
      return {
        scale: s,
        at: (i: number) => s(new Date(data.points[i]!.x as number)),
      };
    }
    const s = scaleLinear({
      domain: [0, Math.max(1, data.points.length - 1)],
      range: [0, w],
    });
    return { scale: s, at: (i: number) => s(i) };
  }, [data, isTime, w]);
  const values = data.points.flatMap((p) =>
    data.series.map((s) => p.values[s] ?? 0),
  );
  const y = scaleLinear({
    domain: [Math.min(0, ...values), Math.max(...values) || 1],
    range: [h, 0],
    nice: true,
  });
  const idx = data.points.map((_, i) => i);
  const single = data.series.length === 1;
  const asArea = spec.type === 'area';

  // Annotate the peak of a single series, the way a print graphic would.
  let peak = -1;
  if (single) {
    const s = data.series[0]!;
    peak = idx.reduce(
      (best, i) =>
        (data.points[i]!.values[s] ?? 0) > (data.points[best]!.values[s] ?? 0)
          ? i
          : best,
      0,
    );
  }

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    let dist = Infinity;
    for (const i of idx) {
      const d = Math.abs(pos.at(i) - px);
      if (d < dist) [best, dist] = [i, d];
    }
    setHover(best);
  };

  return (
    <>
      <svg width={width} height={height} role="img" aria-label={spec.title}>
        <defs>
          {data.series.map((s, i) => (
            <linearGradient
              key={s}
              id={`${gid}-${i}`}
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={colorFor(data.series, s)}
                stopOpacity={single ? 0.32 : 0.14}
              />
              <stop
                offset="100%"
                stopColor={colorFor(data.series, s)}
                stopOpacity={0}
              />
            </linearGradient>
          ))}
        </defs>
        <Group left={m.left} top={m.top}>
          <GridRows
            scale={y}
            width={w}
            numTicks={4}
            stroke="var(--rule)"
            strokeDasharray="2 4"
          />
          {data.series.map((s, si) => {
            const get = (i: number) => y(data.points[i]!.values[s] ?? 0);
            return (
              <g key={s}>
                {(asArea || single) && (
                  <AreaClosed
                    className="area"
                    data={idx}
                    x={pos.at}
                    y={get}
                    yScale={y}
                    curve={curveMonotoneX}
                    fill={`url(#${gid}-${si})`}
                  />
                )}
                <LinePath
                  className="line"
                  data={idx}
                  x={pos.at}
                  y={get}
                  curve={curveMonotoneX}
                  stroke={colorFor(data.series, s)}
                  strokeWidth={single ? 2.25 : 1.75}
                  strokeLinecap="round"
                  pathLength={1}
                  style={{ animationDelay: `${si * 120}ms` }}
                />
              </g>
            );
          })}
          {peak >= 0 && data.points.length > 2 && (
            <g
              className="annotation"
              transform={`translate(${pos.at(peak)},${y(data.points[peak]!.values[data.series[0]!] ?? 0)})`}
            >
              <circle
                r={4}
                fill="var(--paper)"
                stroke="var(--ink)"
                strokeWidth={1.5}
              />
              <text
                y={-10}
                textAnchor={
                  pos.at(peak) > w * 0.8
                    ? 'end'
                    : pos.at(peak) < w * 0.2
                      ? 'start'
                      : 'middle'
                }
                {...tick}
                fill="var(--ink)"
              >
                Peak{' '}
                {formatNumber(data.points[peak]!.values[data.series[0]!] ?? 0)}{' '}
                · {fmtX(spec, data, data.points[peak]!.x)}
              </text>
            </g>
          )}
          {hover != null && (
            <g pointerEvents="none">
              <line
                x1={pos.at(hover)}
                x2={pos.at(hover)}
                y1={0}
                y2={h}
                stroke="var(--ink)"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              {data.series.map((s) => (
                <circle
                  key={s}
                  cx={pos.at(hover)}
                  cy={y(data.points[hover]!.values[s] ?? 0)}
                  r={3.5}
                  fill={colorFor(data.series, s)}
                  stroke="var(--paper)"
                  strokeWidth={1.5}
                />
              ))}
            </g>
          )}
          <AxisLeft
            scale={y}
            numTicks={4}
            hideAxisLine
            hideTicks
            tickFormat={(v) => formatNumber(Number(v))}
            tickLabelProps={() => ({
              ...tick,
              textAnchor: 'end',
              dx: -4,
              dy: 3,
            })}
          />
          <AxisBottom
            top={h}
            scale={pos.scale as never}
            numTicks={Math.max(2, Math.floor(w / 90))}
            stroke="var(--ink)"
            hideTicks
            tickFormat={(v) =>
              isTime
                ? formatTime(
                    (v as Date).valueOf(),
                    spec.timeUnit === 'hour' ? 'day' : spec.timeUnit,
                    true,
                  )
                : truncate(
                    String(data.points[Math.round(Number(v))]?.x ?? ''),
                    12,
                  )
            }
            tickLabelProps={() => ({ ...tick, textAnchor: 'middle', dy: 6 })}
          />
          <rect
            width={w}
            height={h}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
            style={{ touchAction: 'pan-y' }}
          />
        </Group>
      </svg>
      {hover != null && (
        <Tooltip x={m.left + pos.at(hover)} y={m.top + 8} width={width}>
          <div className="font-medium">
            {fmtX(spec, data, data.points[hover]!.x, false)}
          </div>
          <Values data={data} values={data.points[hover]!.values} />
        </Tooltip>
      )}
    </>
  );
}

// ─── Scatter with a least-squares trend line ──────────────────────────────────────────────
function Scatter({
  spec,
  data,
  width,
  height,
}: Sized<Extract<ChartData, { kind: 'scatter' }>>) {
  const m = { top: 20, right: 16, bottom: 44, left: 56 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const xs = data.points.map((p) => p.x);
  const ys = data.points.map((p) => p.y);
  const x = scaleLinear({
    domain: [Math.min(...xs), Math.max(...xs)],
    range: [0, w],
    nice: true,
  });
  const y = scaleLinear({
    domain: [Math.min(...ys), Math.max(...ys)],
    range: [h, 0],
    nice: true,
  });
  const fit = useMemo(() => regression(xs, ys), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const [x0, x1] = x.domain() as [number, number];
  const r =
    data.points.length > 1500 ? 1.6 : data.points.length > 400 ? 2.4 : 3.4;
  return (
    <svg width={width} height={height} role="img" aria-label={spec.title}>
      <Group left={m.left} top={m.top}>
        <GridRows
          scale={y}
          width={w}
          numTicks={4}
          stroke="var(--rule)"
          strokeDasharray="2 4"
        />
        <g className="dots">
          {data.points.map((p, i) => (
            <circle
              key={i}
              cx={x(p.x)}
              cy={y(p.y)}
              r={r}
              fill={colorFor(
                data.series,
                p.series === 'value' ? data.series[0]! : p.series,
              )}
              fillOpacity={0.55}
            />
          ))}
        </g>
        {fit && (
          <g className="annotation">
            <line
              x1={x(x0)}
              x2={x(x1)}
              y1={y(fit.a + fit.b * x0)}
              y2={y(fit.a + fit.b * x1)}
              stroke="var(--ink)"
              strokeWidth={1.25}
              strokeDasharray="5 4"
            />
            <text x={w} y={-6} textAnchor="end" {...tick} fill="var(--ink)">
              trend · r = {fit.r.toFixed(2)}
            </text>
          </g>
        )}
        <AxisLeft
          scale={y}
          numTicks={4}
          hideAxisLine
          hideTicks
          label={label(spec.y ?? '')}
          labelProps={{ ...tick, textAnchor: 'middle' }}
          tickFormat={(v) => formatNumber(Number(v))}
          tickLabelProps={() => ({ ...tick, textAnchor: 'end', dx: -4, dy: 3 })}
        />
        <AxisBottom
          top={h}
          scale={x}
          numTicks={Math.max(2, Math.floor(w / 90))}
          stroke="var(--ink)"
          hideTicks
          label={label(spec.x ?? '')}
          labelProps={{ ...tick, textAnchor: 'middle', dy: 8 }}
          tickFormat={(v) => formatNumber(Number(v))}
          tickLabelProps={() => ({ ...tick, textAnchor: 'middle', dy: 4 })}
        />
      </Group>
    </svg>
  );
}

function regression(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 3) return null;
  let sx = 0,
    sy = 0,
    sxx = 0,
    syy = 0,
    sxy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i]!,
      b = ys[i]!;
    sx += a;
    sy += b;
    sxx += a * a;
    syy += b * b;
    sxy += a * b;
  }
  const den = n * sxx - sx * sx;
  if (!den) return null;
  const b = (n * sxy - sx * sy) / den;
  const r = (n * sxy - sx * sy) / Math.sqrt(den * (n * syy - sy * sy) || 1);
  return { a: (sy - b * sx) / n, b, r };
}

// ─── Donut with a centred total ───────────────────────────────────────────────────────────
function Donut({ spec, data, width, height }: Sized<XY>) {
  const [hover, setHover] = useState<number | null>(null);
  const slices = data.points.map((p) => ({
    x: p.x,
    v: Object.values(p.values).reduce((a, b) => a + b, 0),
  }));
  const total = slices.reduce((a, s) => a + s.v, 0) || 1;
  const narrow = width < 520;
  const radius = Math.min(height, narrow ? width : width * 0.5) / 2 - 12;
  const names = slices.map((s) => String(s.x));
  const cx = narrow ? width / 2 : radius + 24;
  const focus = hover != null ? slices[hover]! : null;
  return (
    <div className={narrow ? '' : 'flex h-full items-center'}>
      <svg
        width={narrow ? width : radius * 2 + 48}
        height={narrow ? radius * 2 + 24 : height}
        role="img"
        aria-label={spec.title}
      >
        <Group top={(narrow ? radius * 2 + 24 : height) / 2} left={cx}>
          <Pie
            data={slices}
            pieValue={(s) => Math.max(0, s.v)}
            outerRadius={radius}
            innerRadius={radius * 0.62}
            padAngle={0.012}
            cornerRadius={3}
            pieSortValues={() => 0}
          >
            {(pie) =>
              pie.arcs.map((arc, i) => (
                <g
                  key={String(arc.data.x)}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                >
                  <Arc
                    className="slice"
                    style={{ animationDelay: `${i * 50}ms` }}
                    startAngle={arc.startAngle}
                    endAngle={arc.endAngle}
                    padAngle={arc.padAngle}
                    outerRadius={hover === i ? radius + 6 : radius}
                    innerRadius={radius * 0.62}
                    cornerRadius={3}
                    fill={colorFor(names, String(arc.data.x))}
                    opacity={hover == null || hover === i ? 1 : 0.5}
                  />
                </g>
              ))
            }
          </Pie>
          <text
            textAnchor="middle"
            dy={-4}
            className="font-display"
            fontSize={Math.max(18, radius / 3.6)}
            fill="var(--ink)"
          >
            {focus
              ? `${Math.round((focus.v / total) * 100)}%`
              : formatNumber(total)}
          </text>
          <text textAnchor="middle" dy={16} {...tick}>
            {truncate(focus ? String(focus.x) : measureLabel(spec), 22)}
          </text>
        </Group>
      </svg>
      <ul
        className={`grid gap-1.5 text-sm ${narrow ? 'mt-2 grid-cols-2' : 'ml-6 flex-1'}`}
      >
        {slices.map((s, i) => (
          <li
            key={String(s.x)}
            className="flex items-center gap-2"
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            style={{ opacity: hover == null || hover === i ? 1 : 0.5 }}
          >
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: colorFor(names, String(s.x)) }}
            />
            <span className="truncate">{String(s.x)}</span>
            <span className="ml-auto font-mono text-xs tabular-nums text-[var(--muted-ink)]">
              {Math.round((s.v / total) * 1000) / 10}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BigNumber({
  spec,
  value,
  matched,
}: {
  spec: ChartSpec;
  value: number;
  matched: number;
}) {
  return (
    <div
      className="flex h-44 flex-col items-start justify-center"
      data-chart="number"
    >
      <div className="font-display text-6xl leading-none tracking-tight text-[var(--ink)] sm:text-7xl">
        {formatNumber(value, { compact: Math.abs(value) >= 1e7 })}
      </div>
      <div className="mt-3 font-mono text-xs text-[var(--muted-ink)]">
        {measureLabel(spec)} · across {matched.toLocaleString('en')} rows
      </div>
    </div>
  );
}

function Legend({ series }: { series: string[] }) {
  return (
    <ul
      className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs"
      aria-label="Legend"
    >
      {series.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: colorFor(series, s) }}
          />
          {s}
        </li>
      ))}
    </ul>
  );
}

const truncate = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;
