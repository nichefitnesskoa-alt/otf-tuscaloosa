/**
 * Centralized Pipeline editing actions.
 * All outcome changes MUST flow through applyIntroOutcomeUpdate.
 * Booking field edits go through updateBookingFieldsFromPipeline.
 *
 * OUTCOME_OWNED_FIELDS: fields that the canonical function owns when result changes.
 * Direct supabase updates MUST NOT include these when resultChanged is true.
 */
import { supabase } from '@/integrations/supabase/client';
import { applyIntroOutcomeUpdate } from '@/lib/domain/outcomes/applyIntroOutcomeUpdate';
import { normalizeBookingStatus, formatBookingStatusForDb } from '@/lib/domain/outcomes/types';

/**
 * Fields owned by applyIntroOutcomeUpdate when the result changes.
 * Direct run updates must exclude these when resultChanged === true.
 */
export const OUTCOME_OWNED_FIELDS = [
  'result',
  'result_canon',
  'buy_date',
  'commission_amount',
  'primary_objection',
  'amc_incremented_at',
  'amc_incremented_by',
] as const;

type OutcomeOwnedField = typeof OUTCOME_OWNED_FIELDS[number];

/**
 * Guardrail: asserts that a direct-update payload does not contain
 * any outcome-owned fields. Called at write sites when resultChanged is true.
 *
 * Dev: throws so the bug is caught immediately.
 * Prod: logs + strips offending keys so the write proceeds safely.
 */
export function assertNoOutcomeOwnedFields(
  payload: Record<string, unknown>,
  context: string,
): void {
  const offending = (OUTCOME_OWNED_FIELDS as readonly string[]).filter(
    (f) => f in payload,
  );
  if (offending.length === 0) return;

  const msg = `[${context}] Direct update payload contains outcome-owned fields: ${offending.join(', ')}. These must be set via applyIntroOutcomeUpdate when result changes.`;

  if (import.meta.env.DEV) {
    throw new Error(msg);
  }

  console.error(msg);
  // Strip offending keys so the write doesn't corrupt data
  for (const key of offending) {
    delete payload[key];
  }
}

// ── Outcome Update (delegates to canonical function) ──

export interface PipelineOutcomeParams {
  bookingId: string;
  runId?: string;
  memberName: string;
  classDate: string;
  newResultDisplay: string;
  previousResult?: string | null;
  commissionAmount?: number;
  objection?: string | null;
  editedBy: string;
  leadSource?: string;
  editReason?: string;
}

export async function updateOutcomeFromPipeline(params: PipelineOutcomeParams) {
  return applyIntroOutcomeUpdate({
    bookingId: params.bookingId,
    memberName: params.memberName,
    classDate: params.classDate,
    newResult: params.newResultDisplay,
    previousResult: params.previousResult,
    membershipType: params.newResultDisplay,
    commissionAmount: params.commissionAmount ?? 0,
    leadSource: params.leadSource,
    objection: params.objection,
    editedBy: params.editedBy,
    sourceComponent: 'Pipeline:EditOutcomeDialog',
    editReason: params.editReason || `Outcome changed via Pipeline`,
    runId: params.runId,
  });
}

// ── Booking Field Updates (non-outcome) ──

export interface BookingFieldParams {
  bookingId: string;
  memberName?: string;
  classDate?: string;
  introTime?: string | null;
  coachName?: string;
  leadSource?: string;
  bookedBy?: string;
  saWorkingShift?: string;
  bookingStatus?: string;
  fitnessGoal?: string | null;
  editedBy: string;
  editReason?: string;
}

export async function updateBookingFieldsFromPipeline(params: BookingFieldParams) {
  const updates: Record<string, unknown> = {
    last_edited_at: new Date().toISOString(),
    last_edited_by: params.editedBy,
    edit_reason: params.editReason || 'Pipeline edit',
  };

  if (params.memberName !== undefined) updates.member_name = params.memberName;
  if (params.classDate !== undefined) updates.class_date = params.classDate;
  if (params.introTime !== undefined) updates.intro_time = params.introTime;
  if (params.coachName !== undefined) updates.coach_name = params.coachName;
  if (params.leadSource !== undefined) updates.lead_source = params.leadSource;
  if (params.bookedBy !== undefined) updates.booked_by = params.bookedBy;
  if (params.saWorkingShift !== undefined) updates.sa_working_shift = params.saWorkingShift;
  if (params.fitnessGoal !== undefined) updates.fitness_goal = params.fitnessGoal;

  // If booking_status is edited, also set canon field
  if (params.bookingStatus !== undefined) {
    updates.booking_status = params.bookingStatus;
    const canon = normalizeBookingStatus(params.bookingStatus);
    updates.booking_status_canon = canon;
  }

  const { error } = await supabase
    .from('intros_booked')
    .update(updates)
    .eq('id', params.bookingId);

  if (error) throw error;
}

