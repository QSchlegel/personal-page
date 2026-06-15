/**
 * Ingest the vault into the concierge knowledge base.
 *
 * Reads content/vault/*.md, keeps ONLY public + gated notes (private/CV never
 * leave disk), chunks them, embeds with Voyage, and upserts into the dedicated
 * pgvector DB. Hash-based incremental: unchanged documents are skipped.
 *
 *   npx tsx scripts/ingest-vault.ts
 *
 * Requires: VOYAGE_API_KEY, KB_DATABASE_URL, and the schema applied
 * (scripts/kb-schema.sql).
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { slug as slugify } from "github-slugger";
import matter from "gray-matter";
import { Pool } from "pg";

import { VoyageAdapter } from "../src/lib/agent/adapters/voyage";

const VAULT_DIR = path.join(process.cwd(), "content", "vault");
const SOURCE = "vault";
const MAX_CHUNK_CHARS = 1500;

interface CorpusNote {
  slug: string;
  title: string;
  url: string;
  topic: string | null;
  visibility: "public" | "gated";
  content: string;
}

interface Chunk {
  heading: string | null;
  content: string;
}

function readCorpus(): CorpusNote[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(VAULT_DIR).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const notes: CorpusNote[] = [];
  for (const file of files) {
    const { data, content } = matter(fs.readFileSync(path.join(VAULT_DIR, file), "utf8"));
    const visibility = data.visibility as string | undefined;
    if (visibility !== "public" && visibility !== "gated") continue; // private/CV excluded
    const type = (data.type as string) ?? "note";
    const slug = (data.slug as string) ?? slugify(path.basename(file, path.extname(file)));
    const tags = Array.isArray(data.tags) ? (data.tags as string[]) : [];
    notes.push({
      slug,
      title: String(data.title ?? slug),
      url: type === "6-pager" ? `/blog/${slug}` : `/vault/${slug}`,
      topic: tags[0] ?? null,
      visibility,
      content,
    });
  }
  return notes;
}

/** Heading-aware chunker: groups paragraphs under their nearest heading, ~1500 chars. */
function chunkMarkdown(md: string): Chunk[] {
  const blocks = md.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
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

function hashOf(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function main(): Promise<void> {
  const apiKey = process.env.VOYAGE_API_KEY;
  const dbUrl = process.env.KB_DATABASE_URL;
  if (!apiKey || !dbUrl) {
    throw new Error("Set VOYAGE_API_KEY and KB_DATABASE_URL before running ingestion.");
  }

  const embedder = new VoyageAdapter({ apiKey, inputType: "document", dimension: 1024 });
  const pool = new Pool({ connectionString: dbUrl, max: 4 });
  const notes = readCorpus();
  console.log(`[ingest] ${notes.length} public/gated notes found.`);

  let embedded = 0;
  let skipped = 0;
  for (const note of notes) {
    const hash = hashOf(note.content);
    const existing = await pool.query<{ id: number; content_hash: string }>(
      "SELECT id, content_hash FROM kb_documents WHERE source = $1 AND slug = $2",
      [SOURCE, note.slug],
    );
    if (existing.rows[0]?.content_hash === hash) {
      skipped += 1;
      continue;
    }

    const upserted = await pool.query<{ id: number }>(
      `INSERT INTO kb_documents (slug, title, url, topic, source, visibility, content_hash, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (source, slug) DO UPDATE
         SET title = EXCLUDED.title, url = EXCLUDED.url, topic = EXCLUDED.topic,
             visibility = EXCLUDED.visibility, content_hash = EXCLUDED.content_hash, updated_at = now()
       RETURNING id`,
      [note.slug, note.title, note.url, note.topic, SOURCE, note.visibility, hash],
    );
    const documentId = upserted.rows[0]!.id;

    await pool.query("DELETE FROM kb_chunks WHERE document_id = $1", [documentId]);

    const chunks = chunkMarkdown(note.content);
    if (chunks.length === 0) continue;
    const vectors = await embedder.embed(chunks.map((c) => `${c.heading ? c.heading + "\n" : ""}${c.content}`));

    for (let i = 0; i < chunks.length; i += 1) {
      await pool.query(
        "INSERT INTO kb_chunks (document_id, content, heading, embedding) VALUES ($1, $2, $3, $4::vector)",
        [documentId, chunks[i]!.content, chunks[i]!.heading, `[${vectors[i]!.join(",")}]`],
      );
    }
    embedded += 1;
    console.log(`[ingest] ${note.slug}: ${chunks.length} chunks (${note.visibility}).`);
  }

  await pool.end();
  console.log(`[ingest] done. ${embedded} embedded, ${skipped} unchanged.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
