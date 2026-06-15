import type { EscalationSink, Platform } from '../providers';
import type { NodeResult, NodeRunContext, PipelineNodeHandler } from '../node-handler';
import type { PipelineState } from '../types';

const REASON_LABELS: Record<string, string> = {
  risk_is_sensitive: 'Sensitive question routed to a human',
  no_evidence: 'No sufficient evidence in the knowledge base',
  tool_escalate: 'Assistant handed off (tool call)',
  grounding_failed: 'Answer discarded by the grounding check',
  manual: 'Manual handoff',
};

/**
 * Step 8 — Escalation: LLM-free handoff. Builds a summary + transcript, hands
 * them to the (optional) escalation sink, and returns a canned reply. Works
 * even when inference is down (lossless transcript).
 */
export class EscalationNode implements PipelineNodeHandler {
  readonly nodeId = 'escalation' as const;

  constructor(
    private readonly platform: Platform,
    private readonly sink?: EscalationSink,
  ) {}

  describeInput(state: PipelineState): Record<string, unknown> {
    return {
      reason: state.lastEdgeCondition ?? 'manual',
      toolEscalateReason: state.toolEscalateReason ?? null,
    };
  }

  async run(state: PipelineState, ctx: NodeRunContext): Promise<NodeResult> {
    const reasonKey = state.lastEdgeCondition ?? 'manual';
    const reason = REASON_LABELS[reasonKey] ?? reasonKey;
    const summary = this.buildSummary(state, reason);

    let caseNumber: string;
    if (this.sink) {
      ({ caseNumber } = await this.sink.escalate(
        {
          conversationId: state.conversationId,
          userRef: state.userRef,
          reason,
          summary,
          transcript: this.buildTranscript(state),
          classification: state.classification
            ? {
                intent: state.classification.intent,
                risk: state.classification.risk,
                topic: state.classification.topic,
              }
            : undefined,
        },
        { dryRun: ctx.dryRunSinks },
      ));
    } else {
      caseNumber = this.platform.randomId();
    }

    ctx.badges({ caseNumber });

    const base = ctx.config.cannedResponses.escalation;
    const finalAnswer = base.includes('{caseNumber}')
      ? base.replace('{caseNumber}', caseNumber)
      : base;

    return {
      patch: { escalation: { caseNumber, reason }, finalAnswer, terminate: true },
      output: { caseNumber, reason, summary },
    };
  }

  private buildSummary(state: PipelineState, reason: string): string {
    const lines = [
      `Question: ${state.question}`,
      `Intent: ${state.classification?.intent ?? 'unknown'} | Risk: ${state.classification?.risk ?? 'unknown'} | Topic: ${state.classification?.topic ?? '–'}`,
      `Escalation reason: ${reason}`,
    ];
    if (state.toolEscalateReason) lines.push(`Assistant's reasoning: ${state.toolEscalateReason}`);
    if (state.grounding && !state.grounding.grounded) {
      lines.push(`Grounding verdict: ${state.grounding.reasoning}`);
    }
    return lines.join('\n');
  }

  private buildTranscript(state: PipelineState): string {
    const lines = state.history.map(
      (entry) => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.content}`,
    );
    lines.push(`User: ${state.question}`);
    if (state.draftAnswer) lines.push(`[Discarded draft answer]: ${state.draftAnswer}`);
    return lines.join('\n\n');
  }
}
