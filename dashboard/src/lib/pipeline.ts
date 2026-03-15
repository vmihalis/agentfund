/**
 * Pipeline stage mapping utilities.
 *
 * Maps backend PipelineStepEvent fields to dashboard PipelineStage values.
 * This is extracted as a pure function for testability.
 */

import type { PipelineStage } from './types';

/**
 * Map a backend pipeline step + status pair to a dashboard stage.
 *
 * Mapping:
 * - discover:started  -> submitted
 * - evaluate:started  -> evaluating
 * - evaluate:completed (recommendation 'fund') -> approved
 * - fund:completed    -> funded
 * - anything else     -> submitted (safe default)
 */
export function mapPipelineStage(
  step: string,
  status: string,
  recommendation?: string,
): PipelineStage {
  if (step === 'fund' && status === 'completed') return 'funded';
  if (step === 'evaluate' && status === 'completed' && recommendation === 'fund')
    return 'approved';
  if (step === 'evaluate' && status === 'started') return 'evaluating';
  if (step === 'discover' && status === 'started') return 'submitted';
  return 'submitted';
}
