/**
 * Self-hosted embeddings via HuggingFace Text Embeddings Inference (TEI).
 *
 * Runs as its own Railway service (ghcr.io/huggingface/text-embeddings-inference
 * with --model-id BAAI/bge-base-en-v1.5 → 768-dim), reached over Railway's
 * private network. No external API, no API key.
 *
 * TEI's POST /embed accepts a string or string[] and returns number[][].
 */
import type { EmbeddingProvider } from "../providers";

export interface TeiEmbedderOptions {
  /** Base URL of the TEI service, e.g. http://embeddings.railway.internal */
  baseUrl: string;
  /** Truncate inputs that exceed the model's max length (default true). */
  truncate?: boolean;
  /** Override fetch (testing). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export class TeiEmbedder implements EmbeddingProvider {
  private readonly baseUrl: string;
  private readonly truncate: boolean;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: TeiEmbedderOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.truncate = opts.truncate ?? true;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async embed(texts: string[], signal?: AbortSignal): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await this.fetchImpl(`${this.baseUrl}/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inputs: texts, truncate: this.truncate }),
      signal,
    });
    if (!response.ok) {
      throw new Error(`TEI /embed ${response.status}: ${await response.text()}`);
    }
    return (await response.json()) as number[][];
  }
}
