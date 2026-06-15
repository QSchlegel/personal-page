/**
 * Local, self-contained RAG agent pipeline. Vendored into this repo (rather
 * than shared as a package) so the personal site and the dw-ai-support project
 * stay fully detached — no cross-repo dependency.
 *
 * Adapters live in ./adapters/* and are imported directly where needed:
 *   import { AnthropicAdapter } from '@/lib/agent/adapters/anthropic'
 *   import { TeiEmbedder } from '@/lib/agent/adapters/tei'
 *   import { createPgRetriever } from '@/lib/agent/retrieval'
 */
export * from './types';
export * from './schemas';
export * from './providers';
export * from './node-handler';
export { CONDITIONS } from './conditions';
export { CONCIERGE_GRAPH } from './graph';
export { GraphExecutor, defaultPlatform } from './executor';
export type { ExecuteOptions, ExecutionResult, GraphExecutorDeps } from './executor';
export * from './factory';
export * from './defaults';

// Node handlers (for callers assembling a custom graph)
export { IntakeNode } from './nodes/intake.node';
export { ClassifyNode } from './nodes/classify.node';
export { QueryRewriteNode } from './nodes/query-rewrite.node';
export { RetrievalNode } from './nodes/retrieval.node';
export { RerankNode } from './nodes/rerank.node';
export { AnswerNode, ESCALATE_TOOL } from './nodes/answer.node';
export { GroundingNode } from './nodes/grounding.node';
export { EscalationNode } from './nodes/escalation.node';

// Retrieval helpers (SQL builder + pg-backed Retriever) — also at '@/lib/agent/retrieval'
export {
  buildHybridSearchQuery,
  mapHybridRow,
  createPgRetriever,
} from './retrieval';
export type { HybridSearchSqlOptions, PgLikeClient, PgRetrieverOptions } from './retrieval';
