/**
 * Single source of truth for converting a VIP attendee purchase into the
 * standard intros_booked + intros_run pair so it flows into commission,
 * coach close-rate, WIG sales, and coach-side First Visit Scorecard eval.
 *
 * Idempotent: handles first save, tier edits, revert-to-non-purchase
 * (soft-cancel), and re-purchase (reactivate the soft-cancelled pair).
 */
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export const VIP_MEMBERSHIP_OPTIONS = [
  { label: 'Premier + OTBeat', commission: 15.0 },
  { label: 'Premier w/o OTBeat', commission: 7.5 },
  { label: 'Elite + OTBeat', commission: 12.0 },
  { label: 'Elite w/o OTBeat', commission: 6.0 },
  { label: 'Basic + OTBeat', commission: 9.0 },
  { label: 'Basic w/o OTBeat', commission: 3.0 },
] as const;

export type VipMembershipLabel = typeof VIP_MEMBERSHIP_OPTIONS[number]['label'];

export function commissionFor(label: string): number {
  return VIP_MEMBERSHIP_OPTIONS.find(m => m.label === label)?.commission ?? 0;
}

interface SaveArgs {
  registrationId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  vipSessionId: string;
  vipSessionDate: string | null;
  vipSessionTime: string | null;
  vipCoach: string;
  membership: VipMembershipLabel | string;
  saName: string;
}

export interface SaveResult {
  bookingId: string;
  runId: string;
}

/**
 * Persist a VIP purchase. Creates or updates the linked intros_booked +
 * intros_run pair. Reactivates a previously soft-cancelled pair instead
 * of creating duplicates.
 */
export async function saveVipPurchase(args: SaveArgs): Promise<SaveResult> {
  const {
    registrationId, firstName, lastName, phone, email,
    vipSessionId, vipSessionDate, vipSessionTime, vipCoach,
    membership, saName,
  } = args;

  if (!vipCoach) throw new Error('Select a class coach first');
  if (!membership) throw new Error('Select a membership tier');
  if (!vipSessionDate) throw new Error('Missing VIP session date');

  const memberName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'Unnamed';
  const commission = commissionFor(membership);
  // Anchor the sale to the VIP class date (the day the transaction actually
  // happened on the floor) — NOT today. This keeps Studio Scoreboard, Lead
  // Source Analytics, Per-Coach/Per-SA, WIG sales, commission pay-period
  // attribution, and Activity Log all aligned with when the sale occurred.
  const saleDate = vipSessionDate;

  // Look up existing pair on this registration
  const { data: regRow } = await sb
    .from('vip_registrations')
    .select('converted_to_booking_id, converted_to_run_id')
    .eq('id', registrationId)
    .maybeSingle();

  let bookingId: string | null = regRow?.converted_to_booking_id || null;
  let runId: string | null = regRow?.converted_to_run_id || null;

  // Reactivate or create booking
  if (bookingId) {
    await sb.from('intros_booked').update({
      member_name: memberName,
      phone: phone || null,
      email: email || null,
      class_date: vipSessionDate,
      intro_time: vipSessionTime,
      coach_name: vipCoach,
      intro_owner: vipCoach,
      booking_status: 'Active',
      booking_status_canon: 'SHOWED',
      booking_type_canon: 'STANDARD',
      ignore_from_metrics: false,
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
      last_edited_at: new Date().toISOString(),
      last_edited_by: `${saName} (VIP Purchase)`,
      edit_reason: 'VIP purchase tier updated',
    }).eq('id', bookingId);
  } else {
    const { data: newBooking, error: bErr } = await sb.from('intros_booked').insert({
      member_name: memberName,
      class_date: vipSessionDate,
      intro_time: vipSessionTime,
      coach_name: vipCoach,
      intro_owner: vipCoach,
      sa_working_shift: saName,
      lead_source: 'VIP Class',
      booked_by: saName,
      phone: phone || null,
      email: email || null,
      is_vip: false,
      booking_status: 'Active',
      booking_status_canon: 'SHOWED',
      booking_type_canon: 'STANDARD',
      vip_session_id: vipSessionId,
    }).select('id').single();
    if (bErr) throw bErr;
    bookingId = newBooking.id;
  }

  // Reactivate or create run
  if (runId) {
    await sb.from('intros_run').update({
      member_name: memberName,
      coach_name: vipCoach,
      class_time: vipSessionTime,
      run_date: vipSessionDate,
      result: membership,
      result_canon: 'SALE',
      commission_amount: commission,
      buy_date: saleDate,
      ignore_from_metrics: false,
      last_edited_at: new Date().toISOString(),
      last_edited_by: `${saName} (VIP Purchase)`,
      edit_reason: 'VIP purchase tier updated',
    }).eq('id', runId);
  } else {
    const { data: newRun, error: rErr } = await sb.from('intros_run').insert({
      linked_intro_booked_id: bookingId,
      member_name: memberName,
      class_time: vipSessionTime,
      run_date: vipSessionDate,
      coach_name: vipCoach,
      sa_name: saName,
      intro_owner: vipCoach,
      result: membership,
      result_canon: 'SALE',
      commission_amount: commission,
      buy_date: saleDate,
      is_vip: false,
      vip_session_id: vipSessionId,
      lead_source: 'VIP Class',
      booking_source: 'VIP Class',
    }).select('id').single();
    if (rErr) throw rErr;
    runId = newRun.id;
  }

  // Update registration with purchase data + links
  await sb.from('vip_registrations').update({
    outcome: 'purchased',
    membership_type: membership,
    commission_amount: commission,
    purchased_at: new Date().toISOString(),
    converted_to_booking_id: bookingId,
    converted_to_run_id: runId,
    outcome_logged_at: new Date().toISOString(),
    outcome_logged_by: saName,
  }).eq('id', registrationId);

  return { bookingId: bookingId!, runId: runId! };
}

/**
 * Soft-cancel the auto-created booking/run pair when SA changes the
 * outcome away from Purchased. Keeps the registration row + IDs so a
 * re-purchase reactivates the same pair.
 */
export async function softCancelVipPurchase(registrationId: string, saName: string): Promise<void> {
  const { data: regRow } = await sb
    .from('vip_registrations')
    .select('converted_to_booking_id, converted_to_run_id')
    .eq('id', registrationId)
    .maybeSingle();

  const bookingId = regRow?.converted_to_booking_id;
  const runId = regRow?.converted_to_run_id;

  const stamp = new Date().toISOString();

  if (bookingId) {
    await sb.from('intros_booked').update({
      booking_status: 'Cancelled',
      booking_status_canon: 'DELETED_SOFT',
      ignore_from_metrics: true,
      deleted_at: stamp,
      deleted_by: saName,
      delete_reason: 'VIP purchase undone',
      last_edited_at: stamp,
      last_edited_by: `${saName} (VIP Purchase)`,
      edit_reason: 'VIP purchase undone',
    }).eq('id', bookingId);
  }
  if (runId) {
    await sb.from('intros_run').update({
      ignore_from_metrics: true,
      last_edited_at: stamp,
      last_edited_by: `${saName} (VIP Purchase)`,
      edit_reason: 'VIP purchase undone',
    }).eq('id', runId);
  }

  await sb.from('vip_registrations').update({
    membership_type: null,
    commission_amount: null,
    purchased_at: null,
  }).eq('id', registrationId);
}
