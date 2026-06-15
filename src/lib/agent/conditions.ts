/**
 * Named edge predicates — pure functions over the pipeline state. The
 * serialized graph carries only the names; the executor evaluates them here.
 */
import type { ConditionName, PipelineState } from './types';

export const CONDITIONS: Record<ConditionName, (state: PipelineState) => boolean> = {
  risk_is_sensitive: (state) => state.classification?.risk === 'sensitive',
  no_evidence: (state) => state.noEvidence === true,
  tool_escalate: (state) => state.toolEscalate === true,
  grounding_failed: (state) => (state.grounding ? !state.grounding.grounded : false),
  default: () => true,
};
