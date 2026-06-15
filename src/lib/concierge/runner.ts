/**
 * Concierge runner: assembles the Claude (answer) + self-hosted TEI (embeddings)
 * + pgvector providers and runs the local agent pipeline (classify → retrieve →
 * rerank → answer → grounding → escalation). Pure with respect to the app DB —
 * the caller loads history and persists the resulting BOT message.
 *
 * Reranking is disabled (the corpus is small; hybrid vector+FTS+RRF is enough),
 * so no external rerank service is needed — everything runs on Railway.
 */
import { buildConfigSnapshot, createConciergeExecutor, type HistoryEntry, type Reranker } from "@/lib/agent";
import { AnthropicAdapter } from "@/lib/agent/adapters/anthropic";
import { TeiEmbedder } from "@/lib/agent/adapters/tei";
import { env } from "@/lib/env";
import { getKbRetriever } from "@/lib/concierge/kb";
import { CONCIERGE_ANSWER_SYSTEM, CONCIERGE_CANNED, CONCIERGE_CLASSIFIER } from "@/lib/concierge/persona";

/** No external reranker — the rerank node keeps RRF order when unavailable. */
const noopReranker: Reranker = { available: false, async rerank() { return []; } };

/** The concierge is inert until Claude, the embeddings service, and the KB are configured. */
export function conciergeConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY && env.EMBEDDINGS_URL && env.KB_DATABASE_URL);
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
    throw new Error("Concierge is not configured (ANTHROPIC_API_KEY / EMBEDDINGS_URL / KB_DATABASE_URL).");
  }

  const llm = new AnthropicAdapter({ apiKey: env.ANTHROPIC_API_KEY, healthModel: env.CONCIERGE_MODEL });
  const embeddings = new TeiEmbedder({ baseUrl: env.EMBEDDINGS_URL! });
  const reranker = noopReranker;
  const retriever = getKbRetriever();

  const executor = createConciergeExecutor(
    { llm, embeddings, reranker, retriever },
    { logger: { error: (message) => console.error("[concierge]", message) } },
  );

  const config = buildConfigSnapshot({
    pipeline: {
      chatModel: env.CONCIERGE_MODEL,
      rerankMode: "none",
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
