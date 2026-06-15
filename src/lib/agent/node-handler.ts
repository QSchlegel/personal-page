/**
 * Node handler contract. Each pipeline node implements this; the executor
 * dispatches by `nodeId`, emits spans around `run`, and merges the returned
 * patch into the state.
 */
import type { NodeBadges } from './providers';
import type { ConfigSnapshot, PipelineNodeId, PipelineState, StatePatch, TraceChannel } from './types';

export interface AnswerStreamHooks {
  onToken?: (text: string) => void;
  onQueuePosition?: (position: number) => void;
}

export interface NodeRunContext {
  traceId: string;
  channel: TraceChannel;
  config: ConfigSnapshot;
  signal?: AbortSignal;
  /** Do not actually fire escalation sinks (eval / re-run). */
  dryRunSinks: boolean;
  /** Live badges for the trace view (span.patch). */
  badges: (badges: Partial<NodeBadges>) => void;
  /** Report token usage for this node (lands in the span). */
  usage: (tokensIn: number, tokensOut: number) => void;
  stream?: AnswerStreamHooks;
}

export interface NodeResult {
  patch: StatePatch;
  /** Compact output payload for the span. */
  output: Record<string, unknown>;
}

export interface PipelineNodeHandler {
  readonly nodeId: PipelineNodeId;
  /** Compact input payload for the span. */
  describeInput(state: PipelineState): Record<string, unknown>;
  run(state: PipelineState, ctx: NodeRunContext): Promise<NodeResult>;
}
