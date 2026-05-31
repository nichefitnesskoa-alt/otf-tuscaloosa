/**
 * Canonical "expected intro owner" rule.
 *
 * Single source of truth for who SHOULD own an intro for commission
 * purposes. Reused by:
 *   - applyIntroOutcomeUpdate (write path — sets intro_owner on first run)
 *   - PersonJourneyCard (read path — surfaces mismatches between actual
 *     intro_owner and what the rule would produce today)
 *
 * The rule:
 *   1. 2nd intros inherit owner from the originating (1st) booking.
 *   2. Lead source contains "personal friend" AND booked_by is set
 *      → owner is the booked_by SA.
 *   3. Otherwise → owner is the SA running the intro (the editor).
 *
 * NOTE: This helper is PURE. All DB lookups must be performed by the
 * caller and the resolved values passed in. That keeps the rule
 * testable and avoids duplicating chain traversal.
 */

export interface ExpectedIntroOwnerInput {
  /** Lead source on the booking. May be null. */
  leadSource: string | null | undefined;
  /** booked_by on the booking. May be null. */
  bookedBy: string | null | undefined;
  /** The SA logging / running the intro. Used as the fallback owner. */
  runningSa: string;
  /** If this booking is a 2nd intro, the intro_owner of the 1st-intro
   *  booking in the chain. Pass null/undefined for 1st intros. */
  originatingOwner?: string | null;
}

export interface ExpectedIntroOwnerResult {
  /** Who the rule says the intro_owner SHOULD be. */
  expected: string;
  /** Which clause of the rule fired. */
  reason: 'inherited_2nd_intro' | 'personal_friend' | 'running_sa';
}

const PERSONAL_FRIEND_MARKER = 'personal friend';

export function computeExpectedIntroOwner(
  input: ExpectedIntroOwnerInput,
): ExpectedIntroOwnerResult {
  // Clause 1 — 2nd intros inherit from the chain root.
  if (input.originatingOwner) {
    return { expected: input.originatingOwner, reason: 'inherited_2nd_intro' };
  }

  // Clause 2 — "My Personal Friend I Invited" (and any variant containing
  // the phrase "personal friend") credits the SA who booked it.
  const ls = (input.leadSource || '').toLowerCase();
  if (ls.includes(PERSONAL_FRIEND_MARKER) && input.bookedBy) {
    return { expected: input.bookedBy, reason: 'personal_friend' };
  }

  // Clause 3 — otherwise the SA running the intro keeps credit.
  return { expected: input.runningSa, reason: 'running_sa' };
}

/**
 * Read-only mismatch classifier for the Journey card.
 * Compares an actual intro_owner against the rule's expected owner.
 *
 *   - 'matches'                → actual === expected
 *   - 'locked_override'        → intro_owner_locked = true AND actual !== expected
 *                                (deliberate manual override, informational only)
 *   - 'unlocked_mismatch'      → intro_owner_locked = false AND actual !== expected
 *                                (backfill candidate — not auto-fixed in Phase 1)
 *   - 'unowned'                → actual is null/empty
 */
export type IntroOwnerMismatchStatus =
  | 'matches'
  | 'locked_override'
  | 'unlocked_mismatch'
  | 'unowned';

export function classifyIntroOwnerStatus(args: {
  actual: string | null | undefined;
  expected: string;
  locked: boolean | null | undefined;
}): IntroOwnerMismatchStatus {
  const actual = (args.actual || '').trim();
  if (!actual) return 'unowned';
  if (actual === args.expected) return 'matches';
  return args.locked ? 'locked_override' : 'unlocked_mismatch';
}
