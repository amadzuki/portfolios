import { createLLM, type LLMClient } from './lib/client';

export {
  createLLM,
  type CallOptions,
  type LLMClient,
  type LLMClientDeps,
  type StreamResult,
} from './lib/client';
export { loadConfig, LLMConfigError, type LLMConfig } from './lib/config';
export {
  createGuard,
  clientKey,
  type GuardOptions,
  type GuardResult,
} from './lib/guard';
export { providers } from './lib/providers';
export { cosineSimilarity, topK } from './lib/similarity';
export {
  PROVIDER_IDS,
  type ModelRole,
  type ProviderAdapter,
  type ProviderId,
} from './lib/types';
export type { ModelMessage } from 'ai';

/** Default client configured from process.env (lazily, on first call). Server-side only. */
export const llm: LLMClient = createLLM();
export const generateText: LLMClient['generateText'] = llm.generateText;
export const streamText: LLMClient['streamText'] = llm.streamText;
export const generateObject: LLMClient['generateObject'] = llm.generateObject;
export const embed: LLMClient['embed'] = llm.embed;
