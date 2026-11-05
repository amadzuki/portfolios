import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('defaults to GLM', () => {
    const c = loadConfig({ GLM_API_KEY: 'k' });
    expect(c.provider).toBe('glm');
    expect(c.embed).toEqual({ provider: 'glm', model: 'embedding-3' });
    expect(c.settings('glm')).toEqual({ apiKey: 'k', baseURL: undefined });
  });

  it('lets chat and embeddings come from different vendors', () => {
    const c = loadConfig({
      LLM_PROVIDER: 'anthropic',
      LLM_MODEL_FAST: 'custom-fast',
      LLM_EMBED_PROVIDER: 'openai',
    });
    expect(c.models.fast).toBe('custom-fast');
    expect(c.embed).toEqual({
      provider: 'openai',
      model: 'text-embedding-3-small',
    });
  });

  it('rejects unknown providers', () => {
    expect(() => loadConfig({ LLM_PROVIDER: 'nope' })).toThrow(
      /Invalid LLM env/,
    );
  });
});
