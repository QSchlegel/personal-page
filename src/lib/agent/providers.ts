/**
 * The injectable seams of the agent core. Callers implement these so the
 * pipeline stays framework-, ORM-, and provider-agnostic:
 *
 *  - LlmProvider       — chat / structured / streaming inference
 *  - EmbeddingProvider — text → vectors
 *  - Reranker          — cross-encoder / API reranking
 *  - Retriever         — hybrid search against the caller's datastore
 *  - TraceSink         — observability callback (replaces NestJS EventEmitter2)
 *  - Platform          — id + clock (replaces node:crypto / Date.now in the core)
 */
import type { ZodType } from 'zod';
import type {
  ConfigSnapshot,
  PipelineNodeId,
  RetrievedChunk,
  TraceChannel,
} from './types';

// ---------------------------------------------------------------------------
// Chat / LLM contract
// ---------------------------------------------------------------------------

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface CompletedToolCall {
  id: string;
  name: string;
  /** Raw JSON string of the arguments. */
  arguments: string;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Only for role 'tool': id of the tool call being answered. */
  toolCallId?: string;
  /** Only for role 'assistant': tool calls previously made. */
  toolCalls?: CompletedToolCall[];
}

export interface LlmToolDef {
  name: string;
  description: string;
  /** JSON Schema for the tool's input object. */
  parameters: Record<string, unknown>;
}

export type EffortLevel = 'low' | 'medium' | 'high' | 'max';

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  tools?: LlmToolDef[];
  /** Anthropic `output_config.effort`; ignored by providers that don't support it. */
  effort?: EffortLevel;
  /** Enable adaptive thinking (Anthropic). Off for cheap structured calls. */
  thinking?: boolean;
  /** OpenAI-compatible knobs; ignored by the Anthropic adapter. */
  temperature?: number;
  topP?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export type FinishReason = 'stop' | 'tool_calls' | 'length' | 'unknown';

export type ChatStreamChunk =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; call: CompletedToolCall }
  | { type: 'finish'; reason: FinishReason; usage?: TokenUsage };

export interface ChatCompletionResult {
  text: string;
  toolCalls: CompletedToolCall[];
  usage?: TokenUsage;
  finishReason: FinishReason;
}

export interface StructuredResult<T> {
  value: T;
  usage?: TokenUsage;
}

export interface LlmHealth {
  ok: boolean;
  models: string[];
  error?: string;
}

/** Swappable inference layer. Anthropic today, OpenAI-compatible tomorrow. */
export interface LlmProvider {
  chatStream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatStreamChunk>;
  chatCompletion(req: ChatRequest, signal?: AbortSignal): Promise<ChatCompletionResult>;
  chatStructured<T>(
    req: ChatRequest,
    schema: ZodType<T>,
    schemaName: string,
    signal?: AbortSignal,
  ): Promise<StructuredResult<T>>;
  health(): Promise<LlmHealth>;
}

/** Text → embedding vectors. Model selection is provider-internal. */
export interface EmbeddingProvider {
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>;
}

/** Cross-encoder / API reranker. Returns one score per document, aligned by index. */
export interface Reranker {
  /** Whether a reranker is configured/available; if false, the node keeps RRF order. */
  readonly available: boolean;
  rerank(query: string, documents: string[], signal?: AbortSignal): Promise<number[]>;
}

export interface RetrieverOptions {
  topK: number;
  /** Restrict to a metadata facet (maps to `topic` on chunks); omit for no filter. */
  topic?: string;
}

/** Hybrid (vector + full-text) search over the caller's datastore. */
export interface Retriever {
  search(query: string, embedding: number[], options: RetrieverOptions): Promise<RetrievedChunk[]>;
}

/** Optional handoff sink (queue, email, ticket). The core never sends email itself. */
export interface EscalationPayload {
  conversationId: string;
  userRef?: string;
  reason: string;
  summary: string;
  transcript: string;
  classification?: { intent: string; risk: string; topic: string | null };
}

export interface EscalationSink {
  escalate(payload: EscalationPayload, opts: { dryRun: boolean }): Promise<{ caseNumber: string }>;
}

// ---------------------------------------------------------------------------
// Platform + tracing
// ---------------------------------------------------------------------------

/** Injected id + clock so the core stays deterministic and testable. */
export interface Platform {
  randomId(): string;
  now(): number;
}

export interface NodeBadges {
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  tokensPerSec?: number;
  ttftMs?: number;
  hitCount?: number;
  topScore?: number;
  model?: string;
  classification?: { intent: string; risk: string; topic: string | null };
  caseNumber?: string;
}

export type SpanStatus = 'ok' | 'error' | 'skipped' | 'cancelled';

/** Structured span events emitted by the executor; persist, log, or ignore. */
export type SpanEvent =
  | {
      type: 'trace.start';
      traceId: string;
      conversationId: string;
      channel: TraceChannel;
      graphVersion: string;
      ts: number;
      config: ConfigSnapshot;
      initialInput: Record<string, unknown>;
    }
  | { type: 'span.start'; traceId: string; spanId: string; nodeId: PipelineNodeId; ts: number; input: Record<string, unknown> }
  | { type: 'span.patch'; traceId: string; spanId: string; nodeId: PipelineNodeId; badges: Partial<NodeBadges>; ts: number }
  | {
      type: 'span.end';
      traceId: string;
      spanId: string;
      nodeId: PipelineNodeId;
      status: SpanStatus;
      latencyMs: number;
      ts: number;
      input?: Record<string, unknown>;
      output?: Record<string, unknown>;
      tokensIn?: number;
      tokensOut?: number;
    }
  | { type: 'trace.end'; traceId: string; status: 'ok' | 'error'; takenEdgeIds: string[]; ts: number };

/** Observability callback — replaces the NestJS EventEmitter2 wiring. */
export type TraceSink = (event: SpanEvent) => void;
