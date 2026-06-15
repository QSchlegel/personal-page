/**
 * Knowledge-base datastore for the concierge: a dedicated pgvector Postgres
 * (KB_DATABASE_URL), separate from the shared Prisma app DB so embeddings never
 * touch the drift-prone primary instance. Exposes a node-postgres Pool plus a
 * local agent-module Retriever restricted to public + gated documents.
 */
import { Pool } from "pg";

import { createPgRetriever, type PgLikeClient } from "@/lib/agent/retrieval";
import type { Retriever } from "@/lib/agent";

import { env } from "@/lib/env";

let pool: Pool | null = null;

export function getKbPool(): Pool {
  if (!env.KB_DATABASE_URL) {
    throw new Error("KB_DATABASE_URL is not configured — the concierge knowledge base is unavailable.");
  }
  if (!pool) {
    pool = new Pool({ connectionString: env.KB_DATABASE_URL, max: 4 });
  }
  return pool;
}

/** Minimal pg-like client wrapper that satisfies the agent module's PgLikeClient. */
export function getKbClient(): PgLikeClient {
  const p = getKbPool();
  return {
    query: (text, params) => p.query(text, params as unknown[]),
  };
}

/**
 * Retriever scoped to the disclosable corpus: only public + gated chunks are
 * ever returned, mirroring the ingestion guarantee. English FTS config matches
 * the generated tsvector column.
 */
export function getKbRetriever(): Retriever {
  return createPgRetriever(getKbClient(), {
    visibilities: ["public", "gated"],
    ftsConfig: "english",
  });
}
