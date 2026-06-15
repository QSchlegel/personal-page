/**
 * Serialized definition of the RAG concierge graph. Single source of truth:
 * the executor runs exactly this graph (one NodeHandler per node id). Free of
 * runtime dependencies.
 *
 * Generalized from the original support-rag graph: single agent (no
 * support/sales split, no lead-dialog branch). Off-topic questions terminate
 * inside the classify node with a canned response (no escalation spam).
 */
import type { PipelineGraphDef } from './types';

export const CONCIERGE_GRAPH: PipelineGraphDef = {
  id: 'concierge-rag',
  graphVersion: '1',
  entry: 'intake',
  nodes: [
    { id: 'intake', label: 'Intake', description: 'Normalize the question; bound the conversation history.' },
    {
      id: 'classify',
      label: 'Classify',
      description:
        'Structured-output call {intent, risk, topic, searchQuery}; routes sensitive questions to handoff and ends off-topic ones.',
    },
    {
      id: 'query_rewrite',
      label: 'Query rewrite',
      description: 'Rewrite the question into a standalone search query (no-op if fused into classify).',
    },
    {
      id: 'retrieval',
      label: 'Retrieval',
      description: 'Hybrid search: vector + full-text, top-K, optional topic filter with fallback.',
    },
    {
      id: 'rerank',
      label: 'Rerank & threshold',
      description: 'Rerank to top-K; below the minimum score, take the "no evidence" path.',
    },
    {
      id: 'answer',
      label: 'Answer',
      description: 'Streaming call; the system prompt enforces citations [Source n] and an escalate tool.',
    },
    {
      id: 'grounding',
      label: 'Grounding check',
      description: 'Second call: is every claim supported by the sources? If not, discard and escalate.',
    },
    {
      id: 'escalation',
      label: 'Escalation',
      description: 'LLM-free handoff: summary + transcript to the escalation sink, returns a canned reply.',
    },
  ],
  edges: [
    { id: 'e_intake_classify', source: 'intake', target: 'classify', condition: 'default' },
    { id: 'e_classify_rewrite', source: 'classify', target: 'query_rewrite', condition: 'default' },
    {
      id: 'e_classify_escalation',
      source: 'classify',
      target: 'escalation',
      condition: 'risk_is_sensitive',
      label: 'sensitive → human',
    },
    { id: 'e_rewrite_retrieval', source: 'query_rewrite', target: 'retrieval', condition: 'default' },
    { id: 'e_retrieval_rerank', source: 'retrieval', target: 'rerank', condition: 'default' },
    { id: 'e_rerank_answer', source: 'rerank', target: 'answer', condition: 'default' },
    {
      id: 'e_rerank_escalation',
      source: 'rerank',
      target: 'escalation',
      condition: 'no_evidence',
      label: 'no evidence',
    },
    { id: 'e_answer_grounding', source: 'answer', target: 'grounding', condition: 'default' },
    {
      id: 'e_answer_escalation',
      source: 'answer',
      target: 'escalation',
      condition: 'tool_escalate',
      label: 'tool: escalate',
    },
    {
      id: 'e_grounding_escalation',
      source: 'grounding',
      target: 'escalation',
      condition: 'grounding_failed',
      label: 'not grounded',
    },
  ],
};
