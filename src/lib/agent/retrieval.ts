/**
 * Portable hybrid search (pgvector similarity + full-text), fused with
 * Reciprocal Rank Fusion in a single SQL statement — ported from
 * dw-ai-support's HybridSearchService but ORM-free.
 *
 * The core ships the SQL builder + row mapper; the caller supplies a minimal
 * pg-like client, so the heavy `pg`/`drizzle` dependency stays in the consumer.
 *
 * Expected schema (caller-owned), defaults shown:
 *   kb_documents(id, title, url, topic, source, visibility, ...)
 *   kb_chunks(id, document_id, content, heading, embedding vector(N), tsv tsvector)
 */
import type { RetrievedChunk } from './types';
import type { Retriever, RetrieverOptions } from './providers';

export type { Retriever, RetrieverOptions } from './providers';

const RRF_K = 60;

export interface HybridSearchSqlOptions extends RetrieverOptions {
  /** Restrict to these visibility values (e.g. ['public','gated']). */
  visibilities?: string[];
  chunkTable?: string;
  documentTable?: string;
  /** Postgres text-search configuration. Default 'english'. */
  ftsConfig?: string;
  rrfK?: number;
}

/** Quote a Postgres identifier (table/column) for safe interpolation. */
function ident(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error(`Unsafe SQL identifier: ${name}`);
  return `"${name}"`;
}

/**
 * Build the parameterized hybrid search query. Returns `{ text, params }` ready
 * for `client.query(text, params)`. Runtime values are bound ($1..$5); table
 * names, FTS config, and RRF_K are validated/interpolated (never user input).
 */
export function buildHybridSearchQuery(
  query: string,
  embedding: number[],
  opts: HybridSearchSqlOptions,
): { text: string; params: unknown[] } {
  const chunks = ident(opts.chunkTable ?? 'kb_chunks');
  const docs = ident(opts.documentTable ?? 'kb_documents');
  const ftsConfig = opts.ftsConfig ?? 'english';
  if (!/^[a-z_][a-z0-9_]*$/i.test(ftsConfig)) throw new Error(`Unsafe FTS config: ${ftsConfig}`);
  const rrfK = opts.rrfK ?? RRF_K;
  if (!Number.isInteger(rrfK)) throw new Error('rrfK must be an integer');

  const params: unknown[] = [
    `[${embedding.join(',')}]`, // $1 embedding literal
    query, // $2 fts query
    opts.topic ?? null, // $3 topic filter (nullable)
    opts.topK, // $4 limit
  ];
  let visClause = '';
  if (opts.visibilities && opts.visibilities.length > 0) {
    params.push(opts.visibilities); // $5
    visClause = `\n          AND d.visibility = ANY($5)`;
  }

  const text = `
    WITH vec AS (
      SELECT c.id, row_number() OVER (ORDER BY c.embedding <=> $1::vector) AS rank
      FROM ${chunks} c
      JOIN ${docs} d ON d.id = c.document_id
      WHERE c.embedding IS NOT NULL
        AND ($3::text IS NULL OR d.topic = $3)${visClause}
      ORDER BY c.embedding <=> $1::vector
      LIMIT $4
    ),
    fts AS (
      SELECT c.id, row_number() OVER (ORDER BY ts_rank_cd(c.tsv, q.tsq) DESC) AS rank
      FROM ${chunks} c
      JOIN ${docs} d ON d.id = c.document_id
      CROSS JOIN (SELECT websearch_to_tsquery('${ftsConfig}', $2) AS tsq) q
      WHERE c.tsv @@ q.tsq
        AND ($3::text IS NULL OR d.topic = $3)${visClause}
      ORDER BY ts_rank_cd(c.tsv, q.tsq) DESC
      LIMIT $4
    ),
    fused AS (
      SELECT
        COALESCE(vec.id, fts.id) AS id,
        vec.rank AS vec_rank,
        fts.rank AS fts_rank,
        COALESCE(1.0 / (${rrfK} + vec.rank), 0) + COALESCE(1.0 / (${rrfK} + fts.rank), 0) AS rrf
      FROM vec
      FULL OUTER JOIN fts ON vec.id = fts.id
    )
    SELECT
      c.id AS chunk_id,
      c.document_id,
      c.content,
      c.heading,
      d.title,
      d.url,
      d.topic,
      d.source,
      fused.vec_rank,
      fused.fts_rank,
      fused.rrf
    FROM fused
    JOIN ${chunks} c ON c.id = fused.id
    JOIN ${docs} d ON d.id = c.document_id
    ORDER BY fused.rrf DESC
    LIMIT $4
  `;

  return { text, params };
}

/** Map a raw result row into a RetrievedChunk. */
export function mapHybridRow(row: Record<string, unknown>): RetrievedChunk {
  return {
    chunkId: Number(row.chunk_id),
    documentId: Number(row.document_id),
    content: String(row.content),
    heading: row.heading == null ? null : String(row.heading),
    title: String(row.title),
    source: String(row.source ?? row.title),
    url: row.url == null ? null : String(row.url),
    topic: row.topic == null ? null : String(row.topic),
    rrfScore: Number(row.rrf),
    vecRank: row.vec_rank == null ? null : Number(row.vec_rank),
    ftsRank: row.fts_rank == null ? null : Number(row.fts_rank),
  };
}

/** Minimal pg-like client (node-postgres `Pool`/`Client` satisfy this). */
export interface PgLikeClient {
  query(text: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface PgRetrieverOptions {
  visibilities?: string[];
  chunkTable?: string;
  documentTable?: string;
  ftsConfig?: string;
  rrfK?: number;
}

/**
 * A Retriever backed by a node-postgres-compatible client. The default options
 * are merged with the per-call `RetrieverOptions` (topK, topic).
 */
export function createPgRetriever(client: PgLikeClient, defaults: PgRetrieverOptions = {}): Retriever {
  return {
    async search(query, embedding, options) {
      const { text, params } = buildHybridSearchQuery(query, embedding, { ...defaults, ...options });
      const result = await client.query(text, params);
      return result.rows.map(mapHybridRow);
    },
  };
}
