import { useEffect, useRef, useState } from 'react';
import { Form, Link, redirect, useNavigation, useSubmit } from 'react-router';
import { Footer, LocalBadge, Masthead } from '../components/chrome';
import { SAMPLES } from '../lib/samples';
import type { DatasetMeta } from '../lib/types';
import type { Route } from './+types/home';

const MAX_BYTES = 40 * 1024 * 1024;

/** Static, so the page can be prerendered at build time. */
export function loader() {
  return { samples: SAMPLES };
}

/**
 * Without JavaScript the upload form posts here. Parsing is deliberately browser-only, so
 * the server never reads the file; it just explains why.
 */
export async function action() {
  return {
    error:
      'Files are parsed in your browser so they never touch a server. Please enable JavaScript to upload.',
  };
}

let progressListener: ((p: number) => void) | null = null;

/** With JavaScript, the same form is handled entirely client-side: parse, store, redirect. */
export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0)
    return { error: 'Choose a CSV file first.' };
  if (file.size > MAX_BYTES)
    return { error: 'That file is over 40 MB. Try a smaller extract.' };
  if (!/\.(csv|tsv|txt)$/i.test(file.name) && !file.type.includes('csv'))
    return { error: 'That doesn’t look like a CSV file.' };
  const [{ parseCsv }, { saveDataset, newId }] = await Promise.all([
    import('../lib/parse'),
    import('../lib/store'),
  ]);
  try {
    const id = newId();
    const dataset = await parseCsv(
      file,
      {
        id,
        name: file.name.replace(/\.(csv|tsv|txt)$/i, ''),
        source: 'upload',
      },
      (p) => progressListener?.(p),
    );
    await saveDataset(dataset);
    return redirect(`/d/${id}`);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not read that file.',
    };
  }
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <>
      <Masthead />
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <Hero />
        <section className="grid gap-6 pb-10 lg:grid-cols-[1.1fr_1fr]">
          <Upload error={actionData?.error} />
          <HowItWorks />
        </section>

        <section
          aria-labelledby="samples"
          className="border-t border-[var(--ink)] pt-6"
        >
          <div className="flex items-baseline justify-between">
            <h2 id="samples" className="font-display text-2xl">
              Or start with a sample
            </h2>
            <span className="kicker hidden sm:block">
              Synthetic data · no upload needed
            </span>
          </div>
          <ul className="mt-5 grid gap-4 md:grid-cols-3">
            {loaderData.samples.map((s, i) => (
              <li
                key={s.id}
                className="rise"
                style={{ animationDelay: `${120 + i * 80}ms` }}
              >
                <Link
                  to={`/d/${s.id}`}
                  className="card group flex h-full flex-col p-5 transition-transform hover:-translate-y-0.5"
                  prefetch="intent"
                >
                  <Sketch seed={i} />
                  <div className="kicker mt-4">{s.rows}</div>
                  <h3 className="font-display mt-1 text-xl group-hover:text-[var(--accent)]">
                    {s.name}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--muted-ink)]">
                    {s.blurb}
                  </p>
                  <p className="mt-4 text-sm italic">“{s.questions[0]}”</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <Recent />
      </main>
      <Footer />
    </>
  );
}

function Hero() {
  return (
    <section className="grid items-end gap-8 py-10 sm:py-16 md:grid-cols-[1.5fr_1fr]">
      <div className="rise">
        <p className="kicker">Chat with your data</p>
        <h1 className="font-display mt-3 text-[clamp(2.4rem,7vw,4.8rem)] leading-[0.95] tracking-[-0.02em]">
          Ask a spreadsheet a question.{' '}
          <em className="text-[var(--accent)]">Get a chart back.</em>
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[var(--muted-ink)]">
          Drop in a CSV and ask in plain words. A language model reads only the
          column names and picks the chart; the numbers are crunched right here,
          in your browser.
        </p>
        <div className="mt-5">
          <LocalBadge />
        </div>
      </div>
      <HeroFigure />
    </section>
  );
}

