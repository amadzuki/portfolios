# portfolios

Nx monorepo for [ahmadmarzuki.com](https://ahmadmarzuki.com) and a set of frontend/AI showcase projects.
Each app deliberately uses a different framework, chosen for what that framework does best.

| Project                     | Path             | Stack                            | Status      |
| --------------------------- | ---------------- | -------------------------------- | ----------- |
| Personal site + "Ask Ahmad" | `apps/web`       | Next.js, three.js, d3            | in progress |
| Prompt-to-UI Playground     | `apps/prompt-ui` | TanStack Start                   | planned     |
| Chat-with-your-Data         | `apps/data-chat` | React Router v7                  | planned     |
| LLM layer                   | `libs/llm`       | Vercel AI SDK, provider-agnostic | ✅          |

## Getting started

```bash
bun install
cp .env.example .env   # add your GLM (or other) API key
bunx nx run-many -t test typecheck
bunx nx dev web        # http://localhost:3000
bunx nx e2e web-e2e    # Playwright smoke tests (desktop + mobile)
```

## The Lab

Each letter of **AHMAD MARZUKI** is its own generative piece at `/lab/<slug>`, built with one of six
techniques: GPU particles (custom point shader), instanced voxels, a GLSL pixel/glitch shader,
a d3-force network, live d3-contour topography and an ASCII field. Glyphs are rasterised from the site's
display font at runtime, every technique is code-split, and all of them respect `prefers-reduced-motion`.
Visual direction inspired by Reflektor Digital's _36 Days of Type_.
