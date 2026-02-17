/**
 * Centralized Pipeline action service.
 * ALL Pipeline writes MUST go through these functions.
 * Outcome changes call applyIntroOutcomeUpdate exclusively.
 */
import { supabase } from '@/integrations/supabase/client';
import { applyIntroOutcomeUpdate } from '@/lib/domain/outcomes/applyIntroOutcomeUpdate';
import { normalizeBookingStatus, formatBookingStatusForDb } from '@/lib/domain/outcomes/types';
import type { PipelineBooking, PipelineRun } from './pipelineTypes';

// ── Outcome Update (delegates to canonical function) ──

export interface UpdateOutcomeParams {
  bookingId: string;
  runId?: string;
  memberName: string;
  newResultDisplay: string;
  commissionAmount?: number;
  objection?: string | null;
  editedBy: string;
  classDate: string;
  leadSource?: string;
  editReason?: string;
  previousResult?: string | null;
}

export async function updateOutcomeFromPipeline(params: UpdateOutcomeParams) {
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
    editReason: params.editReason || `Outcome changed to ${params.newResultDisplay} via Pipeline`,
    runId: params.runId,
  });
}

// ── Booking Field Update (safe fields only) ──

export interface UpdateBookingFieldsParams {
  bookingId: string;
  updates: {
    member_name?: string;
    class_date?: string;
    intro_time?: string | null;
    coach_name?: string;
    sa_working_shift?: string;
    booked_by?: string | null;
    lead_source?: string;
    fitness_goal?: string | null;
    booking_status?: string | null;
  };
  editedBy: string;
  editReason?: string;
}

export async function updateBookingFieldsFromPipeline(params: UpdateBookingFieldsParams) {
  const updateData: Record<string, unknown> = {
    ...params.updates,
    last_edited_at: new Date().toISOString(),
    last_edited_by: params.editedBy,
    edit_reason: params.editReason || 'Pipeline edit',
  };

  // If booking_status is being edited, also write canon field
  if (params.updates.booking_status !== undefined) {
    const canon = normalizeBookingStatus(params.updates.booking_status);
    updateData.booking_status_canon = canon;
    updateData.booking_status = formatBookingStatusForDb(canon);
  }

  const { error } = await supabase
    .from('intros_booked')
    .update(updateData)
    .eq('id', params.bookingId);

  if (error) throw error;
}

// ── Sync Intro Owner ──

