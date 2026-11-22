import { useEffect, useMemo, useRef, useState } from 'react';
import { data, Link, useFetcher, useFetchers } from 'react-router';
import { Chart } from '../components/chart';
import { Footer, LocalBadge, Masthead } from '../components/chrome';
import { SpecEditor } from '../components/spec-editor';
import { aggregate, type ChartData } from '../lib/aggregate';
import { formatNumber, formatTime, label } from '../lib/format';
import { suggestQuestions } from '../lib/heuristic';
import { buildPayload } from '../lib/payload';
import { getSample } from '../lib/samples';
import { repairSpec, type ChartSpec } from '../lib/spec';
import type { Figure } from '../lib/store';
import type { ColumnProfile, Dataset } from '../lib/types';
import type { Route } from './+types/dataset';

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `${loaderData?.dataset.name ?? 'Dataset'} · Ask your data` },
  ];
}

// ─── Server: the only code that sees anything about the data, and only its schema ───────
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const raw = form.get('payload');
  const { ask } = await import('../lib/ask.server');
  let payload: unknown = null;
  try {
    payload = typeof raw === 'string' ? JSON.parse(raw) : null;
  } catch {
    /* handled by validation */
  }
  return ask(request, payload);
}

// ─── Browser: load rows from IndexedDB (or fetch + parse a sample on first visit) ───────
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const store = await import('../lib/store');
  let dataset = await store.loadDataset(params.id);
  if (!dataset) {
    const sample = getSample(params.id);
    if (!sample)
      throw data(
        'This dataset isn’t in this browser. Uploaded files live only where you uploaded them.',
        { status: 404 },
      );
    const res = await fetch(sample.file);
    if (!res.ok) throw data('Could not download the sample.', { status: 502 });
    const { parseCsv } = await import('../lib/parse');
    dataset = await parseCsv(await res.blob(), {
      id: sample.id,
      name: sample.name,
      source: 'sample',
      description: sample.blurb,
    });
    await store.saveDataset(dataset);
  }
  const figures = await store.loadFigures(params.id);
  return { dataset, figures };
}
clientLoader.hydrate = true as const;

/**
 * Asking goes to the server action for a spec, then the result is saved locally. Edits and
 * deletes never leave the browser.
 */
export async function clientAction({
  request,
  params,
  serverAction,
}: Route.ClientActionArgs) {
  const form = await request.clone().formData();
  const intent = form.get('intent');
  const store = await import('../lib/store');
  const figures = await store.loadFigures(params.id);

  if (intent === 'ask') {
    const result = await serverAction();
    if (!result.ok) return result;
    const fig: Figure = {
      id: store.newId(),
      question: result.question,
      spec: result.spec,
      notes: result.notes,
      source: result.source,
      createdAt: Date.now(),
    };
    await store.saveFigures(params.id, [fig, ...figures]);
    return { ...result, figureId: fig.id };
  }
  if (intent === 'update') {
    const id = String(form.get('id'));
    const spec = JSON.parse(String(form.get('spec'))) as ChartSpec;
    await store.saveFigures(
      params.id,
      figures.map((f) =>
        f.id === id ? { ...f, spec, source: 'edited' as const, notes: [] } : f,
      ),
    );
    return { ok: true as const };
  }
  if (intent === 'delete') {
    const id = String(form.get('id'));
    await store.saveFigures(
      params.id,
      figures.filter((f) => f.id !== id),
    );
    return { ok: true as const };
  }
  if (intent === 'clear') {
    await store.saveFigures(params.id, []);
    return { ok: true as const };
  }
  throw data('Unknown intent', { status: 400 });
}

export function HydrateFallback() {
  return (
    <>
      <Masthead />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6" aria-busy>
        <div className="skeleton h-9 w-72" />
        <div className="mt-2 skeleton h-4 w-48" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="skeleton hidden h-96 lg:block" />
          <div className="grid gap-4">
            <div className="skeleton h-36" />
            <div className="skeleton h-80" />
          </div>
        </div>
        <p className="kicker mt-6">Parsing in a background thread…</p>
      </main>
    </>
  );
}

