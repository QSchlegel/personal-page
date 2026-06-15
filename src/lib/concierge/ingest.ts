/**
 * Server-side knowledge-base setup + ingestion. Runs inside Railway so it can
 * reach the private pgvector DB and the private TEI embeddings service — no
 * public exposure of either. Invoked by the admin route POST /api/admin/kb/ingest.
 *
 * Mirrors scripts/kb-schema.sql (kept in sync) so the schema is applied
 * idempotently before ingest, and seeds the concierge bot identity.
 */
import { createHash, randomUUID } from "node:crypto";

import type { Pool } from "pg";

import type { EmbeddingProvider } from "@/lib/agent";
import { getCorpusNotes } from "@/lib/content/vault";
import { prisma } from "@/lib/prisma";

const SOURCE = "vault";
const MAX_CHUNK_CHARS = 1500;

/** Idempotent schema — must match scripts/kb-schema.sql (bge-base-en-v1.5 = 768d). */
const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS kb_documents (
  id           SERIAL PRIMARY KEY,
  slug         TEXT NOT NULL,
  title        TEXT NOT NULL,
  url          TEXT,
  topic        TEXT,
  source       TEXT NOT NULL DEFAULT 'vault',
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
  embedding   vector(768),
  tsv         tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(heading, '') || ' ' || content)
  ) STORED
);

CREATE INDEX IF NOT EXISTS kb_chunks_embedding_idx ON kb_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS kb_chunks_tsv_idx ON kb_chunks USING gin (tsv);
CREATE INDEX IF NOT EXISTS kb_chunks_document_idx ON kb_chunks (document_id);
`;

export async function applyKbSchema(pool: Pool): Promise<void> {
  await pool.query(SCHEMA_SQL);
}

/** Create/refresh the concierge User + BotIdentity in the app DB (Prisma). */
export async function ensureConciergeBot(): Promise<{ userId: string; email: string; botIdentityId: string }> {
  const email = (process.env.NEXT_PUBLIC_SECURE_CHAT_QSBOT_EMAIL ?? "concierge@quirinschlegel.com")
    .trim()
    .toLowerCase();
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: "AI Concierge", emailVerified: true },
    create: { id: randomUUID(), email, name: "AI Concierge", emailVerified: true },
    select: { id: true, email: true },
  });
  const bot = await prisma.botIdentity.upsert({
    where: { userId: user.id },
    update: { displayName: "AI Concierge", relayEnabled: true },
    create: { userId: user.id, displayName: "AI Concierge", relayEnabled: true },
    select: { id: true },
  });
  return { userId: user.id, email: user.email, botIdentityId: bot.id };
}

interface Chunk {
  heading: string | null;
  content: string;
}

/** Heading-aware chunker: groups paragraphs under their nearest heading, ~1500 chars. */
function chunkMarkdown(md: string): Chunk[] {
  const blocks = md
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const chunks: Chunk[] = [];
  let heading: string | null = null;
  let buffer: string[] = [];
  let size = 0;

  const flush = () => {
    if (buffer.length > 0) {
      chunks.push({ heading, content: buffer.join("\n\n") });
      buffer = [];
      size = 0;
    }
  };

  for (const block of blocks) {
    const headingMatch = block.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      flush();
      heading = headingMatch[1]!.trim();
      continue;
    }
    if (size + block.length > MAX_CHUNK_CHARS && buffer.length > 0) flush();
    buffer.push(block);
    size += block.length;
  }
  flush();
  return chunks;
}

export interface IngestResult {
  total: number;
  embedded: number;
  skipped: number;
}

/**
 * Embed public + gated vault notes into the KB. Hash-based incremental: a
 * document whose content is unchanged is skipped. Private notes / the CV are
 * never returned by getCorpusNotes(), so they never reach the embedder.
 */
export async function ingestCorpus(pool: Pool, embedder: EmbeddingProvider): Promise<IngestResult> {
  const notes = getCorpusNotes();
  let embedded = 0;
  let skipped = 0;

  for (const note of notes) {
    const hash = createHash("sha256").update(note.content).digest("hex");
    const existing = await pool.query<{ content_hash: string }>(
      "SELECT content_hash FROM kb_documents WHERE source = $1 AND slug = $2",
      [SOURCE, note.slug],
    );
    if (existing.rows[0]?.content_hash === hash) {
      skipped += 1;
      continue;
    }

    const topic = note.tags[0] ?? null;
    const upserted = await pool.query<{ id: number }>(
      `INSERT INTO kb_documents (slug, title, url, topic, source, visibility, content_hash, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (source, slug) DO UPDATE
         SET title = EXCLUDED.title, url = EXCLUDED.url, topic = EXCLUDED.topic,
             visibility = EXCLUDED.visibility, content_hash = EXCLUDED.content_hash, updated_at = now()
       RETURNING id`,
      [note.slug, note.title, note.url, topic, SOURCE, note.visibility, hash],
    );
    const documentId = upserted.rows[0]!.id;
    await pool.query("DELETE FROM kb_chunks WHERE document_id = $1", [documentId]);

    const chunks = chunkMarkdown(note.content);
    if (chunks.length === 0) continue;
    const vectors = await embedder.embed(
      chunks.map((c) => `${c.heading ? c.heading + "\n" : ""}${c.content}`),
    );
    for (let i = 0; i < chunks.length; i += 1) {
      await pool.query(
        "INSERT INTO kb_chunks (document_id, content, heading, embedding) VALUES ($1, $2, $3, $4::vector)",
        [documentId, chunks[i]!.content, chunks[i]!.heading, `[${vectors[i]!.join(",")}]`],
      );
    }
    embedded += 1;
  }

  return { total: notes.length, embedded, skipped };
}
