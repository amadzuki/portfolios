import type { ProviderAdapter, ProviderId } from '../types';
import { glm } from './glm';
import { ollama, openrouter } from './openai-compatible';
import { anthropic, google, openai } from './vendors';

export const providers: Record<ProviderId, ProviderAdapter> = {
  glm,
  anthropic,
  openai,
  google,
  openrouter,
  ollama,
};