export default function DatasetPage({ loaderData }: Route.ComponentProps) {
  const { dataset, figures } = loaderData;
  const [refine, setRefine] = useState<Figure | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  return (
    <>
      <Masthead>
        <nav className="hidden items-center gap-2 font-mono text-xs text-[var(--muted-ink)] md:flex">
          <Link to="/" className="hover:text-[var(--ink)]">
            Datasets
          </Link>
          <span>/</span>
          <span className="truncate text-[var(--ink)]">{dataset.name}</span>
        </nav>
      </Masthead>
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="flex flex-wrap items-end gap-x-6 gap-y-3 py-7">
          <div className="min-w-0 flex-1">
            <p className="kicker">
              {dataset.source === 'sample' ? 'Sample dataset' : 'Your upload'}
            </p>
            <h1 className="font-display mt-1 text-4xl leading-[1.05] tracking-tight [overflow-wrap:anywhere] sm:text-5xl">
              {dataset.name}
            </h1>
            <p className="mt-2 font-mono text-xs text-[var(--muted-ink)]">
              {dataset.rowCount.toLocaleString('en')} rows ·{' '}
              {dataset.columns.length} columns
              {dataset.truncated && ' · truncated to the first 250k rows'}
            </p>
          </div>
          <LocalBadge />
        </header>

        <div className="grid gap-6 border-t border-[var(--ink)] pt-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Columns columns={dataset.columns} />
          <div className="grid min-w-0 content-start gap-6">
            <Composer
              dataset={dataset}
              inputRef={composer}
              refine={refine}
              clearRefine={() => setRefine(null)}
              onAsked={(id) => {
                setRefine(null);
                setFocus(id);
              }}
            />
            <Figures
              dataset={dataset}
              figures={figures}
              focus={focus}
              onFollowUp={(f) => {
                setRefine(f);
                composer.current?.focus();
                composer.current?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                });
              }}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

// ─── Column list with tiny distribution sketches ──────────────────────────────────────────
const TYPE_GLYPH: Record<ColumnProfile['type'], string> = {
  number: '#',
  date: '◷',
  category: '◆',
  text: '¶',
};

function Columns({ columns }: { columns: ColumnProfile[] }) {
  // Open on wide screens; a collapsed summary on phones so the composer stays near the top.
  const [open] = useState(
    () =>
      typeof window === 'undefined' ||
      window.matchMedia('(min-width: 1024px)').matches,
  );
  return (
    <aside aria-label="Columns" className="lg:sticky lg:top-4 lg:self-start">
      <details className="group" open={open}>
        <summary className="kicker flex cursor-pointer list-none items-center justify-between">
          {columns.length} columns
          <span className="transition-transform group-open:rotate-180">▾</span>
        </summary>
        <ul className="mt-3 grid gap-px overflow-hidden rounded-xl border border-[var(--rule)] bg-[var(--rule)] sm:grid-cols-2 lg:grid-cols-1">
          {columns.map((c) => (
            <li key={c.name} className="bg-[var(--card)] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-4 text-center font-mono text-xs text-[var(--accent)]"
                  title={c.type}
                >
                  {TYPE_GLYPH[c.type]}
                </span>
                <span
                  className="min-w-0 flex-1 truncate text-sm font-medium"
                  title={c.name}
                >
                  {c.name}
                </span>
                <span className="font-mono text-[10px] text-[var(--muted-ink)]">
                  {c.type}
                </span>
              </div>
              <ColumnSketch col={c} />
            </li>
          ))}
        </ul>
      </details>
    </aside>
  );
}

