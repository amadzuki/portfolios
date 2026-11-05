import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { ProviderAdapter, ProviderSettings } from '../types';

/** Zhipu GLM via its OpenAI-compatible endpoint. Use https://open.bigmodel.cn/api/paas/v4 for the mainland endpoint. */
export const GLM_DEFAULT_BASE_URL = 'https://api.z.ai/api/paas/v4';

const client = (s: ProviderSettings) =>
  createOpenAICompatible({
    name: 'glm',
    baseURL: s.baseURL ?? GLM_DEFAULT_BASE_URL,
    apiKey: s.apiKey,
    includeUsage: true,
  });

export const glm: ProviderAdapter = {
  id: 'glm',
  apiKeyEnv: 'GLM_API_KEY',
  baseURLEnv: 'GLM_BASE_URL',
  defaults: {
    chat: 'glm-4.6',
    fast: 'glm-4.5-air',
    code: 'glm-4.6',
    embed: 'embedding-3',
  },
  languageModel: (id, s) => client(s).chatModel(id),
  embeddingModel: (id, s) => client(s).embeddingModel(id),
};
