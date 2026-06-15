import { requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { env } from "@/lib/env";
import { TeiEmbedder } from "@/lib/agent/adapters/tei";
import { getKbPool } from "@/lib/concierge/kb";
import { applyKbSchema, ensureConciergeBot, ingestCorpus } from "@/lib/concierge/ingest";

// Runs server-side on Railway so it can reach the private KB + TEI services.
// Embedding the whole corpus can take a while; allow generous time.
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Admin-only one-shot: apply the KB schema, ensure the concierge bot identity,
 * and (re-)embed the public/gated vault into the knowledge base. Idempotent —
 * unchanged documents are skipped.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return admin.response;
  }

  if (!env.EMBEDDINGS_URL || !env.KB_DATABASE_URL) {
    return jsonError(
      "NOT_CONFIGURED",
      "Set EMBEDDINGS_URL and KB_DATABASE_URL before ingesting.",
      400,
    );
  }

  try {
    const pool = getKbPool();
    await applyKbSchema(pool);
    const bot = await ensureConciergeBot();
    const embedder = new TeiEmbedder({ baseUrl: env.EMBEDDINGS_URL });
    const result = await ingestCorpus(pool, embedder);
    return jsonOk({ bot, ...result });
  } catch (error) {
    return jsonError(
      "INGEST_FAILED",
      error instanceof Error ? error.message : "Knowledge-base ingestion failed.",
      500,
    );
  }
}
