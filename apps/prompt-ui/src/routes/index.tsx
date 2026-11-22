import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Preview, type Viewport } from '../components/preview';
import { extractCode } from '../lib/extract';
import { examples } from '../lib/examples';
import { decodeShare, encodeShare } from '../lib/share';

export const Route = createFileRoute('/')({
  validateSearch: z.object({ example: z.string().optional() }),
  component: Playground,
});

interface Version {
  prompt: string;
  code: string;
}

const CodeEditor = lazy(() =>
  import('../components/editor').then((m) => ({ default: m.CodeEditor })),
);

type Status =
  { kind: 'idle' } | { kind: 'streaming' } | { kind: 'error'; message: string };

function Playground() {
  const { example } = Route.useSearch();
  const navigate = useNavigate({ from: '/' });
  const initial = examples.find((e) => e.id === example) ?? examples[0];

  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState(initial.code);
  const [versions, setVersions] = useState<Version[]>([
    { prompt: initial.prompt, code: initial.code },
  ]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [toast, setToast] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'preview' | 'code'>('preview');
  const abort = useRef<AbortController | null>(null);
  const streaming = status.kind === 'streaming';

  const load = useCallback((v: Version) => {
    setVersions([v]);
    setActive(0);
    setCode(v.code);
    setStatus({ kind: 'idle' });
  }, []);

  // example from the URL
  useEffect(() => {
    const ex = examples.find((e) => e.id === example);
    if (ex) load({ prompt: ex.prompt, code: ex.code });
  }, [example, load]);

  // shared code from the URL hash
  useEffect(() => {
    const m = location.hash.match(/^#c=(.+)$/);
    if (!m) return;
    decodeShare(m[1])
      .then((c) => load({ prompt: 'Shared component', code: c }))
      .catch(() =>
        setStatus({ kind: 'error', message: 'That share link looks broken.' }),
      );
  }, [load]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  async function generate(mode: 'new' | 'iterate') {
    const text = prompt.trim();
    if (text.length < 3 || streaming) return;
    abort.current = new AbortController();
    setStatus({ kind: 'streaming' });
    setMobileTab('code');
    const base = code;
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          code: mode === 'iterate' ? base : undefined,
        }),
        signal: abort.current.signal,
      });
      if (!res.ok || !res.body) {
        const msg = (await res.json().catch(() => null))?.error;
        throw new Error(msg ?? `Generation failed (${res.status}).`);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let raw = '';
      let frame = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += value;
        if (!frame) {
          frame = requestAnimationFrame(() => {
            frame = 0;
            setCode(extractCode(raw));
          });
        }
      }
      cancelAnimationFrame(frame);
      const final = extractCode(raw);
      if (!final.trim())
        throw new Error('The model returned an empty response.');
      setCode(final);
      setVersions((vs) => {
        const next = [
          ...vs.slice(0, active + 1),
          { prompt: text, code: final },
        ];
        setActive(next.length - 1);
        return next;
      });
      setPrompt('');
      setStatus({ kind: 'idle' });
      setMobileTab('preview');
    } catch (e) {
      setCode(base);
      setMobileTab('preview');
      if ((e as Error).name === 'AbortError') setStatus({ kind: 'idle' });
      else setStatus({ kind: 'error', message: (e as Error).message });
    }
  }

  async function share() {
    const url = `${location.origin}/#c=${await encodeShare(code)}`;
    history.replaceState(null, '', url);
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    flash('Share link copied');
  }

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-4 py-3 md:px-6">
        <a
          href="https://ahmadmarzuki.com"
          className="font-display text-sm font-extrabold tracking-tight"
        >
          Prompt <span className="text-gradient">→</span> UI
        </a>
        <nav
          aria-label="Examples"
          className="flex flex-1 gap-2 overflow-x-auto"
        >
          {examples.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => navigate({ search: { example: e.id } })}
              aria-pressed={
                example === e.id || (!example && e.id === examples[0].id)
              }
              className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-hot/50 hover:text-fg aria-pressed:border-hot/60 aria-pressed:text-fg"
            >
              {e.title}
            </button>
          ))}
        </nav>
        <p className="hidden font-mono text-[11px] text-muted lg:block">
          TanStack Start · AI SDK · sandboxed iframe
        </p>
      </header>

      <div className="grid flex-1 lg:min-h-0 lg:grid-cols-[340px_1fr_1.15fr]">
        {/* composer + history */}
        <aside className="flex min-h-0 flex-col border-b border-line lg:border-b-0 lg:border-r">
          <form
            className="p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void generate('new');
            }}
          >
            <label
              htmlFor="prompt"
              className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted"
            >
              Describe a component
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void generate(e.shiftKey ? 'iterate' : 'new');
                }
              }}
              rows={4}
              maxLength={1200}
              placeholder="A dashboard stat card with a sparkline and a trend badge…"
              className="mt-2 w-full resize-none rounded-xl border border-line bg-ink-2 p-3 text-sm outline-none placeholder:text-muted/70 focus:border-hot/50"
            />
            <div className="mt-2 flex gap-2">
              {streaming ? (
                <button
                  type="button"
                  onClick={() => abort.current?.abort()}
                  className="flex-1 rounded-xl border border-line py-2.5 text-sm"
                >
                  Stop
                </button>
              ) : (
                <>
                  <button
                    type="submit"
                    disabled={prompt.trim().length < 3}
                    className="flex-1 rounded-xl bg-gradient-to-r from-hot to-violet py-2.5 text-sm font-bold text-white shadow-[0_8px_30px_-8px_#ff3d6e] transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
                  >
                    Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => void generate('iterate')}
                    disabled={prompt.trim().length < 3}
                    title="Apply the prompt as a change to the current component"
                    className="rounded-xl border border-line px-3 text-sm transition hover:border-hot/50 disabled:opacity-40"
                  >
                    Refine
                  </button>
                </>
              )}
            </div>
            <p className="mt-2 font-mono text-[10px] text-muted">
              ⌘/Ctrl+Enter generate · +Shift refine
            </p>
            {status.kind === 'error' && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-hot/30 bg-hot/10 px-3 py-2 text-xs text-hot"
              >
                {status.message}
              </p>
            )}
          </form>

          <div className="hidden min-h-0 flex-1 overflow-y-auto border-t border-line p-4 lg:block">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">
              History
            </p>
            <ol className="mt-3 space-y-2">
              {versions.map((v, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      setActive(i);
                      setCode(v.code);
                    }}
                    aria-current={i === active}
                    className="w-full rounded-lg border border-line p-3 text-left text-xs leading-relaxed text-muted transition hover:text-fg aria-[current=true]:border-hot/50 aria-[current=true]:bg-hot/5 aria-[current=true]:text-fg"
                  >
                    <span className="mb-1 block font-mono text-[10px] text-hot">
                      v{i + 1}
                    </span>
                    {v.prompt}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        {/* mobile tab switch */}
        <div className="flex border-b border-line lg:hidden" role="tablist">
          {(['preview', 'code'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={mobileTab === t}
              onClick={() => setMobileTab(t)}
              className="flex-1 py-2 text-xs uppercase tracking-widest text-muted aria-selected:border-b-2 aria-selected:border-hot aria-selected:text-fg"
            >
              {t}
            </button>
          ))}
        </div>

        {/* editor */}
        <section
          aria-label="Code"
          className={`${mobileTab === 'code' ? 'flex' : 'hidden'} h-[75vh] min-h-0 flex-col border-line lg:flex lg:h-auto lg:border-r`}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <span className="font-mono text-[11px] text-muted">
              App.tsx{' '}
              {streaming && <span className="text-hot">· streaming</span>}
            </span>
            <div className="flex gap-3 text-[11px]">
              <button
                type="button"
                className="text-muted hover:text-fg"
                onClick={() =>
                  navigator.clipboard
                    ?.writeText(code)
                    .then(() => flash('Code copied'))
                }
              >
                Copy
              </button>
              <button
                type="button"
                className="text-muted hover:text-fg"
                onClick={() => void share()}
              >
                Share
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <Suspense
              fallback={
                <pre className="h-full overflow-auto p-4 font-mono text-[12.5px] leading-relaxed text-fg/70">
                  {code}
                </pre>
              }
            >
              <CodeEditor
                value={code}
                onChange={setCode}
                readOnly={streaming}
              />
            </Suspense>
          </div>
        </section>

        {/* preview */}
        <section
          aria-label="Preview"
          className={`${mobileTab === 'preview' ? 'flex' : 'hidden'} h-[80vh] min-h-0 flex-col lg:flex lg:h-auto`}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <span className="font-mono text-[11px] text-muted">Preview</span>
            <div className="flex gap-1" role="group" aria-label="Viewport">
              {(['mobile', 'tablet', 'desktop'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={viewport === v}
                  onClick={() => setViewport(v)}
                  className="rounded-md px-2 py-0.5 text-[11px] capitalize text-muted aria-pressed:bg-white/10 aria-pressed:text-fg"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <Preview code={code} viewport={viewport} paused={streaming} />
          </div>
        </section>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-fg px-4 py-2 text-xs font-bold text-ink shadow-xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
