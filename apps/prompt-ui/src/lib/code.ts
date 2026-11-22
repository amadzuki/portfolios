import { transform } from 'sucrase';

export const PREVIEW_DEPS = {
  react: '19.2.0',
  lucide: '1.70.0',
  tailwind: '4.3.4',
} as const;

/** Modules generated code may import. Anything else fails fast with a clear message. */
export const ALLOWED_IMPORTS = [
  'react',
  'react/jsx-runtime',
  'lucide-react',
] as const;

export type CompileResult =
  { ok: true; js: string } | { ok: false; error: string };

/** TSX → browser ESM (automatic JSX runtime). Runs in the browser; no bundler needed. */
export function compile(tsx: string): CompileResult {
  const bad = [...tsx.matchAll(/from\s+['"]([^'"]+)['"]/g)]
    .map((m) => m[1])
    .filter((spec) => !(ALLOWED_IMPORTS as readonly string[]).includes(spec));
  if (bad.length)
    return {
      ok: false,
      error: `Unsupported import: ${bad.join(', ')}. Only react and lucide-react are available.`,
    };
  if (!/export\s+default\b/.test(tsx))
    return { ok: false, error: 'The component needs a default export.' };
  try {
    const { code } = transform(tsx, {
      transforms: ['typescript', 'jsx'],
      jsxRuntime: 'automatic',
      production: true,
    });
    return { ok: true, js: code };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Escapes a string so it can sit inside an inline <script> without closing it. */
const scriptSafe = (s: string) => JSON.stringify(s).replace(/</g, '\\u003c');

/**
 * Full HTML document for the sandboxed preview iframe. The compiled module is loaded from a
 * blob URL, React and lucide come from an import map, Tailwind from its browser build.
 * Errors and successful renders are reported to the parent via postMessage.
 */
export function buildSrcDoc(js: string, opts: { dark?: boolean } = {}): string {
  const { react, lucide, tailwind } = PREVIEW_DEPS;
  const importMap = {
    imports: {
      react: `https://esm.sh/react@${react}`,
      'react/jsx-runtime': `https://esm.sh/react@${react}/jsx-runtime`,
      'react-dom/client': `https://esm.sh/react-dom@${react}/client?deps=react@${react}`,
      'lucide-react': `https://esm.sh/lucide-react@${lucide}?deps=react@${react}`,
    },
  };
  return `<!doctype html>
<html class="${opts.dark ? 'dark' : ''}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script type="importmap">${JSON.stringify(importMap)}</script>
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@${tailwind}"></script>
<style>html,body{margin:0;min-height:100%;font-family:ui-sans-serif,system-ui,sans-serif}#root{min-height:100vh}</style>
</head>
<body>
<div id="root"></div>
<script>
  const report = (type, message) => parent.postMessage({ source: 'prompt-ui-preview', type, message }, '*');
  window.addEventListener('error', (e) => report('error', e.message || String(e.error)));
  window.addEventListener('unhandledrejection', (e) => report('error', String(e.reason && e.reason.message || e.reason)));
</script>
<script type="module">
  import { createElement, Component } from 'react';
  import { createRoot } from 'react-dom/client';
  const report = (type, message) => parent.postMessage({ source: 'prompt-ui-preview', type, message }, '*');
  class Boundary extends Component {
    constructor(p) { super(p); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error) { report('error', error.message); }
    render() { return this.state.error ? null : this.props.children; }
  }
  try {
    const url = URL.createObjectURL(new Blob([${scriptSafe(js)}], { type: 'text/javascript' }));
    const mod = await import(url);
    createRoot(document.getElementById('root')).render(createElement(Boundary, null, createElement(mod.default)));
    requestAnimationFrame(() => report('ready'));
  } catch (e) {
    report('error', e.message || String(e));
  }
</script>
</body>
</html>`;
}
