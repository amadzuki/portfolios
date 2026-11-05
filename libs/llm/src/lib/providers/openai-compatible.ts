import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { ProviderAdapter, ProviderSettings } from '../types';

const make = (name: string, fallbackURL: string) => (s: ProviderSettings) =>
  createOpenAICompatible({
    name,
    baseURL: s.baseURL ?? fallbackURL,
    apiKey: s.apiKey,
    includeUsage: true,
  });

const openrouterClient = make('openrouter', 'https://openrouter.ai/api/v1');
export const openrouter: ProviderAdapter = {
  id: 'openrouter',
  apiKeyEnv: 'OPENROUTER_API_KEY',
  baseURLEnv: 'OPENROUTER_BASE_URL',
  defaults: {
    chat: 'z-ai/glm-4.6',
    fast: 'z-ai/glm-4.5-air',
    code: 'z-ai/glm-4.6',
  },
  languageModel: (id, s) => openrouterClient(s).chatModel(id),
};

const ollamaClient = make('ollama', 'http://localhost:11434/v1');
export const ollama: ProviderAdapter = {
  id: 'ollama',
  baseURLEnv: 'OLLAMA_BASE_URL',
  defaults: {
    chat: 'llama3.2',
    fast: 'llama3.2',
    code: 'qwen2.5-coder',
    embed: 'nomic-embed-text',
  },
  languageModel: (id, s) => ollamaClient(s).chatModel(id),
  embeddingModel: (id, s) => ollamaClient(s).embeddingModel(id),
};