function ColumnSketch({ col }: { col: ColumnProfile }) {
  if (col.histogram) {
    const max = Math.max(...col.histogram) || 1;
    const fmt = (v?: number) =>
      v == null
        ? ''
        : col.type === 'date'
          ? formatTime(v, 'month', true)
          : formatNumber(v);
    return (
      <div className="mt-1.5 pl-6">
        <svg
          viewBox="0 0 160 20"
          className="h-5 w-full"
          preserveAspectRatio="none"
          aria-hidden
        >
          {col.histogram.map((v, i) => (
            <rect
              key={i}
              x={i * 10 + 0.5}
              y={20 - (v / max) * 20}
              width={9}
              height={(v / max) * 20}
              fill="var(--ink)"
              opacity={0.75}
            />
          ))}
        </svg>
        <div className="flex justify-between font-mono text-[10px] text-[var(--muted-ink)]">
          <span>{fmt(col.min)}</span>
          <span>{fmt(col.max)}</span>
        </div>
      </div>
    );
  }
  if (col.top?.length) {
    const max = col.top[0]!.count || 1;
    return (
      <ul className="mt-1.5 grid gap-0.5 pl-6">
        {col.top.slice(0, 3).map((t) => (
          <li key={t.value} className="relative flex items-center text-[11px]">
            <span
              className="absolute inset-y-0 left-0 rounded-sm bg-[var(--paper-2)]"
              style={{ width: `${(t.count / max) * 100}%` }}
            />
            <span className="relative truncate px-1">{t.value}</span>
            <span className="relative ml-auto pl-2 font-mono text-[10px] text-[var(--muted-ink)]">
              {formatNumber(t.count)}
            </span>
          </li>
        ))}
        {col.distinct > 3 && (
          <li className="pl-1 font-mono text-[10px] text-[var(--muted-ink)]">
            +{formatNumber(col.distinct - 3)} more
          </li>
        )}
      </ul>
    );
  }
  return null;
}