/** A small animated "front page" figure. */
function HeroFigure() {
  const bars = [38, 52, 44, 70, 61, 84, 76, 98];
  return (
    <figure
      className="card rise hidden p-5 md:block"
      style={{ animationDelay: '150ms' }}
      aria-hidden
    >
      <div className="kicker">Fig. 1</div>
      <div className="font-display mt-1 text-lg leading-tight">
        Monthly revenue by city
      </div>
      <svg viewBox="0 0 240 120" className="chart mt-3 w-full">
        {[30, 60, 90].map((y) => (
          <line
            key={y}
            x1="0"
            x2="240"
            y1={y}
            y2={y}
            stroke="var(--rule)"
            strokeDasharray="2 4"
          />
        ))}
        {bars.map((h, i) => (
          <rect
            key={i}
            className="bar"
            style={{ animationDelay: `${300 + i * 70}ms` }}
            x={8 + i * 29}
            y={118 - h}
            width={18}
            height={h}
            rx={2}
            fill={i === 7 ? 'var(--accent)' : 'var(--ink)'}
          />
        ))}
        <line x1="0" x2="240" y1="118" y2="118" stroke="var(--ink)" />
      </svg>
      <figcaption className="mt-3 text-sm italic text-[var(--muted-ink)]">
        “Which month was our best?” → bars, grouped by month, peak highlighted.
      </figcaption>
    </figure>
  );
}

function Upload({ error }: { error?: string }) {
  const nav = useNavigation();
  const submit = useSubmit();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const busy = nav.formData?.has('file') ?? false;

  useEffect(() => {
    progressListener = setProgress;
    return () => {
      progressListener = null;
    };
  }, []);
  useEffect(() => {
    if (!busy) setProgress(0);
  }, [busy]);

  const take = (files: FileList | null) => {
    if (!files?.length || !inputRef.current || !formRef.current) return;
    if (inputRef.current.files !== files) {
      const dt = new DataTransfer();
      dt.items.add(files[0]!);
      inputRef.current.files = dt.files;
    }
    submit(formRef.current);
  };

  return (
    <Form
      ref={formRef}
      method="post"
      encType="multipart/form-data"
      className={`card relative flex min-h-64 flex-col items-center justify-center overflow-hidden border-2 border-dashed p-8 text-center transition-colors ${
        drag
          ? 'border-[var(--accent)] bg-[var(--accent)]/5'
          : 'border-[var(--rule)]'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        take(e.dataTransfer.files);
      }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        aria-hidden
      >
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M8 13h8M8 17h5" />
      </svg>
      <p className="font-display mt-3 text-xl">
        {busy ? 'Reading your file…' : 'Drop a CSV here'}
      </p>
      <p className="mt-1 text-sm text-[var(--muted-ink)]">
        Up to 40 MB. Parsed in a background thread, saved only in this browser.
      </p>
      <label className="btn mt-5 inline-flex cursor-pointer">
        Choose file
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept=".csv,.tsv,.txt,text/csv"
          className="sr-only"
          data-testid="file-input"
          onChange={(e) => take(e.target.files)}
        />
      </label>
      <noscript>
        <button type="submit" className="chip mt-3">
          Upload
        </button>
      </noscript>
      {error && (
        <p role="alert" className="mt-4 text-sm text-[var(--accent)]">
          {error}
        </p>
      )}
      {busy && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-[var(--paper-2)]">
          <div
            className="h-full bg-[var(--accent)] transition-[width]"
            style={{ width: `${Math.max(6, progress * 100)}%` }}
          />
        </div>
      )}
    </Form>
  );
}

function HowItWorks() {
  const steps = [
    [
      'Your CSV',
      'Parsed by Papa Parse inside a Web Worker. Types and stats are inferred per column.',
      'browser',
    ],
    [
      'Column names + stats',
      'Sent with your question. Optionally five sample rows, and you can see exactly what goes.',
      'server',
    ],
    [
      'A chart spec',
      'The model answers with a small typed spec: chart type, grouping, measure, filters.',
      'server',
    ],
    [
      'Your chart',
      'Aggregated over every row locally and drawn with visx. Tweak the spec by hand any time.',
      'browser',
    ],
  ] as const;
  return (
    <ol className="grid content-start gap-0">
      {steps.map(([t, d, where], i) => (
        <li
          key={t}
          className="rise grid grid-cols-[2.5rem_1fr] gap-3 border-b border-[var(--rule)] py-4 last:border-0"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <span className="font-display text-3xl leading-none text-[var(--accent)]">
            {i + 1}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{t}</span>
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                  where === 'browser'
                    ? 'bg-[var(--c2)]/10 text-[var(--c2)]'
                    : 'bg-[var(--c3)]/15 text-[#8a6410]'
                }`}
              >
                {where}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--muted-ink)]">{d}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Uploaded datasets, read from IndexedDB after hydration. */
