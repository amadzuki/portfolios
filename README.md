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
```
