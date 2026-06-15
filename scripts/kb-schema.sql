-- Knowledge-base schema for the AI concierge.
--
-- Runs against the DEDICATED pgvector Postgres (KB_DATABASE_URL), NOT the shared
-- Prisma app database. Apply once before the first ingestion:
--
--   psql "$KB_DATABASE_URL" -f scripts/kb-schema.sql
--
-- Idempotent: safe to re-run.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS kb_documents (
  id           SERIAL PRIMARY KEY,
  slug         TEXT NOT NULL,
  title        TEXT NOT NULL,
  url          TEXT,
  topic        TEXT,
  source       TEXT NOT NULL DEFAULT 'vault',
  -- Disclosure tier; only 'public' and 'gated' are ever ingested.
  visibility   TEXT NOT NULL DEFAULT 'public',
  content_hash TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, slug)
);

CREATE TABLE IF NOT EXISTS kb_chunks (
  id          SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  heading     TEXT,
  -- TEI BAAI/bge-base-en-v1.5 at 768 dims (self-hosted on Railway).
  embedding   vector(768),
  -- Generated lexical column for the full-text half of hybrid search.
  tsv         tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(heading, '') || ' ' || content)
  ) STORED
);

CREATE INDEX IF NOT EXISTS kb_chunks_embedding_idx
  ON kb_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS kb_chunks_tsv_idx
  ON kb_chunks USING gin (tsv);
CREATE INDEX IF NOT EXISTS kb_chunks_document_idx
  ON kb_chunks (document_id);
