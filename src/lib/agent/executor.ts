/**
 * Runs the RAG concierge graph. Deliberately small — no workflow framework.
 * The executor (not the handlers) emits every span event: observability is
 * structural, not a matter of discipline.
 *
 * Ported from dw-ai-support's GraphExecutor with the NestJS coupling removed:
 * EventEmitter2 → injected TraceSink, node:crypto/Date.now → injected Platform,
 * @nestjs Logger → an optional logger callback.
 */
import { randomUUID } from 'node:crypto';
import { CONDITIONS } from './conditions';
import type { NodeBadges, Platform, SpanEvent, TraceSink } from './providers';
import type { AnswerStreamHooks, PipelineNodeHandler } from './node-handler';
import { CONCIERGE_GRAPH } from './graph';
import type {
  ConfigSnapshot,
  HistoryEntry,
  PipelineGraphDef,
  PipelineGraphEdge,
  PipelineNodeId,
  PipelineState,
  TraceChannel,
} from './types';

export interface ExecuteOptions {
  traceId?: string;
  channel: TraceChannel;
  conversationId: string;
  question: string;
  history: HistoryEntry[];
  pageContext?: { pageUrl?: string; hint?: string };
  userRef?: string;
  config: ConfigSnapshot;
  signal?: AbortSignal;
  stream?: AnswerStreamHooks;
  rerunOf?: string;
  dryRunSinks?: boolean;
}

export interface ExecutionResult {
  traceId: string;
  state: PipelineState;
  status: 'ok' | 'error';
  error?: string;
  /** Sum over all nodes — for session token budgets. */
  usage: { tokensIn: number; tokensOut: number };
}

export interface GraphExecutorDeps {
  handlers: PipelineNodeHandler[];
  platform: Platform;
  /** Receives every span event; persist, stream to a UI, or ignore. */
  trace?: TraceSink;
  /** Optional structured logger for node failures. */
  logger?: { error: (message: string) => void };
  /** Defaults to CONCIERGE_GRAPH. */
  graph?: PipelineGraphDef;
}

export class GraphExecutor {
  private readonly handlers: Map<PipelineNodeId, PipelineNodeHandler>;
  private readonly platform: Platform;
  private readonly trace?: TraceSink;
  private readonly logger?: { error: (message: string) => void };
  private readonly graph: PipelineGraphDef;

  constructor(deps: GraphExecutorDeps) {
    this.handlers = new Map(deps.handlers.map((handler) => [handler.nodeId, handler]));
    this.platform = deps.platform;
    this.trace = deps.trace;
    this.logger = deps.logger;
    this.graph = deps.graph ?? CONCIERGE_GRAPH;
  }

  async execute(options: ExecuteOptions): Promise<ExecutionResult> {
    const graph = this.graph;
    const traceId = options.traceId ?? this.platform.randomId();
    let spanCounter = 0;
    const emit = (event: SpanEvent): void => this.trace?.(event);

    let state: PipelineState = {
      question: options.question,
      history: options.history,
      pageContext: options.pageContext,
      channel: options.channel,
      conversationId: options.conversationId,
      userRef: options.userRef,
    };

    emit({
      type: 'trace.start',
      traceId,
      conversationId: options.conversationId,
      channel: options.channel,
      graphVersion: graph.graphVersion,
      ts: this.platform.now(),
      config: options.config,
      initialInput: {
        question: options.question,
        history: options.history,
        pageContext: options.pageContext ?? null,
        userRef: options.userRef ?? null,
        rerunOf: options.rerunOf ?? null,
      },
    });

    const takenEdgeIds: string[] = [];
    const visited = new Set<PipelineNodeId>();
    let current: PipelineNodeId | null = graph.entry;
    let failure: string | undefined;
    const totalUsage = { tokensIn: 0, tokensOut: 0 };

    while (current) {
      const nodeId: PipelineNodeId = current;
      const handler = this.handlers.get(nodeId);
      if (!handler) throw new Error(`No handler registered for pipeline node "${nodeId}"`);

      const spanId = `${nodeId}-${++spanCounter}`;
      const tStart = this.platform.now();
      let tokensIn = 0;
      let tokensOut = 0;

      emit({
        type: 'span.start',
        traceId,
        spanId,
        nodeId,
        ts: tStart,
        input: handler.describeInput(state),
      });

      try {
        const result = await handler.run(state, {
          traceId,
          channel: options.channel,
          config: options.config,
          signal: options.signal,
          dryRunSinks: options.dryRunSinks ?? false,
          badges: (badges: Partial<NodeBadges>) => {
            emit({ type: 'span.patch', traceId, spanId, nodeId, badges, ts: this.platform.now() });
          },
          usage: (input, output) => {
            tokensIn += input;
            tokensOut += output;
            totalUsage.tokensIn += input;
            totalUsage.tokensOut += output;
          },
          stream: options.stream,
        });

        state = { ...state, ...result.patch };
        const tEnd = this.platform.now();
        emit({
          type: 'span.end',
          traceId,
          spanId,
          nodeId,
          status: 'ok',
          latencyMs: tEnd - tStart,
          ts: tEnd,
          input: handler.describeInput(state),
          output: result.output,
          tokensIn: tokensIn || undefined,
          tokensOut: tokensOut || undefined,
        });
      } catch (error) {
        const cancelled = options.signal?.aborted === true;
        const tEnd = this.platform.now();
        emit({
          type: 'span.end',
          traceId,
          spanId,
          nodeId,
          status: cancelled ? 'cancelled' : 'error',
          latencyMs: tEnd - tStart,
          ts: tEnd,
          output: { error: String(error) },
        });
        failure = String(error);
        this.logger?.error(`Pipeline node ${nodeId} failed: ${error}`);
        visited.add(nodeId);
        break;
      }

      visited.add(nodeId);
      if (state.terminate) break;

      const edge = this.pickEdge(graph.edges, nodeId, state);
      if (!edge) break;
      takenEdgeIds.push(edge.id);
      state.lastEdgeCondition = edge.condition;
      current = edge.target;
    }

    // Mark unvisited nodes as "skipped" so a trace view can render not-taken paths.
    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        const ts = this.platform.now();
        emit({ type: 'span.end', traceId, spanId: `skip-${node.id}`, nodeId: node.id, status: 'skipped', latencyMs: 0, ts });
      }
    }

    const status: 'ok' | 'error' = failure ? 'error' : 'ok';
    emit({ type: 'trace.end', traceId, status, takenEdgeIds, ts: this.platform.now() });

    return { traceId, state, status, error: failure, usage: totalUsage };
  }

  /** Conditional edges first (in graph order), then the default edge. */
  private pickEdge(
    edges: PipelineGraphEdge[],
    from: PipelineNodeId,
    state: PipelineState,
  ): PipelineGraphEdge | null {
    const outgoing = edges.filter((edge) => edge.source === from);
    for (const edge of outgoing) {
      if (edge.condition !== 'default' && CONDITIONS[edge.condition](state)) return edge;
    }
    return outgoing.find((edge) => edge.condition === 'default') ?? null;
  }
}

/** Default platform backed by node:crypto + Date.now. */
export function defaultPlatform(): Platform {
  return {
    randomId: () => randomUUID(),
    now: () => Date.now(),
  };
}
