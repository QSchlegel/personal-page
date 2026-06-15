import type { Reranker } from '../providers';
import type { NodeResult, NodeRunContext, PipelineNodeHandler } from '../node-handler';
import type { PipelineState, RetrievedChunk } from '../types';

/**
 * Step 5 — Rerank & threshold: rerank to top-K; below the minimum score the
 * "no evidence" path is taken. Without an available reranker (mode 'none' or
 * provider unavailable), the RRF order is kept.
 */
export class RerankNode implements PipelineNodeHandler {
  readonly nodeId = 'rerank' as const;

  constructor(private readonly reranker: Reranker) {}

  describeInput(state: PipelineState): Record<string, unknown> {
    return { candidateCount: state.candidates?.length ?? 0 };
  }

  async run(state: PipelineState, ctx: NodeRunContext): Promise<NodeResult> {
    const candidates = state.candidates ?? [];
    const { rerankTopK, rerankThreshold, rerankMode } = ctx.config.pipeline;

    if (candidates.length === 0) {
      ctx.badges({ topScore: 0 });
      return {
        patch: { rankedChunks: [], noEvidence: true },
        output: { mode: rerankMode, topScore: 0, decision: 'no_candidates' },
      };
    }

    let ranked: RetrievedChunk[];
    let topScore: number;
    let thresholdApplied = false;
    let modeUsed: 'reranker' | 'none' = rerankMode;

    const query = state.searchQuery ?? state.question;
    const useReranker = rerankMode === 'reranker' && this.reranker.available;
    const scores = useReranker
      ? await this.reranker.rerank(query, candidates.map((chunk) => chunk.content), ctx.signal)
      : null;

    if (scores) {
      ranked = candidates
        .map((chunk, index) => ({ ...chunk, rerankScore: scores[index]! }))
        .sort((a, b) => b.rerankScore! - a.rerankScore!)
        .slice(0, rerankTopK);
      topScore = ranked[0]?.rerankScore ?? 0;
      thresholdApplied = true;
    } else {
      if (rerankMode === 'reranker') modeUsed = 'none';
      ranked = candidates.slice(0, rerankTopK);
      topScore = ranked[0]?.rrfScore ?? 0;
    }

    const noEvidence = thresholdApplied ? topScore < rerankThreshold : ranked.length === 0;
    ctx.badges({ topScore: Number(topScore.toFixed(4)) });

    return {
      patch: { rankedChunks: noEvidence ? [] : ranked, noEvidence },
      output: {
        mode: modeUsed,
        topScore,
        threshold: thresholdApplied ? rerankThreshold : null,
        decision: noEvidence ? 'no_evidence' : 'ok',
        ranked: ranked.map((chunk) => ({
          chunkId: chunk.chunkId,
          title: chunk.title,
          rerankScore: chunk.rerankScore ?? null,
          rrfScore: chunk.rrfScore,
        })),
      },
    };
  }
}
