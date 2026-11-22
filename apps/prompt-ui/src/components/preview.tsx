import { useEffect, useMemo, useRef, useState } from 'react';
type Compiler = typeof import('../lib/code');

export type Viewport = 'mobile' | 'tablet' | 'desktop';
const widths: Record<Viewport, string> = {
  mobile: '390px',
  tablet: '820px',
  desktop: '100%',
};

/**
 * Renders code in an iframe sandboxed with `allow-scripts` only: no same-origin access, so
 * generated code cannot touch this page, its cookies or storage.
 */
export function Preview({
  code,
  viewport,
  paused,
}: {
  code: string;
  viewport: Viewport;
  paused: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [debounced, setDebounced] = useState(code);

  useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => setDebounced(code), 350);
    return () => clearTimeout(id);
  }, [code, paused]);

  // The TSX compiler (sucrase) is loaded on demand to keep the initial bundle small.
  const [compiler, setCompiler] = useState<Compiler | null>(null);
  useEffect(() => {
    void import('../lib/code').then(setCompiler);
  }, []);
  const compiled = useMemo(
    () => compiler?.compile(debounced) ?? null,
    [compiler, debounced],
  );
  const doc =
    compiled?.ok && compiler ? compiler.buildSrcDoc(compiled.js) : null;

  useEffect(() => {
    setRuntimeError(null);
    setReady(false);
  }, [doc]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (
        e.source !== frame.current?.contentWindow ||
        e.data?.source !== 'prompt-ui-preview'
      )
        return;
      if (e.data.type === 'error') setRuntimeError(String(e.data.message));
      if (e.data.type === 'ready') setReady(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const error = !compiled ? null : compiled.ok ? runtimeError : compiled.error;

  return (
    <div className="relative flex h-full min-h-0 items-start justify-center overflow-auto bg-[conic-gradient(at_top_left,#13111c,#0c0b12)] p-3">
      <div
        className="h-full overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-white/10 transition-[width] duration-500"
        style={{ width: widths[viewport], maxWidth: '100%' }}
      >
        {doc && (
          <iframe
            ref={frame}
            title="Component preview"
            sandbox="allow-scripts allow-forms allow-modals"
            srcDoc={doc}
            className="h-full w-full"
            data-ready={ready ? 'true' : 'false'}
          />
        )}
      </div>
      {paused && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-ink/40 backdrop-blur-[2px]">
          <p className="animate-pulse font-mono text-xs uppercase tracking-[0.3em] text-fg/80">
            writing component…
          </p>
        </div>
      )}
      {error && !paused && (
        <div
          role="alert"
          className="absolute inset-x-4 bottom-4 rounded-lg border border-hot/40 bg-ink/95 p-3 font-mono text-xs text-hot shadow-xl"
        >
          <p className="mb-1 font-bold uppercase tracking-wider">
            Preview error
          </p>
          <p className="whitespace-pre-wrap text-fg/80">{error}</p>
        </div>
      )}
    </div>
  );
}
