/**
 * Embedding Provider Abstraction
 * ================================
 *
 * Defines the EmbeddingProvider interface and a factory that instantiates
 * the right backend based on env configuration.
 *
 * ## Supported providers
 *
 *   openai  — OpenAI embeddings API (text-embedding-3-small / text-embedding-3-large)
 *             Requires: OPENAI_API_KEY
 *             Default model: text-embedding-3-small (1536 dims, fast & cheap)
 *
 *   local   — Any OpenAI-compatible local server:
 *               • LM Studio  → http://localhost:1234/v1
 *               • Ollama     → http://localhost:11434/v1
 *               • llama.cpp  → http://localhost:8080/v1
 *             Requires: EMBEDDING_BASE_URL
 *             No API key needed (uses "local" as placeholder).
 *             Recommended models: nomic-embed-text, mxbai-embed-large, all-minilm
 *
 * ## What about Claude / Anthropic?
 *
 * Anthropic does not offer a public embeddings API.
 * If you want a self-hosted model with Claude-like quality, use the `local`
 * provider with an instruction-tuned embedding model via LM Studio or Ollama.
 *
 * For AI-based matching that uses Claude's reasoning (rather than embeddings),
 * see the `claude-judge` algorithm (future implementation) which sends both
 * profiles to Claude and parses a structured compatibility score.
 *
 * ## Configuration (.env)
 *
 *   EMBEDDING_PROVIDER=openai              # openai | local
 *   EMBEDDING_MODEL=text-embedding-3-small # model name
 *   OPENAI_API_KEY=sk-...                  # openai only
 *   EMBEDDING_BASE_URL=http://localhost:1234/v1  # local only
 *
 * ## Batch embedding
 *
 * The `embedBatch()` method sends all texts in a single API request.
 * The `embedding-cosine` algorithm uses this in its `prepare()` step to embed
 * all applicants' text fields in O(applicants) API calls instead of O(pairs).
 * For 50 applicants with 3 text fields each, that's 3 requests (one batch each)
 * instead of 50×49×3 = 7350 individual calls.
 */

import { env } from "../../config/env.js";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;

  /** Embed a single text string. Returns a float vector. */
  embed(text: string): Promise<number[]>;

  /**
   * Embed multiple texts in one API call.
   * Returns vectors in the same order as the input.
   * Falls back to sequential embed() calls if the provider doesn't support batching.
   */
  embedBatch(texts: string[]): Promise<number[][]>;
}

// ─── OpenAI-compatible provider ───────────────────────────────────────────────
//
// Works for OpenAI directly AND for any local server that speaks the
// OpenAI embeddings REST format (LM Studio, Ollama, llama.cpp, etc.).

class OpenAICompatibleProvider implements EmbeddingProvider {
  readonly name: string;
  readonly model: string;

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(opts: {
    name: string;
    model: string;
    baseUrl: string;
    apiKey: string;
  }) {
    this.name = opts.name;
    this.model = opts.model;
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
  }

  async embed(text: string): Promise<number[]> {
    const [vec] = await this.embedBatch([text]);
    return vec;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ input: texts, model: this.model }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "(no body)");
      throw new Error(
        `[embedding:${this.name}] API error ${response.status}: ${body}`
      );
    }

    const json = (await response.json()) as {
      data: { index: number; embedding: number[] }[];
    };

    // The API guarantees objects are ordered by index — sort defensively anyway
    return json.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _instance: EmbeddingProvider | null = null;

/**
 * Returns the configured embedding provider (singleton).
 * Throws with a clear message if required env vars are missing.
 */
export function getEmbeddingProvider(): EmbeddingProvider {
  if (_instance) return _instance;

  const provider = env.embeddingProvider;

  if (provider === "openai") {
    if (!env.openaiApiKey) {
      throw new Error(
        "[embedding] EMBEDDING_PROVIDER=openai requires OPENAI_API_KEY to be set."
      );
    }
    _instance = new OpenAICompatibleProvider({
      name: "openai",
      model: env.embeddingModel,
      baseUrl: "https://api.openai.com/v1",
      apiKey: env.openaiApiKey,
    });
    return _instance;
  }

  if (provider === "local") {
    if (!env.embeddingBaseUrl) {
      throw new Error(
        "[embedding] EMBEDDING_PROVIDER=local requires EMBEDDING_BASE_URL " +
        "(e.g. http://localhost:1234/v1 for LM Studio, http://localhost:11434/v1 for Ollama)."
      );
    }
    _instance = new OpenAICompatibleProvider({
      name: "local",
      model: env.embeddingModel,
      baseUrl: env.embeddingBaseUrl,
      apiKey: "local-key", // placeholder — local servers ignore the key
    });
    return _instance;
  }

  throw new Error(
    `[embedding] Unknown EMBEDDING_PROVIDER "${provider}". Valid values: openai, local.`
  );
}

/** Reset the singleton — useful in tests when switching providers between runs. */
export function resetEmbeddingProvider(): void {
  _instance = null;
}
