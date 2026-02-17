/**
 * My Day canonical write actions.
 * All actions set audit fields. None touch outcome-owned fields.
 * All actions are idempotent where possible.
 *
 * assertNoOutcomeWrites guards every Supabase write to prevent
 * accidental outcome field corruption from My Day.
 */
import { supabase } from '@/integrations/supabase/client';
import { syncIntroOwnerToBooking, OUTCOME_OWNED_FIELDS } from '@/features/pipeline/pipelineActions';

/**
 * Guardrail: ensures My Day never writes outcome-owned fields.
 * Dev: throws. Prod: logs + strips offending keys.
 */
export function assertNoOutcomeWrites(
  payload: Record<string, unknown>,
  context: string,
): void {
  const offending = (OUTCOME_OWNED_FIELDS as readonly string[]).filter(
    (f) => f in payload,
  );
  if (offending.length === 0) return;

  const msg = `[MyDay:${context}] Payload contains outcome-owned fields: ${offending.join(', ')}. This is forbidden.`;

  if (import.meta.env.DEV) {
    throw new Error(msg);
  }

  console.error(msg);
  for (const key of offending) {
    delete payload[key];
  }
}

// ── Event logging (best-effort) ──

async function logMyDayEvent(
  actionType: string,
  bookingId: string,
  editedBy: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from('outcome_events').insert({
      booking_id: bookingId,
      old_result: null,
      new_result: actionType,
      edited_by: editedBy,
      source_component: 'MyDay',
      edit_reason: `My Day action: ${actionType}`,
      metadata: { action_type: actionType, ...meta },
    });
  } catch {
    console.warn(`[MyDay] Failed to log event: ${actionType} for ${bookingId}`);
  }
}

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
      const updatePayload: Record<string, unknown> = { status: 'sent' };
      assertNoOutcomeWrites(updatePayload, 'sendQuestionnaire:update');
      await supabase
        .from('intro_questionnaires')
        .update(updatePayload)
        .eq('id', existing.id);
    }
    await logMyDayEvent('questionnaire_sent', bookingId, sentBy, { memberName, was_update: true });
    return;
  }

  // Create new questionnaire
  const nameParts = memberName.trim().split(/\s+/);
  const firstName = nameParts[0] || memberName;
  const lastName = nameParts.slice(1).join(' ') || '';

  const insertPayload = {
    booking_id: bookingId,
    client_first_name: firstName,
    client_last_name: lastName,
    scheduled_class_date: classDate,
    status: 'sent' as const,
  };
  assertNoOutcomeWrites(insertPayload as unknown as Record<string, unknown>, 'sendQuestionnaire:insert');

  await supabase.from('intro_questionnaires').insert(insertPayload);
  await logMyDayEvent('questionnaire_sent', bookingId, sentBy, { memberName });
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

  const insertPayload = {
    booking_id: bookingId,
    action_type: 'confirmation_sent' as const,
    completed_by: confirmedBy,
  };
  assertNoOutcomeWrites(insertPayload as unknown as Record<string, unknown>, 'confirmIntro:insert');

  await supabase.from('script_actions').insert(insertPayload);
  await logMyDayEvent('intro_confirmed', bookingId, confirmedBy);
}

export async function assignIntroOwner(
  bookingId: string,
  ownerName: string,
  editedBy: string,
): Promise<void> {
  // Use existing Pipeline helper for owner sync
  await syncIntroOwnerToBooking(bookingId, ownerName, editedBy);
  await logMyDayEvent('owner_assigned', bookingId, editedBy, { ownerName });
}

// ── Bulk actions ──

export interface BulkResult {
  successCount: number;
  failCount: number;
  failures: string[]; // first 3 failure names
}

export async function bulkSendQuestionnaires(
  bookingIds: string[],
  items: Array<{ bookingId: string; memberName: string; classDate: string }>,
  sentBy: string,
): Promise<BulkResult> {
  const result: BulkResult = { successCount: 0, failCount: 0, failures: [] };
  for (const item of items) {
    try {
      await sendQuestionnaire(item.bookingId, item.memberName, item.classDate, sentBy);
      result.successCount++;
    } catch (err) {
      result.failCount++;
      if (result.failures.length < 3) result.failures.push(item.memberName);
      console.error(`Failed to send Q for ${item.bookingId}:`, err);
    }
  }
  // Best-effort bulk event log
  try {
    await supabase.from('outcome_events').insert({
      booking_id: items[0]?.bookingId || '00000000-0000-0000-0000-000000000000',
      old_result: null,
      new_result: 'bulk_action_completed',
      edited_by: sentBy,
      source_component: 'MyDay:BulkSendQ',
      metadata: { action_type: 'bulk_send_questionnaires', success: result.successCount, failed: result.failCount },
    });
  } catch { /* non-critical */ }
  return result;
}

export async function bulkConfirmIntros(
  bookingIds: string[],
  confirmedBy: string,
): Promise<BulkResult> {
  const result: BulkResult = { successCount: 0, failCount: 0, failures: [] };
  for (const id of bookingIds) {
    try {
      await confirmIntro(id, confirmedBy);
      result.successCount++;
    } catch (err) {
      result.failCount++;
      if (result.failures.length < 3) result.failures.push(id.slice(0, 8));
      console.error(`Failed to confirm ${id}:`, err);
    }
  }
  try {
    await supabase.from('outcome_events').insert({
      booking_id: bookingIds[0] || '00000000-0000-0000-0000-000000000000',
      old_result: null,
      new_result: 'bulk_action_completed',
      edited_by: confirmedBy,
      source_component: 'MyDay:BulkConfirm',
      metadata: { action_type: 'bulk_confirm_intros', success: result.successCount, failed: result.failCount },
    });
  } catch { /* non-critical */ }
  return result;
}

export async function bulkAssignIntroOwner(
  bookingIds: string[],
  ownerName: string,
  editedBy: string,
): Promise<BulkResult> {
  const result: BulkResult = { successCount: 0, failCount: 0, failures: [] };
  for (const id of bookingIds) {
    try {
      await assignIntroOwner(id, ownerName, editedBy);
      result.successCount++;
    } catch (err) {
      result.failCount++;
      if (result.failures.length < 3) result.failures.push(id.slice(0, 8));
      console.error(`Failed to assign owner for ${id}:`, err);
    }
  }
  try {
    await supabase.from('outcome_events').insert({
      booking_id: bookingIds[0] || '00000000-0000-0000-0000-000000000000',
      old_result: null,
      new_result: 'bulk_action_completed',
      edited_by: editedBy,
      source_component: 'MyDay:BulkAssignOwner',
      metadata: { action_type: 'bulk_assign_owner', ownerName, success: result.successCount, failed: result.failCount },
    });
  } catch { /* non-critical */ }
  return result;
}
