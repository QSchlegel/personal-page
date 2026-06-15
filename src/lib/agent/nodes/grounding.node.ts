import type { LlmProvider } from '../providers';
import { groundingVerdictSchema } from '../schemas';
import type { NodeResult, NodeRunContext, PipelineNodeHandler } from '../node-handler';
import type { PipelineState } from '../types';

/**
 * Step 7 — Grounding check: a second LLM call ("is every claim supported by the
 * sources?"). If not, the answer is discarded and the run escalates — better an
 * honest handoff than a plausible hallucination.
 */
export class GroundingNode implements PipelineNodeHandler {
  readonly nodeId = 'grounding' as const;

  constructor(private readonly llm: LlmProvider) {}

  describeInput(state: PipelineState): Record<string, unknown> {
    return {
      draftAnswerLength: state.draftAnswer?.length ?? 0,
      chunkCount: state.rankedChunks?.length ?? 0,
    };
  }

  async run(state: PipelineState, ctx: NodeRunContext): Promise<NodeResult> {
    const draft = state.draftAnswer ?? '';
    if (draft.length === 0) {
      const verdict = { grounded: false, reasoning: 'Empty answer', unsupportedClaims: [] };
      return { patch: { grounding: verdict }, output: { verdict } };
    }

    const sources = (state.rankedChunks ?? [])
      .map((chunk, index) => `[Source ${index + 1}] ${chunk.title}\n${chunk.content}`)
      .join('\n\n---\n\n');

    const { value, usage } = await this.llm.chatStructured(
      {
        model: ctx.config.pipeline.chatModel,
        messages: [
          { role: 'system', content: ctx.config.prompts.grounding_judge.content },
          {
            role: 'user',
            content: `=== SOURCES ===\n\n${sources}\n\n=== ANSWER TO CHECK ===\n\n${draft}`,
          },
        ],
        maxTokens: 1024,
        effort: ctx.config.pipeline.classifyEffort,
      },
      groundingVerdictSchema,
      'grounding_judge',
      ctx.signal,
    );
    if (usage) ctx.usage(usage.promptTokens, usage.completionTokens);

    return {
      patch: {
        grounding: value,
        ...(value.grounded ? { finalAnswer: draft } : {}),
      },
      output: { verdict: value, decision: value.grounded ? 'grounded' : 'discarded' },
    };
  }
}
