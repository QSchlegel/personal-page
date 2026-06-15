/**
 * Core domain types for the RAG agent pipeline. Deliberately free of any
 * framework, ORM, or LLM-provider dependency — callers inject those via the
 * interfaces in `providers.ts`.
 *
 * Generalized from the original dw-ai-support pipeline: single-agent, locale-
 * neutral, with `source`/`topic` in place of the German `quelle`/`modul`.
 */

import type { ClassificationOutput, GroundingVerdict } from './schemas';

/** Where a run originated — used for trace tagging only. */
export type TraceChannel = 'chat' | 'cli' | 'eval' | 'rerun';

/** A resolved citation pointing back to a retrieved source chunk. */
export interface Citation {
  /** 1-based marker as it appears in the answer text: `[Source n]`. */
  n: number;
  title: string;
  source: string;
  url: string | null;
  chunkId: number | string;
}

/** A single retrieved chunk from the hybrid search. */
export interface RetrievedChunk {
  chunkId: number | string;
  documentId: number | string;
  content: string;
  heading: string | null;
  title: string;
  /** Human-readable name of the source document/collection. */
  source: string;
  url: string | null;
  /** Optional metadata facet used for filtered retrieval (e.g. a tag/topic). */
  topic: string | null;
  /** Reciprocal-rank-fusion score from hybrid search. */
  rrfScore: number;
  vecRank: number | null;
  ftsRank: number | null;
  /** Cross-encoder / reranker score (set after the rerank node). */
  rerankScore?: number;
}

export interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * The evolving state of one pipeline run. Each node reads defined fields and
 * returns a patch; the executor merges patches sequentially.
 */
export interface PipelineState {
  question: string;
  history: HistoryEntry[];
  pageContext?: { pageUrl?: string; hint?: string };
  channel: TraceChannel;
  conversationId: string;
  /** Opaque caller reference (e.g. user id) carried into escalation payloads. */
  userRef?: string;

  classification?: ClassificationOutput;
  searchQuery?: string;
  candidates?: RetrievedChunk[];
  rankedChunks?: RetrievedChunk[];
  noEvidence?: boolean;
  draftAnswer?: string;
  citations?: Citation[];
  toolEscalate?: boolean;
  toolEscalateReason?: string;
  grounding?: GroundingVerdict;
  escalation?: { caseNumber: string; reason: string };

  /** Final, authoritative answer to the user. */
  finalAnswer?: string;
  /** End the pipeline after the current node (e.g. off-topic). */
  terminate?: boolean;
  /** Condition of the last edge taken — the reason for an escalation. */
  lastEdgeCondition?: ConditionName;
}

export type StatePatch = Partial<PipelineState>;

// ---------------------------------------------------------------------------
// Serialized graph definition
// ---------------------------------------------------------------------------

export type PipelineNodeId =
  | 'intake'
  | 'classify'
  | 'query_rewrite'
  | 'retrieval'
  | 'rerank'
  | 'answer'
  | 'grounding'
  | 'escalation';

/**
 * Named edge conditions. The executor evaluates them as pure predicates over
 * the pipeline state; edges without a condition are `default` (checked last).
 */
export type ConditionName =
  | 'risk_is_sensitive'
  | 'no_evidence'
  | 'tool_escalate'
  | 'grounding_failed'
  | 'default';

export interface PipelineGraphNode {
  id: PipelineNodeId;
  label: string;
  description: string;
}

export interface PipelineGraphEdge {
  id: string;
  source: PipelineNodeId;
  target: PipelineNodeId;
  condition: ConditionName;
  label?: string;
}

export interface PipelineGraphDef {
  id: string;
  graphVersion: string;
  entry: PipelineNodeId;
  nodes: PipelineGraphNode[];
  edges: PipelineGraphEdge[];
}

// ---------------------------------------------------------------------------
// Run configuration (the frozen snapshot threaded through every node)
// ---------------------------------------------------------------------------

export type PromptKey = 'classifier' | 'query_rewrite' | 'answer_system' | 'grounding_judge';

export interface PipelineConfig {
  /** Model id for chat/answer + structured classification/grounding. */
  chatModel: string;
  /** Effort for the streamed answer call (Anthropic `output_config.effort`). */
  answerEffort: 'low' | 'medium' | 'high' | 'max';
  /** Effort for the cheap structured calls (classify / rewrite / grounding). */
  classifyEffort: 'low' | 'medium' | 'high' | 'max';
  maxAnswerTokens: number;
  /** Fuse classification + query rewrite into one structured call. */
  fusedClassifyRewrite: boolean;
  retrievalTopK: number;
  rerankTopK: number;
  rerankMode: 'reranker' | 'none';
  /** Minimum reranker score; below it the "no evidence" path is taken. */
  rerankThreshold: number;
  /** Top score above which the answer node withholds the escalate tool. */
  strongEvidenceThreshold: number;
}

/**
 * Frozen configuration of a pipeline run: resolved at the start, unchanged for
 * the duration of the run, and safe to persist in a trace for replay.
 */
export interface ConfigSnapshot {
  graphVersion: string;
  pipeline: PipelineConfig;
  prompts: Record<PromptKey, { version: number; content: string }>;
  /** Locale-specific canned answers used by the classify/escalation nodes. */
  cannedResponses: {
    /** Returned when the question is off-topic; ends the run politely. */
    offTopic: string;
    /** Returned on any escalation; a `caseNumber` may be appended by the node. */
    escalation: string;
  };
}
