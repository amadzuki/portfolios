import { z } from 'zod';
import { providers } from './providers';
import {
  PROVIDER_IDS,
  type ModelRole,
  type ProviderId,
  type ProviderSettings,
} from './types';

type Env = Record<string, string | undefined>;

const envSchema = z.object({
  LLM_PROVIDER: z.enum(PROVIDER_IDS).default('glm'),
  LLM_MODEL_CHAT: z.string().optional(),
  LLM_MODEL_FAST: z.string().optional(),
  LLM_MODEL_CODE: z.string().optional(),
  /** Embeddings may come from a different vendor (e.g. chat on Anthropic, embeddings on GLM). */
  LLM_EMBED_PROVIDER: z.enum(PROVIDER_IDS).optional(),
  LLM_MODEL_EMBED: z.string().optional(),
});

export interface LLMConfig {
  provider: ProviderId;
  models: Record<ModelRole, string>;
  embed: { provider: ProviderId; model: string } | null;
  settings: (provider: ProviderId) => ProviderSettings;
}

export class LLMConfigError extends Error {
  override name = 'LLMConfigError';
}

/** Reads provider/model selection from env. Switching vendors is an env change, never a code change. */
export function loadConfig(env: Env = process.env): LLMConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new LLMConfigError(
      `Invalid LLM env: ${z.prettifyError(parsed.error)}`,
    );
  }
  const e = parsed.data;
  const adapter = providers[e.LLM_PROVIDER];

  const embedProvider =
    e.LLM_EMBED_PROVIDER ??
    (adapter.embeddingModel ? e.LLM_PROVIDER : undefined);
  const embedModel =
    e.LLM_MODEL_EMBED ??
    (embedProvider ? providers[embedProvider].defaults.embed : undefined);

  return {
    provider: e.LLM_PROVIDER,
    models: {
      chat: e.LLM_MODEL_CHAT ?? adapter.defaults.chat,
      fast: e.LLM_MODEL_FAST ?? adapter.defaults.fast,
      code: e.LLM_MODEL_CODE ?? adapter.defaults.code,
    },
    embed:
      embedProvider && embedModel
        ? { provider: embedProvider, model: embedModel }
        : null,
    settings: (id) => {
      const a = providers[id];
      return {
        apiKey: a.apiKeyEnv ? env[a.apiKeyEnv] : undefined,
        baseURL: a.baseURLEnv ? env[a.baseURLEnv] || undefined : undefined,
      };
    },
  };
}
