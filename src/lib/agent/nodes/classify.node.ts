import type { LlmProvider, ChatMessage } from '../providers';
import { classificationOutputSchema } from '../schemas';
import type { NodeResult, NodeRunContext, PipelineNodeHandler } from '../node-handler';
import type { PipelineState } from '../types';

/**
 * Step 2 — Classify: structured-output call {intent, risk, topic, searchQuery}.
 * Sensitive questions route to handoff (edge), off-topic ends the run with a
 * canned response, and (when fused) the standalone search query falls out of
 * the same round-trip.
 */
export class ClassifyNode implements PipelineNodeHandler {
  readonly nodeId = 'classify' as const;

  constructor(private readonly llm: LlmProvider) {}

  describeInput(state: PipelineState): Record<string, unknown> {
    return { question: state.question, historyLength: state.history.length };
  }

  async run(state: PipelineState, ctx: NodeRunContext): Promise<NodeResult> {
    const messages: ChatMessage[] = [
      { role: 'system', content: ctx.config.prompts.classifier.content },
      { role: 'user', content: this.buildUserMessage(state) },
    ];

    const { value, usage } = await this.llm.chatStructured(
      {
        model: ctx.config.pipeline.chatModel,
        messages,
        maxTokens: 1024,
        effort: ctx.config.pipeline.classifyEffort,
      },
      classificationOutputSchema,
      'classifier',
      ctx.signal,
    );
    if (usage) ctx.usage(usage.promptTokens, usage.completionTokens);

    ctx.badges({ classification: { intent: value.intent, risk: value.risk, topic: value.topic } });

    if (value.risk === 'off_topic') {
      return {
        patch: { classification: value, terminate: true, finalAnswer: ctx.config.cannedResponses.offTopic },
        output: { classification: value, decision: 'off_topic_terminated' },
      };
    }

    return {
      patch: {
        classification: value,
        ...(ctx.config.pipeline.fusedClassifyRewrite ? { searchQuery: value.searchQuery } : {}),
      },
      output: {
        classification: value,
        searchQuery: value.searchQuery,
        fused: ctx.config.pipeline.fusedClassifyRewrite,
      },
    };
  }

  private buildUserMessage(state: PipelineState): string {
    const parts: string[] = [];
    if (state.history.length > 0) {
      const dialog = state.history
        .map((entry) => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.content}`)
        .join('\n');
      parts.push(`Conversation so far:\n${dialog}`);
    }
    if (state.pageContext?.hint) parts.push(`Page context: ${state.pageContext.hint}`);
    parts.push(`Current question: ${state.question}`);
    return parts.join('\n\n');
  }
}
