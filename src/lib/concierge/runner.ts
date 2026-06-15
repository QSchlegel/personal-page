/**
 * Concierge runner: assembles the Claude + Voyage + pgvector providers and runs
 * the local agent pipeline (classify → retrieve → rerank → answer →
 * grounding → escalation). Pure with respect to the app DB — the caller loads
 * history and persists the resulting BOT message.
 */
import { buildConfigSnapshot, createConciergeExecutor, type HistoryEntry } from "@/lib/agent";
import { AnthropicAdapter } from "@/lib/agent/adapters/anthropic";
import { VoyageAdapter } from "@/lib/agent/adapters/voyage";
import { env } from "@/lib/env";
import { getKbRetriever } from "@/lib/concierge/kb";
import { CONCIERGE_ANSWER_SYSTEM, CONCIERGE_CANNED, CONCIERGE_CLASSIFIER } from "@/lib/concierge/persona";

/** The concierge is inert until Claude + Voyage + the KB datastore are configured. */
export function conciergeConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY && env.VOYAGE_API_KEY && env.KB_DATABASE_URL);
}

export interface ConciergeReply {
  answer: string;
  escalated: boolean;
  traceId: string;
}

export async function generateConciergeReply(input: {
  conversationId: string;
  question: string;
  history: HistoryEntry[];
  userRef?: string;
  signal?: AbortSignal;
}): Promise<ConciergeReply> {
  if (!conciergeConfigured()) {
    throw new Error("Concierge is not configured (ANTHROPIC_API_KEY / VOYAGE_API_KEY / KB_DATABASE_URL).");
  }

  const llm = new AnthropicAdapter({ apiKey: env.ANTHROPIC_API_KEY, healthModel: env.CONCIERGE_MODEL });
  // Voyage input_type 'query' for the retrieval embedding; the reranker shares the client.
  const embeddings = new VoyageAdapter({ apiKey: env.VOYAGE_API_KEY, inputType: "query" });
  const reranker = new VoyageAdapter({ apiKey: env.VOYAGE_API_KEY });
  const retriever = getKbRetriever();

  const executor = createConciergeExecutor(
    { llm, embeddings, reranker, retriever },
    { logger: { error: (message) => console.error("[concierge]", message) } },
  );

  const config = buildConfigSnapshot({
    pipeline: {
      chatModel: env.CONCIERGE_MODEL,
      rerankMode: env.CONCIERGE_RERANK_ENABLED ? "reranker" : "none",
    },
    prompts: {
      classifier: { version: 1, content: CONCIERGE_CLASSIFIER },
      answer_system: { version: 1, content: CONCIERGE_ANSWER_SYSTEM },
    },
    cannedResponses: CONCIERGE_CANNED,
  });

  const result = await executor.execute({
    channel: "chat",
    conversationId: input.conversationId,
    question: input.question,
    history: input.history,
    userRef: input.userRef,
    config,
    signal: input.signal,
  });

  return {
    answer: result.state.finalAnswer ?? CONCIERGE_CANNED.escalation,
    escalated: Boolean(result.state.escalation),
    traceId: result.traceId,
  };
}
