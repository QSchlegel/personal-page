/**
 * Structured-output schemas for the LLM nodes (classification, query rewrite,
 * grounding check). These are passed to `LlmProvider.chatStructured` and turned
 * into the provider's JSON-schema constraint (Anthropic `output_config.format`
 * via zodOutputFormat, or OpenAI `response_format`).
 *
 * Kept locale-neutral; the `.describe()` text guides the model and can be
 * overridden per deployment via the prompts in the ConfigSnapshot.
 */
import { z } from 'zod';

export const riskLevelSchema = z.enum(['normal', 'sensitive', 'off_topic']);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

/**
 * Fused classification + query-rewrite call (one round-trip instead of two):
 * classification plus a standalone search query.
 */
export const classificationOutputSchema = z.object({
  intent: z.string().describe('Short intent label for the question, e.g. "howto", "concept", "contact"'),
  risk: riskLevelSchema.describe(
    'sensitive = should be handled by a human (private/personal/legal/safety); off_topic = outside the assistant\'s scope',
  ),
  topic: z
    .string()
    .nullable()
    .describe('Optional topic/tag the question is about, used to filter retrieval; null if none'),
  searchQuery: z
    .string()
    .describe('A standalone search query with pronouns/references resolved from the conversation history'),
});
export type ClassificationOutput = z.infer<typeof classificationOutputSchema>;

/** Standalone query-rewrite call (used when fusedClassifyRewrite is disabled). */
export const queryRewriteOutputSchema = z.object({
  searchQuery: z
    .string()
    .describe('A standalone search query with pronouns/references resolved from the conversation history'),
});
export type QueryRewriteOutput = z.infer<typeof queryRewriteOutputSchema>;

export const groundingVerdictSchema = z.object({
  grounded: z.boolean().describe('true if every factual claim in the answer is supported by the sources'),
  reasoning: z.string().describe('Short justification for the verdict'),
  unsupportedClaims: z
    .array(z.string())
    .describe('Claims in the answer that are not supported by the provided sources'),
});
export type GroundingVerdict = z.infer<typeof groundingVerdictSchema>;