export async function syncIntroOwnerToBooking(
  bookingId: string,
  introOwner: string,
  editor: string = 'System'
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

// ── Run Edit (non-outcome fields + outcome via canonical if result changed) ──

export interface SaveRunParams {
  run: PipelineRun;
  originalResult: string;
  editedBy: string;
  editReason?: string;
}

export async function saveRunFromPipeline(params: SaveRunParams) {
  const { run, originalResult, editedBy, editReason } = params;
  const effectiveIntroOwner = run.intro_owner || run.ran_by || null;

  const { error } = await supabase
    .from('intros_run')
    .update({
      member_name: run.member_name,
      run_date: run.run_date,
      class_time: run.class_time,
      lead_source: run.lead_source,
      intro_owner: effectiveIntroOwner,
      ran_by: run.ran_by,
      result: run.result,
      goal_quality: run.goal_quality,
      pricing_engagement: run.pricing_engagement,
      notes: run.notes,
      linked_intro_booked_id: run.linked_intro_booked_id,
      coach_name: run.coach_name,
      goal_why_captured: run.goal_why_captured,
      relationship_experience: run.relationship_experience,
      made_a_friend: run.made_a_friend,
      commission_amount: run.commission_amount,
      buy_date: run.buy_date,
      last_edited_at: new Date().toISOString(),
      last_edited_by: editedBy,
      edit_reason: editReason || 'Pipeline edit',
    })
    .eq('id', run.id);

  if (error) throw error;

  // Sync intro_owner and coach to linked booking
  if (run.linked_intro_booked_id && run.result !== 'No-show') {
    const syncData: Record<string, unknown> = {
      last_edited_at: new Date().toISOString(),
      last_edited_by: `${editedBy} (Auto-Sync)`,
      edit_reason: 'Synced from linked run',
    };
    if (effectiveIntroOwner) {
      syncData.intro_owner = effectiveIntroOwner;
      syncData.intro_owner_locked = true;
    }
    if (run.coach_name) {
      syncData.coach_name = run.coach_name;
    }
    await supabase
      .from('intros_booked')
      .update(syncData)
      .eq('id', run.linked_intro_booked_id);
  }

  // If result changed, use canonical outcome pipeline
  if (run.result !== originalResult && run.linked_intro_booked_id) {
    await applyIntroOutcomeUpdate({
      bookingId: run.linked_intro_booked_id,
      memberName: run.member_name,
      classDate: run.run_date || '',
      newResult: run.result,
      previousResult: originalResult,
      membershipType: run.result,
      commissionAmount: run.commission_amount || 0,
      leadSource: run.lead_source || undefined,
      editedBy,
      sourceComponent: 'Pipeline:EditOutcomeDialog',
      runId: run.id,
      editReason: editReason || 'Pipeline edit',
    });
  }
}

// ── Hard Delete ──

export async function hardDeleteBooking(bookingId: string) {
  const { error } = await supabase
    .from('intros_booked')
    .delete()
    .eq('id', bookingId);
  if (error) throw error;
}

export async function hardDeleteRun(runId: string) {
  const { error } = await supabase
    .from('intros_run')
    .delete()
    .eq('id', runId);
  if (error) throw error;
}

// ── Link / Unlink Run ──

export async function linkRunToBooking(runId: string, bookingId: string, ranBy: string | null, result: string, editedBy: string) {
  const { error } = await supabase
    .from('intros_run')
    .update({
      linked_intro_booked_id: bookingId,
      last_edited_at: new Date().toISOString(),
      last_edited_by: editedBy,
      edit_reason: 'Linked to booking',
    })
    .eq('id', runId);
  if (error) throw error;

  if (result !== 'No-show' && ranBy) {
    await syncIntroOwnerToBooking(bookingId, ranBy, editedBy);
  }
}

export async function unlinkRun(runId: string, editedBy: string) {
  const { error } = await supabase
    .from('intros_run')
    .update({
      linked_intro_booked_id: null,
      last_edited_at: new Date().toISOString(),
      last_edited_by: editedBy,
      edit_reason: 'Unlinked from booking',
    })
    .eq('id', runId);
  if (error) throw error;
}

// ── Soft Delete / Archive ──

export async function softDeleteBooking(bookingId: string, editedBy: string) {
  const { error } = await supabase
    .from('intros_booked')
    .update({
      booking_status: 'Deleted (soft)',
      booking_status_canon: 'DELETED_SOFT',
      last_edited_at: new Date().toISOString(),
      last_edited_by: editedBy,
      edit_reason: 'Archived by admin',
    })
    .eq('id', bookingId);
  if (error) throw error;
}

// ── Mark Not Interested ──

export async function markNotInterested(bookingId: string, editedBy: string) {
  const { error } = await supabase
    .from('intros_booked')
    .update({
      booking_status: 'Not interested',
      booking_status_canon: 'NOT_INTERESTED',
      closed_at: new Date().toISOString(),
      closed_by: editedBy,
      last_edited_at: new Date().toISOString(),
      last_edited_by: editedBy,
      edit_reason: 'Marked as not interested',
    })
    .eq('id', bookingId);
  if (error) throw error;
}

// ── Set Intro Owner ──

export async function setIntroOwner(
  bookingId: string,
  newOwner: string | null,
  editedBy: string,
  reason?: string
) {
  const isClearing = !newOwner || newOwner === '__CLEAR__';
  const { error } = await supabase
    .from('intros_booked')
    .update({
      intro_owner: isClearing ? null : newOwner,
      intro_owner_locked: !isClearing,
      last_edited_at: new Date().toISOString(),
      last_edited_by: editedBy,
      edit_reason: reason || (isClearing ? 'Cleared intro owner' : 'Set intro owner'),
    })
    .eq('id', bookingId);
  if (error) throw error;
}

// ── Auto Fix Inconsistencies ──

export async function autoFixInconsistencies(
  journeys: { bookings: PipelineBooking[]; runs: PipelineRun[]; hasInconsistency: boolean }[],
  editedBy: string
): Promise<{ fixed: number; errors: number }> {
  let fixed = 0;
  let errors = 0;

  const inconsistent = journeys.filter(j => j.hasInconsistency);

  for (const journey of inconsistent) {
    for (const run of journey.runs) {
      if (run.linked_intro_booked_id && run.result !== 'No-show') {
        const runOwner = run.intro_owner || run.ran_by;
        if (runOwner) {
          const linkedBooking = journey.bookings.find(b => b.id === run.linked_intro_booked_id);
          if (linkedBooking && linkedBooking.intro_owner !== runOwner) {
            const success = await syncIntroOwnerToBooking(run.linked_intro_booked_id, runOwner, editedBy);
            success ? fixed++ : errors++;
          }
        }
      }
    }

    // Fix corrupted intro_owner values
    for (const booking of journey.bookings) {
      if (booking.intro_owner && booking.intro_owner.includes('T') && booking.intro_owner.includes(':')) {
        const linkedRun = journey.runs.find(r =>
          r.linked_intro_booked_id === booking.id && r.result !== 'No-show'
        );
        const correctOwner = linkedRun?.intro_owner || linkedRun?.ran_by || null;

        const { error } = await supabase
          .from('intros_booked')
          .update({
            intro_owner: correctOwner,
            intro_owner_locked: !!correctOwner,
            last_edited_at: new Date().toISOString(),
            last_edited_by: `${editedBy} (Auto-Fix)`,
            edit_reason: 'Fixed corrupted intro_owner value',
          })
          .eq('id', booking.id);

        error ? errors++ : fixed++;
      }
    }
  }

  return { fixed, errors };
}
