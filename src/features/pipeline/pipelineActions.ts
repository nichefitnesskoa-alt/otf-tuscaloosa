/**
 * Centralized Pipeline editing actions.
 * All outcome changes MUST flow through applyIntroOutcomeUpdate.
 * Booking field edits go through updateBookingFieldsFromPipeline.
 */
import { supabase } from '@/integrations/supabase/client';
import { applyIntroOutcomeUpdate } from '@/lib/domain/outcomes/applyIntroOutcomeUpdate';
import { normalizeBookingStatus, formatBookingStatusForDb } from '@/lib/domain/outcomes/types';

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

// ── Sync intro_owner from run to booking ──

export async function syncIntroOwnerToBooking(
  bookingId: string,
  introOwner: string,
  editor: string = 'System',
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('intros_booked')
      .update({
        intro_owner: introOwner,
        intro_owner_locked: true,
        last_edited_at: new Date().toISOString(),
        last_edited_by: `${editor} (Auto-Sync)`,
        edit_reason: 'Synced intro_owner from linked run',
      })
      .eq('id', bookingId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error syncing intro_owner:', error);
    return false;
  }
}
