import type { EmbeddingModel, LanguageModel } from 'ai';

/** What a feature needs, not which vendor model it gets. Mapped to concrete models via config. */
export type ModelRole = 'chat' | 'fast' | 'code';

export const PROVIDER_IDS = [
  'glm',
  'anthropic',
  'openai',
  'google',
  'openrouter',
  'ollama',
] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export interface ProviderSettings {
  apiKey?: string;
  baseURL?: string;
}

/** One small adapter per vendor. Adding a provider = adding one of these to the registry. */
export interface ProviderAdapter {
  id: ProviderId;
  /** Default model ids per role, overridable through env. */
  defaults: Record<ModelRole, string> & { embed?: string };
  /** Env var holding the API key (undefined for keyless local providers). */
  apiKeyEnv?: string;
  baseURLEnv?: string;
  languageModel(modelId: string, settings: ProviderSettings): LanguageModel;
  /** Omit when the vendor has no embeddings API. */
  embeddingModel?(modelId: string, settings: ProviderSettings): EmbeddingModel;
}
