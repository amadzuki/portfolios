import {
  embedMany,
  generateText as sdkGenerateText,
  Output,
  streamText as sdkStreamText,
  type EmbeddingModel,
  type FinishReason,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
} from 'ai';
import type { z } from 'zod';
import { LLMConfigError, loadConfig, type LLMConfig } from './config';
import { providers } from './providers';
import type { ModelRole } from './types';

export interface CallOptions {
  /** Which kind of model to use. Defaults to 'chat'. */
  role?: ModelRole;
  system?: string;
  messages?: ModelMessage[];
  prompt?: string;
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface LLMClientDeps {
  config?: LLMConfig;
  /** Override model resolution (tests, or pinning a specific model instance). */
  resolveModel?: (role: ModelRole) => LanguageModel;
  resolveEmbeddingModel?: () => EmbeddingModel;
}

export type StreamResult = ReturnType<typeof sdkStreamText>;

/** The whole surface apps are allowed to use. Explicit so it stays vendor-neutral and stable. */
export interface LLMClient {
  getModel(role: ModelRole): LanguageModel;
  getEmbeddingModel(): EmbeddingModel;
  generateText(
    o: CallOptions,
  ): Promise<{
    text: string;
    usage: LanguageModelUsage;
    finishReason: FinishReason;
  }>;
  streamText(
    o: CallOptions & { onFinish?: (text: string) => void },
  ): StreamResult;
  generateObject<S extends z.ZodType>(
    o: CallOptions & { schema: S },
  ): Promise<{ object: z.infer<S>; usage: LanguageModelUsage }>;
  embed(values: string[], opts?: { signal?: AbortSignal }): Promise<number[][]>;
  describe(): Pick<LLMConfig, 'provider' | 'models' | 'embed'>;
}

const toPrompt = (o: CallOptions) =>
  o.messages ? { messages: o.messages } : { prompt: o.prompt ?? '' };

/** Builds an LLM client. Apps should use the default `llm` instance; tests inject mocks. */
export function createLLM(deps: LLMClientDeps = {}): LLMClient {
  let cfg = deps.config;
  const config = () => (cfg ??= loadConfig());

  const getModel =
    deps.resolveModel ??
    ((role: ModelRole) => {
      const c = config();
      return providers[c.provider].languageModel(
        c.models[role],
        c.settings(c.provider),
      );
    });

  const getEmbeddingModel =
    deps.resolveEmbeddingModel ??
    (() => {
      const c = config();
      const embed = c.embed;
      const factory = embed && providers[embed.provider].embeddingModel;
      if (!embed || !factory) {
        throw new LLMConfigError(
          `Provider "${c.provider}" has no embeddings API. Set LLM_EMBED_PROVIDER (e.g. glm, openai, google, ollama).`,
        );
      }
      return factory(embed.model, c.settings(embed.provider));
    });

  const base = (o: CallOptions) => ({
    model: getModel(o.role ?? 'chat'),
    system: o.system,
    maxOutputTokens: o.maxOutputTokens,
    temperature: o.temperature,
    abortSignal: o.signal,
    ...toPrompt(o),
  });

  return {
    getModel,
    getEmbeddingModel,

    /** One-shot text completion. */
    async generateText(o: CallOptions) {
      const r = await sdkGenerateText(base(o));
      return { text: r.text, usage: r.usage, finishReason: r.finishReason };
    },

    /**
     * Streaming completion. Returns the SDK result so route handlers can use
     * `toTextStreamResponse()` / `toUIMessageStreamResponse()` directly.
     */
    streamText(o) {
      return sdkStreamText({
        ...base(o),
        onFinish: o.onFinish
          ? (e: { text: string }) => o.onFinish?.(e.text)
          : undefined,
      });
    },

    /** Structured output validated against a zod schema. */
    async generateObject<S extends z.ZodType>(o: CallOptions & { schema: S }) {
      const r = await sdkGenerateText({
        ...base(o),
        output: Output.object({ schema: o.schema }),
      });
      return { object: r.output as z.infer<S>, usage: r.usage };
    },

    /** Embeds one or many strings. */
    async embed(values: string[], opts: { signal?: AbortSignal } = {}) {
      const r = await embedMany({
        model: getEmbeddingModel(),
        values,
        abortSignal: opts.signal,
      });
      return r.embeddings as number[][];
    },

    /** Human-readable description of the active setup, handy for footers/debug pages. */
    describe() {
      const c = config();
      return { provider: c.provider, models: c.models, embed: c.embed };
    },
  };
}
