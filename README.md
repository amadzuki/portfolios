# portfolios

Nx monorepo for [ahmadmarzuki.com](https://ahmadmarzuki.com) and a set of frontend/AI showcase projects.
Each app deliberately uses a different framework, chosen for what that framework does best.

| Project                     | Path             | Stack                                 | Status      |
| --------------------------- | ---------------- | ------------------------------------- | ----------- |
| Personal site + "Ask Ahmad" | `apps/web`       | Next.js, three.js, d3                 | in progress |
| Lumen Drift (web game)      | `apps/game`      | three.js, GLSL, WebAudio, Vite        | ✅          |
| Prompt-to-UI Playground     | `apps/prompt-ui` | TanStack Start, CodeMirror 6, sucrase | ✅          |
| Chat-with-your-Data         | `apps/data-chat` | React Router (framework mode), visx   | ✅          |
| Huddle (multiplayer board)  | `apps/board`     | SvelteKit, Svelte 5, Yjs, WebSockets  | ✅          |
| LLM layer                   | `libs/llm`       | Vercel AI SDK, provider-agnostic      | ✅          |

## Getting started

```bash
bun install
cp .env.example .env   # add your GLM (or other) API key
bunx nx run-many -t test typecheck
bunx nx dev web        # http://localhost:3000
bunx nx dev game       # http://localhost:4300
bunx nx dev prompt-ui  # http://localhost:4400
bunx nx dev data-chat  # http://localhost:4500
bunx nx dev board      # http://localhost:4600
bunx nx e2e web-e2e    # Playwright smoke tests (desktop + mobile)
```

## The Lab

Each letter of **AHMAD MARZUKI** is its own generative piece at `/lab/<slug>`, built with one of six
techniques: GPU particles (custom point shader), instanced voxels, a GLSL pixel/glitch shader,
a d3-force network, live d3-contour topography and an ASCII field. Glyphs are rasterised from the site's
display font at runtime, every technique is code-split, and all of them respect `prefers-reduced-motion`.
Visual direction inspired by Reflektor Digital's _36 Days of Type_.

## Ask Ahmad

`POST /api/chat` streams answers grounded in `libs/content` (profile, experience, projects). The whole
knowledge base fits in the system prompt, each section tagged with an id; the model cites ids like
`[exp-prospace]` and the widget renders them as links to the matching section. Requests are rate-limited
and budget-capped, and the route returns a clear 503 when no API key is configured. Swap the model by
editing `.env` only (see `libs/llm`).

## Chat with your Data

`apps/data-chat` uses React Router's framework mode for what it does well: a prerendered landing page,
a `clientAction` that parses uploads in a Web Worker (Papa Parse) and stores them in IndexedDB, and a
`clientAction` that calls the server `action` via `serverAction()` so only the schema reaches the server.
The model returns a typed chart spec (`generateObject`), which is repaired against the real columns,
aggregated over every row in the browser and drawn with visx. With no API key, a rule-based parser answers
instead, so the demo always works. "What gets sent?" shows the exact payload.

## Huddle

`apps/board` is a realtime sticky-note board on SvelteKit. Svelte 5 runes keep the UI fine-grained while
dozens of cursors and notes update at once, and `Spring` motion makes remote moves and the AI tidy-up glide.
State is a Yjs document synced over a small y-websocket-compatible server (`src/lib/server/sync.ts`), which is
attached to Vite in development and to `server.ts` in production (`node server.ts`, one port for pages and
sockets). "Tidy up" sends only note texts to `/api/tidy`, which asks the LLM layer for themes (keyword
clustering without a key) and lays them out as frames in one undoable transaction. "Start a board" is a
SvelteKit form action, so it works before JavaScript loads.
