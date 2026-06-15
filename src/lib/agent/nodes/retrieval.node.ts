import type { EmbeddingProvider, Retriever } from '../providers';
import type { NodeResult, NodeRunContext, PipelineNodeHandler } from '../node-handler';
import type { PipelineState } from '../types';

/**
 * Step 4 — Retrieval: hybrid vector + full-text search, top-K per reciprocal
 * rank fusion, optional topic filter with a fallback to no filter on zero hits.
 */
export class RetrievalNode implements PipelineNodeHandler {
  readonly nodeId = 'retrieval' as const;

  constructor(
    private readonly embeddings: EmbeddingProvider,
    private readonly retriever: Retriever,
  ) {}

  describeInput(state: PipelineState): Record<string, unknown> {
    return {
      searchQuery: state.searchQuery ?? state.question,
      topicFilter: state.classification?.topic ?? null,
    };
  }

  async run(state: PipelineState, ctx: NodeRunContext): Promise<NodeResult> {
    const query = state.searchQuery ?? state.question;
    const [embedding] = await this.embeddings.embed([query], ctx.signal);

    const topK = ctx.config.pipeline.retrievalTopK;
    const topic = state.classification?.topic ?? undefined;

    let candidates = await this.retriever.search(query, embedding!, { topK, topic });
    let topicFilterUsed: string | null = topic ?? null;
    if (candidates.length === 0 && topic) {
      candidates = await this.retriever.search(query, embedding!, { topK });
      topicFilterUsed = null;
    }

    ctx.badges({ hitCount: candidates.length });

    return {
      patch: { candidates },
      output: {
        query,
        topicFilterUsed,
        hitCount: candidates.length,
        chunks: candidates.map((chunk) => ({
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          title: chunk.title,
          heading: chunk.heading,
          source: chunk.source,
          rrfScore: chunk.rrfScore,
          vecRank: chunk.vecRank,
          ftsRank: chunk.ftsRank,
        })),
      },
    };
  }
}