// ── Canonical intro-owner write path ──
// Used by EVERY surface that edits intro_owner (Pipeline spreadsheet inline,
// Edit Booking dialog, Set Owner dialog, Edit Run dialog, sync-from-run).
// Updates booking AND runs AND any 2nd-intro children in one atomic-ish pass
// so Per-SA aggregation (reads run.intro_owner) and drilldowns (read
// booking.intro_owner) can never disagree. Pass `null` to clear/unlock.

export interface SetIntroOwnerOptions {
  /** Editor display name for audit. */
  editor?: string;
  /** Edit reason for audit. */
  reason?: string;
  /** If true (default), sets intro_owner_locked. Pass false to leave unlocked. */
  lock?: boolean;
  /** Source component label for outcome_events audit. */
  source?: string;
}

export async function setIntroOwnerForJourney(
  bookingId: string,
  newOwner: string | null,
  opts: SetIntroOwnerOptions = {},
): Promise<boolean> {
  const editor = opts.editor || 'System';
  const lock = newOwner == null ? false : (opts.lock ?? true);
  const source = opts.source || 'Pipeline:setIntroOwnerForJourney';
  const reason = opts.reason || (newOwner == null ? 'Cleared intro owner' : 'Set intro owner');

  try {
    let previousOwner: string | null = null;
    try {
      const { data } = await supabase
        .from('intros_booked')
        .select('intro_owner')
        .eq('id', bookingId)
        .maybeSingle();
      previousOwner = data?.intro_owner ?? null;
    } catch {
      // non-critical: proceed with sync even if audit fetch fails
    }

    // Collect every booking id in the chain: this booking + any 2nd intros
    // originating from it. Sales credited via a 2nd-intro chain must
    // attribute to the same (corrected) owner.
    const linkedBookingIds = new Set<string>([bookingId]);
    try {
      const { data: secondIntros } = await supabase
        .from('intros_booked')
        .select('id')
        .eq('originating_booking_id', bookingId);
      for (const row of secondIntros || []) {
        if (row?.id) linkedBookingIds.add(row.id);
      }
    } catch {
      // non-critical
    }

    // 1) Booking + children
    const { error: bookingErr } = await supabase
      .from('intros_booked')
      .update({
        intro_owner: newOwner,
        intro_owner_locked: lock,
        last_edited_at: new Date().toISOString(),
        last_edited_by: editor,
        edit_reason: reason,
      })
      .in('id', Array.from(linkedBookingIds));
    if (bookingErr) throw bookingErr;

    // 2) Every run linked to any booking in the chain
    const { error: runErr } = await supabase
      .from('intros_run')
      .update({ intro_owner: newOwner })
      .in('linked_intro_booked_id', Array.from(linkedBookingIds));
    if (runErr) throw runErr;

    // 3) Audit
    try {
      await supabase.from('outcome_events').insert({
        booking_id: bookingId,
        old_result: null,
        new_result: 'owner_sync',
        edited_by: editor,
        source_component: source,
        edit_reason: `Owner: ${previousOwner ?? '(none)'} → ${newOwner ?? '(cleared)'}`,
        metadata: {
          action_type: 'owner_sync',
          previous_owner: previousOwner,
          new_owner: newOwner,
          linked_booking_ids: Array.from(linkedBookingIds),
        },
      });
    } catch {
      console.warn('Audit log for owner change failed (non-critical)');
    }

    return true;
  } catch (error) {
    console.error('Error setting intro_owner for journey:', error);
    return false;
  }
}

/**
 * @deprecated Use `setIntroOwnerForJourney`. Kept as a thin alias so older
 * call sites keep working until they're migrated.
 */
export async function syncIntroOwnerToBooking(
  bookingId: string,
  introOwner: string,
  editor: string = 'System',
): Promise<boolean> {
  return setIntroOwnerForJourney(bookingId, introOwner, {
    editor: `${editor} (Auto-Sync)`,
    reason: 'Synced intro_owner from linked run',
    source: 'Pipeline:syncIntroOwner',
    lock: true,
  });
}