// ─── Composer ─────────────────────────────────────────────────────────────────────────────
function Composer({
  dataset,
  inputRef,
  refine,
  clearRefine,
  onAsked,
}: {
  dataset: Dataset;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  refine: Figure | null;
  clearRefine: () => void;
  onAsked: (figureId: string) => void;
}) {
  const fetcher = useFetcher<typeof clientAction>({ key: 'ask' });
  const [question, setQuestion] = useState('');
  const [includeSample, setIncludeSample] = useState(true);
  const busy = fetcher.state !== 'idle';
  const suggestions = useMemo(() => {
    const sample = getSample(dataset.id);
    return sample?.questions ?? suggestQuestions(dataset.columns);
  }, [dataset]);
  const payload = useMemo(
    () =>
      buildPayload(dataset, dataset.rows, {
        question: question || '…',
        includeSample,
        base: refine?.spec,
      }),
    [dataset, question, includeSample, refine],
  );

  const result = fetcher.data;
  useEffect(() => {
    if (
      fetcher.state === 'idle' &&
      result &&
      'figureId' in result &&
      result.figureId
    ) {
      setQuestion('');
      onAsked(result.figureId);
    }
  }, [fetcher.state, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = (q: string) => {
    if (!q.trim() || busy) return;
    fetcher.submit(
      {
        intent: 'ask',
        payload: JSON.stringify(
          buildPayload(dataset, dataset.rows, {
            question: q,
            includeSample,
            base: refine?.spec,
          }),
        ),
      },
      { method: 'post' },
    );
  };

  return (
    <section className="card p-4 sm:p-5" aria-label="Ask a question">
      {refine && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-[var(--paper-2)] px-3 py-2 text-sm">
          <span className="kicker">Refining</span>
          <span className="min-w-0 flex-1 truncate italic">
            {refine.spec.title}
          </span>
          <button
            type="button"
            className="text-xs underline"
            onClick={clearRefine}
          >
            Cancel
          </button>
        </div>
      )}
      <fetcher.Form
        method="post"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex items-end gap-3"
      >
        <input type="hidden" name="intent" value="ask" />
        <input type="hidden" name="payload" value={JSON.stringify(payload)} />
        <label className="min-w-0 flex-1">
          <span className="sr-only">Question</span>
          <textarea
            ref={inputRef}
            name="question"
            rows={1}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(question);
              }
            }}
            placeholder={
              refine
                ? 'e.g. “as a line chart”, “only delivery”, “top 3”'
                : `Ask about ${dataset.name}…`
            }
            className="font-display field-sizing-content max-h-40 w-full resize-none bg-transparent text-xl leading-snug outline-none placeholder:text-[var(--muted-ink)]/60 sm:text-2xl"
          />
        </label>
        <button
          type="submit"
          className="btn inline-flex shrink-0"
          disabled={busy || question.trim().length < 3}
        >
          {busy ? 'Thinking…' : refine ? 'Refine' : 'Ask'}
        </button>
      </fetcher.Form>

      {!refine && (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              disabled={busy}
              onClick={() => ask(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {result && !result.ok && 'error' in result && (
        <p role="alert" className="mt-3 text-sm text-[var(--accent)]">
          {result.error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--rule)] pt-3 text-xs text-[var(--muted-ink)]">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={includeSample}
            onChange={(e) => setIncludeSample(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Share 5 sample rows and category names with the model
        </label>
        <details className="group w-full sm:w-auto">
          <summary className="cursor-pointer list-none underline decoration-dotted underline-offset-4 hover:text-[var(--ink)]">
            What gets sent?
          </summary>
          <pre
            className="mt-2 max-h-72 overflow-auto rounded-lg bg-[var(--ink)] p-3 font-mono text-[11px] leading-relaxed text-[var(--paper)]"
            data-testid="payload"
          >
            {JSON.stringify(payload, null, 2)}
          </pre>
          <p className="mt-1">
            That’s all of it:{' '}
            {JSON.stringify(payload).length.toLocaleString('en')} bytes, versus{' '}
            {dataset.rowCount.toLocaleString('en')} rows that stay here.
          </p>
        </details>
      </div>
    </section>
  );
}

// ─── Figures ──────────────────────────────────────────────────────────────────────────────
function Figures({
  dataset,
  figures,
  focus,
  onFollowUp,
}: {
  dataset: Dataset;
  figures: Figure[];
  focus: string | null;
  onFollowUp: (f: Figure) => void;
}) {
  const pending = useFetchers().find(
    (f) =>
      f.key === 'ask' &&
      f.state !== 'idle' &&
      f.formData?.get('intent') === 'ask',
  );
  const pendingQuestion = useMemo(() => {
    const p = pending?.formData?.get('payload');
    try {
      return typeof p === 'string'
        ? (JSON.parse(p) as { question: string }).question
        : null;
    } catch {
      return null;
    }
  }, [pending]);
  const clear = useFetcher();

  if (!figures.length && !pending)
    return (
      <div className="rounded-2xl border border-dashed border-[var(--rule)] px-6 py-14 text-center">
        <p className="font-display text-2xl">No figures yet.</p>
        <p className="mt-2 text-sm text-[var(--muted-ink)]">
          Ask a question above, or tap one of the suggestions.
        </p>
      </div>
    );

  return (
    <section aria-label="Figures" className="grid gap-6">
      {pending && (
        <article
          className="card rise p-5"
          aria-busy
          data-testid="pending-figure"
        >
          <p className="kicker">Fig. {figures.length + 1} · drawing</p>
          <p className="mt-2 italic text-[var(--muted-ink)]">
            “{pendingQuestion}”
          </p>
          <div className="mt-4 flex h-64 items-end gap-2">
            {[40, 65, 50, 80, 60, 90, 72].map((h, i) => (
              <div
                key={i}
                className="skeleton flex-1"
                style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>
        </article>
      )}
      {figures.map((f, i) => (
        <FigureCard
          key={f.id}
          n={figures.length - i}
          figure={f}
          dataset={dataset}
          focus={focus === f.id}
          onFollowUp={() => onFollowUp(f)}
        />
      ))}
      {figures.length > 1 && (
        <clear.Form method="post" className="text-center">
          <input type="hidden" name="intent" value="clear" />
          <button
            type="submit"
            className="text-xs text-[var(--muted-ink)] underline hover:text-[var(--ink)]"
          >
            Clear all figures
          </button>
        </clear.Form>
      )}
    </section>
  );
}

const SOURCE_LABEL = {
  model: 'model',
  offline: 'offline parser',
  edited: 'edited by hand',
} as const;

function FigureCard({
  n,
  figure,
  dataset,
  focus,
  onFollowUp,
}: {
  n: number;
  figure: Figure;
  dataset: Dataset;
  focus: boolean;
  onFollowUp: () => void;
}) {
  const fetcher = useFetcher();
  const ref = useRef<HTMLElement>(null);
  const [panel, setPanel] = useState<'edit' | 'table' | null>(null);
  // Edits apply instantly to the local draft and are saved after a short pause.
  const [draft, setDraft] = useState(figure.spec);
  useEffect(() => setDraft(figure.spec), [figure.spec]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const edit = (s: ChartSpec) => {
    const { spec } = repairSpec(s, dataset.columns);
    setDraft(spec);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetcher.submit(
        { intent: 'update', id: figure.id, spec: JSON.stringify(spec) },
        { method: 'post' },
      );
    }, 400);
  };

  const { result, ms } = useMemo(() => {
    const t = performance.now();
    const result = aggregate(draft, dataset.rows, dataset.columns);
    return { result, ms: performance.now() - t };
  }, [draft, dataset]);

  useEffect(() => {
    if (focus)
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focus]);

  const deleting = fetcher.formData?.get('intent') === 'delete';
  if (deleting) return null;

  return (
    <article
      ref={ref}
      className="card rise min-w-0 p-4 sm:p-6"
      data-testid="figure"
      aria-label={draft.title}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="kicker">Fig. {n}</span>
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
            figure.source === 'model'
              ? 'bg-[var(--c4)]/10 text-[var(--c4)]'
              : figure.source === 'offline'
                ? 'bg-[var(--c3)]/15 text-[#8a6410]'
                : 'bg-[var(--paper-2)] text-[var(--muted-ink)]'
          }`}
          data-testid="figure-source"
        >
          {SOURCE_LABEL[figure.source]}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm italic text-[var(--muted-ink)]">
          “{figure.question}”
        </span>
      </header>
      <h2 className="font-display mt-2 text-2xl leading-tight tracking-tight sm:text-[1.7rem]">
        {draft.title}
      </h2>
      <p className="mb-4 mt-1 font-mono text-[11px] text-[var(--muted-ink)]">
        {describe(draft)} · {result.matched.toLocaleString('en')} rows ·{' '}
        {ms < 1 ? '<1' : Math.round(ms)} ms in your browser
      </p>

      <Chart spec={draft} data={result} />

      {(figure.spec.explanation || figure.notes.length > 0) && (
        <div className="mt-4 border-l-2 border-[var(--accent)] pl-3 text-sm">
          {figure.spec.explanation && (
            <p className="italic">{figure.spec.explanation}</p>
          )}
          {figure.notes.map((note) => (
            <p key={note} className="mt-1 text-xs text-[var(--muted-ink)]">
              {note}
            </p>
          ))}
        </div>
      )}

      <footer className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="chip"
          aria-expanded={panel === 'edit'}
          onClick={() => setPanel(panel === 'edit' ? null : 'edit')}
        >
          ✎ Edit spec
        </button>
        <button type="button" className="chip" onClick={onFollowUp}>
          ↳ Follow up
        </button>
        <button
          type="button"
          className="chip"
          aria-expanded={panel === 'table'}
          onClick={() => setPanel(panel === 'table' ? null : 'table')}
        >
          ▦ Table
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => downloadSvg(ref.current, draft.title)}
        >
          ↓ SVG
        </button>
        <span className="flex-1" />
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={figure.id} />
          <button type="submit" className="chip text-[var(--muted-ink)]">
            Delete
          </button>
        </fetcher.Form>
      </footer>

      {panel === 'edit' && (
        <div
          className="mt-4 rounded-xl border border-[var(--rule)] bg-[var(--paper)] p-4"
          data-testid="spec-editor"
        >
          <SpecEditor spec={draft} columns={dataset.columns} onChange={edit} />
          <details className="mt-4">
            <summary className="kicker cursor-pointer">Spec JSON</summary>
            <pre className="mt-2 overflow-auto rounded-lg bg-[var(--ink)] p-3 font-mono text-[11px] text-[var(--paper)]">
              {JSON.stringify(draft, null, 2)}
            </pre>
          </details>
        </div>
      )}
      {panel === 'table' && <DataTable spec={draft} data={result} />}
    </article>
  );
}

function describe(s: ChartSpec) {
  if (s.type === 'scatter')
    return `${label(s.y ?? '')} against ${label(s.x ?? '')}`;
  const m =
    s.aggregate === 'count' ? 'rows' : `${s.aggregate} ${label(s.y ?? '')}`;
  if (s.type === 'number' || !s.x) return m;
  const by = s.timeUnit !== 'none' ? `${s.timeUnit}` : label(s.x);
  return `${m} by ${by}${s.series ? ` and ${label(s.series)}` : ''}`;
}

function DataTable({ spec, data: d }: { spec: ChartSpec; data: ChartData }) {
  if (d.kind === 'value') return null;
  if (d.kind === 'scatter')
    return (
      <p className="mt-4 text-sm text-[var(--muted-ink)]">
        {d.points.length.toLocaleString('en')} points plotted (sampled to 4,000
        at most).
      </p>
    );
  return (
    <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-[var(--rule)]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-[var(--paper-2)] text-left font-mono text-[11px] uppercase tracking-wider text-[var(--muted-ink)]">
          <tr>
            <th className="px-3 py-2">{label(spec.x ?? '')}</th>
            {d.series.map((s) => (
              <th key={s} className="px-3 py-2 text-right">
                {s === 'value'
                  ? spec.aggregate === 'count'
                    ? 'rows'
                    : `${spec.aggregate} ${label(spec.y ?? '')}`
                  : s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.points.map((p) => (
            <tr key={String(p.x)} className="border-t border-[var(--rule)]">
              <td className="px-3 py-1.5">
                {d.xType === 'time'
                  ? formatTime(p.x as number, spec.timeUnit)
                  : String(p.x)}
              </td>
              {d.series.map((s) => (
                <td
                  key={s}
                  className="px-3 py-1.5 text-right font-mono tabular-nums"
                >
                  {p.values[s] == null
                    ? '–'
                    : formatNumber(p.values[s]!, { compact: false })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Serialises the figure's SVG with CSS variables resolved, so it opens anywhere. */
function downloadSvg(root: HTMLElement | null, title: string) {
  const svg = root?.querySelector('.chart svg');
  if (!svg) return;
  const css = getComputedStyle(document.documentElement);
  const src = new XMLSerializer()
    .serializeToString(svg)
    .replace(
      /var\((--[\w-]+)\)/g,
      (_, v: string) => css.getPropertyValue(v).trim() || '#000',
    );
  const blob = new Blob(
    [
      src.includes('xmlns=')
        ? src
        : src.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'),
    ],
    {
      type: 'image/svg+xml',
    },
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/[^\w]+/g, '-').toLowerCase() || 'figure'}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