function Recent() {
  const [items, setItems] = useState<DatasetMeta[] | null>(null);
  useEffect(() => {
    let live = true;
    import('../lib/store')
      .then((s) => s.listDatasets())
      .then((all) => live && setItems(all.filter((d) => d.source === 'upload')))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, []);
  if (!items?.length) return null;
  return (
    <section
      className="mt-12 border-t border-[var(--ink)] pt-6"
      aria-labelledby="recent"
    >
      <h2 id="recent" className="font-display text-2xl">
        Your datasets
      </h2>
      <p className="mt-1 text-sm text-[var(--muted-ink)]">
        Stored in this browser only.
      </p>
      <ul className="mt-4 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
        {items.map((d) => (
          <li key={d.id} className="flex items-center gap-4 py-3">
            <Link
              to={`/d/${d.id}`}
              className="min-w-0 flex-1 truncate font-medium hover:text-[var(--accent)]"
            >
              {d.name}
            </Link>
            <span className="hidden font-mono text-xs text-[var(--muted-ink)] sm:block">
              {d.rowCount.toLocaleString('en')} rows · {d.columns.length} cols
            </span>
            <button
              type="button"
              className="chip"
              onClick={async () => {
                const s = await import('../lib/store');
                await s.deleteDataset(d.id);
                setItems((xs) => xs?.filter((x) => x.id !== d.id) ?? null);
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A deterministic little chart doodle for each sample card. */
function Sketch({ seed }: { seed: number }) {
  const pts = Array.from({ length: 24 }, (_, i) => {
    const v =
      Math.sin(i * (0.5 + seed * 0.21) + seed) * 0.5 +
      Math.sin(i * 0.17 + seed * 2) * 0.35 +
      0.5;
    return [i * (200 / 23), Math.min(56, Math.max(4, 54 - v * 40))] as const;
  });
  const d = pts
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join('');
  const color = ['var(--c1)', 'var(--c2)', 'var(--c4)'][seed % 3];
  return (
    <svg viewBox="0 0 200 60" className="chart h-14 w-full" aria-hidden>
      {seed === 0 ? (
        pts.map(([x, y], i) => (
          <rect
            key={i}
            className="bar"
            style={{ animationDelay: `${i * 20}ms` }}
            x={x - 3}
            y={y}
            width={6}
            height={60 - y}
            rx={1}
            fill={i % 6 === 5 ? color : 'var(--ink)'}
          />
        ))
      ) : seed === 1 ? (
        <>
          <path d={`${d}L200,60L0,60Z`} fill={color} opacity={0.15} />
          <path
            d={d}
            className="line"
            pathLength={1}
            fill="none"
            stroke={color}
            strokeWidth={2}
          />
        </>
      ) : (
        pts.map(([x, y], i) => (
          <circle
            key={i}
            className="dots"
            cx={x}
            cy={y}
            r={2.6}
            fill={i % 3 ? 'var(--ink)' : color}
            opacity={0.7}
          />
        ))
      )}
    </svg>
  );
}
