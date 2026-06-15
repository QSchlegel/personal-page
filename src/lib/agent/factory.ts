/**
 * Convenience assembly of the concierge pipeline. Callers provide the injected
 * providers; this wires the node handlers and the executor.
 */
import { GraphExecutor, defaultPlatform } from './executor';
import type { GraphExecutorDeps } from './executor';
import type {
  EmbeddingProvider,
  EscalationSink,
  LlmProvider,
  Platform,
  Reranker,
  Retriever,
  TraceSink,
} from './providers';
import type { PipelineGraphDef } from './types';
import type { PipelineNodeHandler } from './node-handler';
import { IntakeNode } from './nodes/intake.node';
import { ClassifyNode } from './nodes/classify.node';
import { QueryRewriteNode } from './nodes/query-rewrite.node';
import { RetrievalNode } from './nodes/retrieval.node';
import { RerankNode } from './nodes/rerank.node';
import { AnswerNode } from './nodes/answer.node';
import { GroundingNode } from './nodes/grounding.node';
import { EscalationNode } from './nodes/escalation.node';

export interface ConciergeProviders {
  llm: LlmProvider;
  embeddings: EmbeddingProvider;
  reranker: Reranker;
  retriever: Retriever;
  escalationSink?: EscalationSink;
  platform?: Platform;
}

export function createConciergeHandlers(deps: ConciergeProviders): PipelineNodeHandler[] {
  const platform = deps.platform ?? defaultPlatform();
  return [
    new IntakeNode(),
    new ClassifyNode(deps.llm),
    new QueryRewriteNode(deps.llm),
    new RetrievalNode(deps.embeddings, deps.retriever),
    new RerankNode(deps.reranker),
    new AnswerNode(deps.llm),
    new GroundingNode(deps.llm),
    new EscalationNode(platform, deps.escalationSink),
  ];
}

export interface ConciergeExecutorOptions {
  trace?: TraceSink;
  logger?: { error: (message: string) => void };
  graph?: PipelineGraphDef;
}

export function createConciergeExecutor(
  deps: ConciergeProviders,
  opts: ConciergeExecutorOptions = {},
): GraphExecutor {
  const platform = deps.platform ?? defaultPlatform();
  const handlers = createConciergeHandlers({ ...deps, platform });
  const executorDeps: GraphExecutorDeps = { handlers, platform, ...opts };
  return new GraphExecutor(executorDeps);
}
