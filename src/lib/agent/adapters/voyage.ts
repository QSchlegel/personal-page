/**
 * Voyage AI adapter implementing EmbeddingProvider + Reranker. Anthropic has no
 * embeddings/rerank of its own and recommends Voyage; this is the cloud-native
 * pairing for a Claude stack (no GPU required).
 *
 * Uses the REST API via global fetch (Node 18+/20+) — no extra SDK dependency.
 * Pin a 1024-dim model to stay vector-space compatible with the existing
 * bge-m3 (1024) vectors.
 */
import type { EmbeddingProvider, Reranker } from '../providers';

const DEFAULT_BASE_URL = 'https://api.voyageai.com/v1';
const DEFAULT_EMBED_MODEL = 'voyage-3-large';
const DEFAULT_RERANK_MODEL = 'rerank-2.5';

export interface VoyageAdapterOptions {
  apiKey?: string;
  embedModel?: string;
  rerankModel?: string;
  /** Output embedding dimension (Matryoshka-capable models). Default 1024. */
  dimension?: number | null;
  /** Voyage input_type hint: 'query' for retrieval, 'document' for ingestion. */
  inputType?: 'query' | 'document';
  baseUrl?: string;
  /** Override fetch (testing). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export class VoyageAdapter implements EmbeddingProvider, Reranker {
  readonly available = true;
  private readonly apiKey: string;
  private readonly embedModel: string;
  private readonly rerankModel: string;
  private readonly dimension: number | null;
  private readonly inputType?: 'query' | 'document';
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: VoyageAdapterOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.VOYAGE_API_KEY ?? '';
    this.embedModel = opts.embedModel ?? DEFAULT_EMBED_MODEL;
    this.rerankModel = opts.rerankModel ?? DEFAULT_RERANK_MODEL;
    this.dimension = opts.dimension === undefined ? 1024 : opts.dimension;
    this.inputType = opts.inputType;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async embed(texts: string[], signal?: AbortSignal): Promise<number[][]> {
    if (texts.length === 0) return [];
    const body: Record<string, unknown> = { input: texts, model: this.embedModel };
    if (this.inputType) body.input_type = this.inputType;
    if (this.dimension) body.output_dimension = this.dimension;

    const json = await this.post<{ data: { embedding: number[]; index: number }[] }>(
      '/embeddings',
      body,
      signal,
    );
    return json.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }

  async rerank(query: string, documents: string[], signal?: AbortSignal): Promise<number[]> {
    if (documents.length === 0) return [];
    const json = await this.post<{ data: { index: number; relevance_score: number }[] }>(
      '/rerank',
      { query, documents, model: this.rerankModel, top_k: documents.length, return_documents: false },
      signal,
    );
    const scores = new Array<number>(documents.length).fill(0);
    for (const item of json.data) scores[item.index] = item.relevance_score;
    return scores;
  }

  private async post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    if (!this.apiKey) throw new Error('VoyageAdapter: missing apiKey (set VOYAGE_API_KEY)');
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Voyage ${path} ${response.status}: ${await response.text()}`);
    }
    return (await response.json()) as T;
  }
}
