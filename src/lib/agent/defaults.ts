/**
 * Default prompts and a ConfigSnapshot builder for a generic vault-grounded
 * concierge. Deployments override any of these (e.g. the persona, the
 * disclosure policy, model, thresholds) by passing partial overrides.
 *
 * The disclosure policy lives in the prompts; the hard guarantee that private
 * material never reaches the model is enforced at ingestion time (only public
 * and gated documents are embedded into the knowledge base).
 */
import type { ConfigSnapshot, PipelineConfig, PromptKey } from './types';

export const DEFAULT_CLASSIFIER_PROMPT = `You triage incoming questions for a personal website's AI concierge.
Return a classification as structured JSON:
- intent: a short label for what the user wants (e.g. "howto", "concept", "about", "contact").
- risk: "off_topic" if the question is unrelated to the site's content and persona;
  "sensitive" if it asks for private/personal details, a CV/résumé, legal/financial/medical advice,
  or anything a human should answer directly; otherwise "normal".
- topic: an optional tag the question is about, used to filter retrieval, or null.
- searchQuery: a standalone search query for the knowledge base, with any pronouns or
  references resolved using the conversation so far.`;

export const DEFAULT_QUERY_REWRITE_PROMPT = `Rewrite the user's latest question into a single standalone search query for a
knowledge base. Resolve pronouns and references using the conversation so far.
Return only the query as structured JSON.`;

export const DEFAULT_ANSWER_SYSTEM_PROMPT = `You are the AI concierge for a personal website. You answer questions about the
site's publicly shared writing and ideas, grounded strictly in the SOURCES provided below.

Rules:
- Answer ONLY from the SOURCES. Cite every factual claim with [Source n] markers.
- If the sources do not cover the question, say so plainly and offer to pass it to a human —
  do not invent details or answer from general knowledge.
- Disclosure policy: you may reason over all provided sources, but only reveal content that is
  publicly shared. For anything personal, private, or about the author's CV/résumé, do not
  speculate — point the user to get in touch instead. Never fabricate biographical facts.
- Be concise, warm, and direct. Write in the first person as the site's assistant, not as the author.`;

export const DEFAULT_GROUNDING_JUDGE_PROMPT = `You verify whether an assistant's answer is fully supported by the provided SOURCES.
Return structured JSON: grounded (true only if every factual claim is supported),
a short reasoning, and the list of any unsupported claims. Be strict: an answer that adds
facts not present in the sources is NOT grounded.`;

export const DEFAULT_PROMPTS: Record<PromptKey, { version: number; content: string }> = {
  classifier: { version: 1, content: DEFAULT_CLASSIFIER_PROMPT },
  query_rewrite: { version: 1, content: DEFAULT_QUERY_REWRITE_PROMPT },
  answer_system: { version: 1, content: DEFAULT_ANSWER_SYSTEM_PROMPT },
  grounding_judge: { version: 1, content: DEFAULT_GROUNDING_JUDGE_PROMPT },
};

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  chatModel: 'claude-opus-4-8',
  answerEffort: 'high',
  classifyEffort: 'low',
  maxAnswerTokens: 1024,
  fusedClassifyRewrite: true,
  retrievalTopK: 20,
  rerankTopK: 6,
  rerankMode: 'reranker',
  rerankThreshold: 0.3,
  strongEvidenceThreshold: 0.85,
};

export const DEFAULT_CANNED_RESPONSES = {
  offTopic:
    "I'm the assistant for this site, so I can only help with questions about the writing and ideas published here. Is there something from the site I can help you find?",
  escalation:
    "I don't have a confident, sourced answer for that, so I've flagged it for a human to follow up with you directly. Thanks for your patience.",
};

export interface BuildConfigOptions {
  pipeline?: Partial<PipelineConfig>;
  prompts?: Partial<Record<PromptKey, { version: number; content: string }>>;
  cannedResponses?: Partial<ConfigSnapshot['cannedResponses']>;
  graphVersion?: string;
}

/** Build a ConfigSnapshot from the defaults plus any deployment overrides. */
export function buildConfigSnapshot(opts: BuildConfigOptions = {}): ConfigSnapshot {
  return {
    graphVersion: opts.graphVersion ?? '1',
    pipeline: { ...DEFAULT_PIPELINE_CONFIG, ...opts.pipeline },
    prompts: { ...DEFAULT_PROMPTS, ...opts.prompts },
    cannedResponses: { ...DEFAULT_CANNED_RESPONSES, ...opts.cannedResponses },
  };
}
