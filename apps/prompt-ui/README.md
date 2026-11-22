# Prompt → UI

Describe a component; an LLM streams React + Tailwind into a live editor and a sandboxed preview.
Refine it with follow-up prompts, step through versions, and share any result by link.

**Why TanStack Start:** a type-safe file-routed app with a server route (`/api/generate`) that
streams model output, search-param state (`?example=pricing`) validated with zod, and SSR for the shell.

How it works:

- `src/routes/api/generate.ts` validates the request, applies the rate limit / budget guard and
  streams text from `@portfolios/llm` (role `code`). The LLM layer is imported lazily so keys and
  provider SDKs never reach the client bundle.
- The client reads the stream, strips fences/prose as it arrives (`lib/extract.ts`) and updates
  CodeMirror 6 in real time.
- `lib/code.ts` compiles TSX with **sucrase** in the browser, checks imports against an allowlist
  (`react`, `lucide-react`) and builds an iframe document with an import map (esm.sh) and the
  Tailwind browser build.
- The iframe is sandboxed with `allow-scripts` only (no `allow-same-origin`): generated code can't
  read this page, its cookies or storage. Runtime errors come back over `postMessage`.
- Share links store the code deflate-compressed in the URL hash, so nothing is stored server-side.
- Four handcrafted examples work with no API key.

```bash
bunx nx dev prompt-ui       # http://localhost:4400
bunx nx test prompt-ui
bunx nx e2e prompt-ui-e2e   # mocked generation, desktop + mobile
```
