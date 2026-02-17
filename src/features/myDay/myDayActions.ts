/**
 * My Day canonical write actions.
 * All actions set audit fields. None touch outcome-owned fields.
 * All actions are idempotent where possible.
 */
import { supabase } from '@/integrations/supabase/client';
import { syncIntroOwnerToBooking } from '@/features/pipeline/pipelineActions';

// ── Single-item actions ──

export async function sendQuestionnaire(
  bookingId: string,
  memberName: string,
  classDate: string,
  sentBy: string,
): Promise<void> {
  // Check if a questionnaire already exists for this booking
  const { data: existing } = await supabase
    .from('intro_questionnaires')
    .select('id, status')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (existing) {
    // Already exists - just update status to sent if not already completed
    if (existing.status !== 'completed' && existing.status !== 'submitted') {
      await supabase
        .from('intro_questionnaires')
        .update({ status: 'sent' })
        .eq('id', existing.id);
    }
    return;
  }

  // Create new questionnaire
  const nameParts = memberName.trim().split(/\s+/);
  const firstName = nameParts[0] || memberName;
  const lastName = nameParts.slice(1).join(' ') || '';

  await supabase.from('intro_questionnaires').insert({
    booking_id: bookingId,
    client_first_name: firstName,
    client_last_name: lastName,
    scheduled_class_date: classDate,
    status: 'sent',
  });
}

export async function confirmIntro(
  bookingId: string,
  confirmedBy: string,
): Promise<void> {
  // Use script_actions to track confirmation (existing pattern)
  // Idempotent: check if already confirmed
  const { data: existing } = await supabase
    .from('script_actions')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('action_type', 'confirmation_sent')
    .maybeSingle();

  if (existing) return; // Already confirmed

  await supabase.from('script_actions').insert({
    booking_id: bookingId,
    action_type: 'confirmation_sent',
    completed_by: confirmedBy,
  });
}

export async function assignIntroOwner(
  bookingId: string,
  ownerName: string,
  editedBy: string,
): Promise<void> {
  // Use existing pipeline helper for owner sync
  await syncIntroOwnerToBooking(bookingId, ownerName, editedBy);
}

// ── Bulk actions ──

export async function bulkSendQuestionnaires(
  bookingIds: string[],
  items: Array<{ bookingId: string; memberName: string; classDate: string }>,
  sentBy: string,
): Promise<number> {
  let count = 0;
  for (const item of items) {
    try {
      await sendQuestionnaire(item.bookingId, item.memberName, item.classDate, sentBy);
      count++;
    } catch (err) {
      console.error(`Failed to send Q for ${item.bookingId}:`, err);
    }
  }
  return count;
}

export async function bulkConfirmIntros(
  bookingIds: string[],
  confirmedBy: string,
): Promise<number> {
  let count = 0;
  for (const id of bookingIds) {
    try {
      await confirmIntro(id, confirmedBy);
      count++;
    } catch (err) {
      console.error(`Failed to confirm ${id}:`, err);
    }
  }
  return count;
}

export async function bulkAssignIntroOwner(
  bookingIds: string[],
  ownerName: string,
  editedBy: string,
): Promise<number> {
  let count = 0;
  for (const id of bookingIds) {
    try {
      await assignIntroOwner(id, ownerName, editedBy);
      count++;
    } catch (err) {
      console.error(`Failed to assign owner for ${id}:`, err);
    }
  }
  return count;
}
