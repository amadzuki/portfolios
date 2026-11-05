import {
  MockEmbeddingModelV4,
  MockLanguageModelV4,
  convertArrayToReadableStream,
} from 'ai/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createLLM } from './client';
import { loadConfig } from './config';

const usage = {
  inputTokens: {
    total: 3,
    noCache: 3,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
const finishReason = { unified: 'stop' as const, raw: 'stop' };

const textModel = (text: string) =>
  new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: 'text', text }],
      finishReason,
      usage,
      warnings: [],
    },
    doStream: {
      stream: convertArrayToReadableStream([
        { type: 'text-start', id: '1' },
        ...text.split(' ').map((w, i) => ({
          type: 'text-delta' as const,
          id: '1',
          delta: i ? ` ${w}` : w,
        })),
        { type: 'text-end', id: '1' },
        { type: 'finish', finishReason, usage },
      ]),
    },
  });

describe('createLLM', () => {
  it('generateText routes the role to the resolver', async () => {
    const seen: string[] = [];
    const llm = createLLM({
      resolveModel: (role) => {
        seen.push(role);
        return textModel('hello world');
      },
    });
    const r = await llm.generateText({ role: 'fast', prompt: 'hi' });
    expect(r.text).toBe('hello world');
    expect(seen).toEqual(['fast']);
  });

  it('streamText streams deltas', async () => {
    const llm = createLLM({ resolveModel: () => textModel('one two three') });
    let out = '';
    for await (const chunk of llm.streamText({ prompt: 'count' }).textStream)
      out += chunk;
    expect(out).toBe('one two three');
  });

  it('generateObject validates against the schema', async () => {
    const llm = createLLM({
      resolveModel: () => textModel('{"chart":"bar","x":"month"}'),
    });
    const { object } = await llm.generateObject({
      prompt: 'make a chart',
      schema: z.object({ chart: z.enum(['bar', 'line']), x: z.string() }),
    });
    expect(object).toEqual({ chart: 'bar', x: 'month' });
  });

  it('embed returns vectors', async () => {
    const llm = createLLM({
      resolveModel: () => textModel(''),
      resolveEmbeddingModel: () =>
        new MockEmbeddingModelV4({
          doEmbed: async ({ values }) => ({
            embeddings: values.map((v) => [v.length, 1]),
            warnings: [],
          }),
        }),
    });
    expect(await llm.embed(['ab', 'abc'])).toEqual([
      [2, 1],
      [3, 1],
    ]);
  });

  it('builds real provider models from env without code changes', () => {
    for (const provider of [
      'glm',
      'anthropic',
      'openai',
      'google',
      'openrouter',
      'ollama',
    ]) {
      const llm = createLLM({
        config: loadConfig({
          LLM_PROVIDER: provider,
          LLM_MODEL_CHAT: 'my-model',
        }),
      });
      const model = llm.getModel('chat');
      expect(typeof model === 'string' ? model : model.modelId).toBe(
        'my-model',
      );
    }
  });

  it('explains when the provider has no embeddings', () => {
    const llm = createLLM({
      config: loadConfig({ LLM_PROVIDER: 'anthropic' }),
    });
    expect(() => llm.getEmbeddingModel()).toThrow(/LLM_EMBED_PROVIDER/);
  });
});
