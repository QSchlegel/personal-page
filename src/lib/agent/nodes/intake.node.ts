import type { NodeResult, NodeRunContext, PipelineNodeHandler } from '../node-handler';
import type { PipelineState } from '../types';

const MAX_HISTORY_TURNS = 10;
const MAX_QUESTION_LENGTH = 2000;

/** Step 1 — Intake: normalize the question, bound the history. */
export class IntakeNode implements PipelineNodeHandler {
  readonly nodeId = 'intake' as const;

  describeInput(state: PipelineState): Record<string, unknown> {
    return {
      question: state.question,
      historyLength: state.history.length,
      pageContext: state.pageContext ?? null,
      channel: state.channel,
    };
  }

  async run(state: PipelineState, _ctx: NodeRunContext): Promise<NodeResult> {
    const question = state.question.trim().slice(0, MAX_QUESTION_LENGTH);
    const history = state.history.slice(-MAX_HISTORY_TURNS);
    return {
      patch: { question, history },
      output: { question, historyLength: history.length },
    };
  }
}
