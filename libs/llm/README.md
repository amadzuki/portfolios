# @portfolios/llm

Provider-agnostic LLM access for every app in the monorepo, built on the Vercel AI SDK.
**Server-only**: it reads API keys from `process.env`. Never import it from client components.

```ts
import {
  streamText,
  generateObject,
  embed,
  createGuard,
  clientKey,
} from '@portfolios/llm';

const result = streamText({ role: 'chat', system: '...', messages });
return result.toUIMessageStreamResponse();
```

| Function                          | Purpose                                             |
| --------------------------------- | --------------------------------------------------- |
| `generateText(opts)`              | one-shot completion                                 |
| `streamText(opts)`                | streaming completion (returns AI SDK stream result) |
| `generateObject({ schema, ... })` | zod-validated structured output                     |
| `embed(values)`                   | embeddings (`number[][]`)                           |
| `createGuard` / `clientKey`       | rate limit and daily budget for public demos        |
| `topK` / `cosineSimilarity`       | in-memory retrieval                                 |

`role` (`chat` / `fast` / `code`) picks a model by purpose; the concrete model comes from env.

## Switching providers

Change `.env` only (see `/.env.example`): `LLM_PROVIDER=glm|anthropic|openai|google|openrouter|ollama`.
To add a vendor, write a `ProviderAdapter` in `src/lib/providers/` and register it in `providers/index.ts`.
