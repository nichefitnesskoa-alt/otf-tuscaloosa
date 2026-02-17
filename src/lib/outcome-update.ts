/**
 * Re-exports from the canonical domain module.
 * This file exists for backward compatibility — all imports from '@/lib/outcome-update'
 * are redirected to the canonical source of truth.
 */
export { applyIntroOutcomeUpdate } from '@/lib/domain/outcomes/applyIntroOutcomeUpdate';
export type { OutcomeUpdateParams, OutcomeUpdateResult } from '@/lib/domain/outcomes/applyIntroOutcomeUpdate';
