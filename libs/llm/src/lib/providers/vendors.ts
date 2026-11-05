import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { ProviderAdapter } from '../types';

export const anthropic: ProviderAdapter = {
  id: 'anthropic',
  apiKeyEnv: 'ANTHROPIC_API_KEY',
  baseURLEnv: 'ANTHROPIC_BASE_URL',
  defaults: {
    chat: 'claude-sonnet-5-5',
    fast: 'claude-haiku-5-5',
    code: 'claude-sonnet-5-5',
  },
  languageModel: (id, s) => createAnthropic(s)(id),
};

export const openai: ProviderAdapter = {
  id: 'openai',
  apiKeyEnv: 'OPENAI_API_KEY',
  baseURLEnv: 'OPENAI_BASE_URL',
  defaults: {
    chat: 'gpt-5',
    fast: 'gpt-5-mini',
    code: 'gpt-5',
    embed: 'text-embedding-3-small',
  },
  languageModel: (id, s) => createOpenAI(s)(id),
  embeddingModel: (id, s) => createOpenAI(s).embeddingModel(id),
};

export const google: ProviderAdapter = {
  id: 'google',
  apiKeyEnv: 'GOOGLE_GENERATIVE_AI_API_KEY',
  baseURLEnv: 'GOOGLE_BASE_URL',
  defaults: {
    chat: 'gemini-2.5-pro',
    fast: 'gemini-2.5-flash',
    code: 'gemini-2.5-pro',
    embed: 'gemini-embedding-001',
  },
  languageModel: (id, s) => createGoogleGenerativeAI(s)(id),
  embeddingModel: (id, s) => createGoogleGenerativeAI(s).embeddingModel(id),
};
