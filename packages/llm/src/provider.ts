import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { EmbeddingModel, LanguageModel } from "ai";

export interface LLMConfig {
  /** OpenRouter API key (local/BYO runs) — or omit and set gateway=true on Vercel */
  apiKey?: string;
  chatModel?: string;
  embeddingModel?: string;
  /** Use Vercel AI Gateway plain model strings (hosted demo tier) */
  gateway?: boolean;
}

export interface LLMClient {
  chat: LanguageModel;
  embedding: EmbeddingModel;
  chatModelId: string;
  embeddingModelId: string;
}

export const DEFAULT_CHAT_MODEL = "google/gemini-2.5-flash";
export const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

/**
 * Build the LLM client. Two modes:
 *  - OpenRouter (BYO key): direct wiring via the OpenAI-compatible endpoint.
 *  - Gateway (hosted demo): plain "provider/model" strings resolved by Vercel AI Gateway.
 */
export function createLLMClient(config: LLMConfig): LLMClient {
  const chatModelId = config.chatModel ?? DEFAULT_CHAT_MODEL;
  const embeddingModelId = config.embeddingModel ?? DEFAULT_EMBEDDING_MODEL;

  if (config.gateway) {
    // AI SDK accepts plain model-id strings when AI Gateway is available.
    return {
      chat: chatModelId,
      embedding: embeddingModelId,
      chatModelId,
      embeddingModelId,
    };
  }

  const apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "No API key: set OPENROUTER_API_KEY (or pass apiKey) for local runs.",
    );
  }
  const openrouter = createOpenAICompatible({
    name: "openrouter",
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    // OpenRouter supports OpenAI json_schema response_format; without this flag
    // the SDK silently drops the schema and models drift from it.
    supportsStructuredOutputs: true,
    headers: {
      "HTTP-Referer": "https://broadlistening.org",
      "X-Title": "Broad Listening",
    },
  });
  return {
    chat: openrouter(chatModelId),
    embedding: openrouter.embeddingModel(embeddingModelId),
    chatModelId,
    embeddingModelId,
  };
}
