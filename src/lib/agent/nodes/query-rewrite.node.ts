import type { LlmProvider } from '../providers';
import { queryRewriteOutputSchema } from '../schemas';
import type { NodeResult, NodeRunContext, PipelineNodeHandler } from '../node-handler';
import type { PipelineState } from '../types';

/**
 * Step 3 — Query rewrite. When classify is fused (default) the search query is
 * already present and this node is a no-op; otherwise it runs its own
 * structured-output call.
 */
export class QueryRewriteNode implements PipelineNodeHandler {
  readonly nodeId = 'query_rewrite' as const;

  constructor(private readonly llm: LlmProvider) {}

  describeInput(state: PipelineState): Record<string, unknown> {
    return { question: state.question, fusedSearchQuery: state.searchQuery ?? null };
  }

  async run(state: PipelineState, ctx: NodeRunContext): Promise<NodeResult> {
    if (state.searchQuery) {
      return { patch: {}, output: { searchQuery: state.searchQuery, fused: true } };
    }

    const dialog = state.history
      .map((entry) => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.content}`)
      .join('\n');

    const { value, usage } = await this.llm.chatStructured(
      {
        model: ctx.config.pipeline.chatModel,
        messages: [
          { role: 'system', content: ctx.config.prompts.query_rewrite.content },
          {
            role: 'user',
            content: `${dialog ? `Conversation so far:\n${dialog}\n\n` : ''}Current question: ${state.question}`,
          },
        ],
        maxTokens: 256,
        effort: ctx.config.pipeline.classifyEffort,
      },
      queryRewriteOutputSchema,
      'query_rewrite',
      ctx.signal,
    );
    if (usage) ctx.usage(usage.promptTokens, usage.completionTokens);

    return {
      patch: { searchQuery: value.searchQuery },
      output: { searchQuery: value.searchQuery, fused: false },
    };
  }
}
