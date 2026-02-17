/**
 * Canonical function for ALL outcome changes across the app.
 * Every component that changes a person's status MUST call this function.
 */
import { supabase } from '@/integrations/supabase/client';
import { isMembershipSale } from '@/lib/sales-detection';
import { incrementAmcOnSale, isAmcEligibleSale } from '@/lib/amc-auto';
import { generateFollowUpEntries } from '@/components/dashboard/FollowUpQueue';
import {
  normalizeIntroResult,
  isMembershipSaleResult,
  mapResultToBookingStatus,
  formatBookingStatusForDb,
  getTodayYMD,
} from './types';

export interface OutcomeUpdateParams {
  bookingId: string;
  memberName: string;
  classDate: string;
  newResult: string;
  previousResult?: string | null;
  membershipType?: string;
  commissionAmount?: number;
  leadSource?: string;
  objection?: string | null;
  editedBy: string;
  sourceComponent: string;
  editReason?: string;
  runId?: string;
}

export interface OutcomeUpdateResult {
  success: boolean;
  runId?: string;
  didIncrementAmc?: boolean;
  didGenerateFollowups?: boolean;
  error?: string;
}

export async function applyIntroOutcomeUpdate(params: OutcomeUpdateParams): Promise<OutcomeUpdateResult> {
  try {
    const isNowSale = isMembershipSale(params.newResult);
    const wasSale = params.previousResult ? isMembershipSale(params.previousResult) : false;
    const wasDidntBuy = params.previousResult === "Didn't Buy";
    const wasNoShow = params.previousResult === 'No-show';
    const isNowDidntBuy = params.newResult === "Didn't Buy";
    const isNowNoShow = params.newResult === 'No-show';
    const isNowNotInterested = params.newResult === 'Not interested';
    const isNowUnresolved = params.newResult === 'Unresolved' || params.newResult === '';

    // Skip processing for unresolved/empty results
    if (isNowUnresolved) {
      return { success: true };
    }

    // ── STEP 1: FIND / CREATE / UPDATE intros_run ──
    let existingRun: { id: string; result: string; buy_date: string | null; lead_source: string | null; amc_incremented_at: string | null } | null = null;

    if (params.runId) {
      const { data } = await supabase
        .from('intros_run')
        .select('id, result, buy_date, lead_source, amc_incremented_at')
        .eq('id', params.runId)
        .maybeSingle();
      existingRun = data as any;
    } else if (params.bookingId) {
      const { data } = await supabase
        .from('intros_run')
        .select('id, result, buy_date, lead_source, amc_incremented_at')
        .eq('linked_intro_booked_id', params.bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      existingRun = data as any;
    }

    // A2: CREATE RUN IF MISSING
    if (!existingRun && params.bookingId) {
      const runDate = params.classDate || getTodayYMD();
      const { data: newRun, error: createErr } = await supabase
        .from('intros_run')
        .insert({
          linked_intro_booked_id: params.bookingId,
          member_name: params.memberName,
          run_date: runDate,
          class_time: '00:00',
          result: params.newResult,
          lead_source: params.leadSource || null,
          sa_name: params.editedBy,
          intro_owner: params.editedBy,
          commission_amount: params.commissionAmount ?? 0,
          primary_objection: params.objection || null,
          buy_date: isNowSale ? (getTodayYMD()) : null,
          created_at: new Date().toISOString(),
          last_edited_at: new Date().toISOString(),
          last_edited_by: params.editedBy,
          edit_reason: params.editReason || `Run auto-created via ${params.sourceComponent}`,
        })
        .select('id, result, buy_date, lead_source, amc_incremented_at')
        .single();

      if (createErr) {
        console.error('Failed to create run:', createErr);
        // Continue without run — still update booking
      } else {
        existingRun = newRun as any;
        params.runId = newRun?.id;
      }
    }

    // Update existing run
    if (existingRun) {
      const buyDate = isNowSale
        ? (existingRun.buy_date || getTodayYMD())
        : existingRun.buy_date;

      await supabase.from('intros_run').update({
        result: params.newResult,
        commission_amount: params.commissionAmount ?? 0,
        primary_objection: params.objection || null,
        buy_date: buyDate,
        last_edited_at: new Date().toISOString(),
        last_edited_by: params.editedBy,
        edit_reason: params.editReason || `Outcome changed to ${params.newResult} via ${params.sourceComponent}`,
      }).eq('id', existingRun.id);
    }

    // ── STEP 2: UPDATE intros_booked ──
    const normalizedResult = normalizeIntroResult(params.newResult);
    const canonicalStatus = mapResultToBookingStatus(normalizedResult);
    const mappedStatus = formatBookingStatusForDb(canonicalStatus);

    let oldBookingStatus: string | null = null;
    if (params.bookingId) {
      const { data: bk } = await supabase
        .from('intros_booked')
        .select('booking_status')
        .eq('id', params.bookingId)
        .maybeSingle();
      oldBookingStatus = bk?.booking_status || null;

      await supabase.from('intros_booked').update({
        booking_status: mappedStatus,
        closed_at: isNowSale ? new Date().toISOString() : null,
        closed_by: isNowSale ? params.editedBy : null,
        last_edited_at: new Date().toISOString(),
        last_edited_by: params.editedBy,
        edit_reason: params.editReason || `Status synced: ${params.newResult}`,
      }).eq('id', params.bookingId);
    }

    // ── STEP 3: AMC (idempotent) ──
    let didIncrementAmc = false;
    if (isNowSale && !wasSale) {
      const alreadyIncremented = existingRun?.amc_incremented_at != null;
      if (!alreadyIncremented) {
        const leadSource = params.leadSource || existingRun?.lead_source || '';
        if (isAmcEligibleSale({ membershipType: params.newResult, leadSource })) {
          await incrementAmcOnSale(params.memberName, params.newResult, params.editedBy, getTodayYMD());
          didIncrementAmc = true;
          if (existingRun) {
            await supabase.from('intros_run').update({
              amc_incremented_at: new Date().toISOString(),
              amc_incremented_by: params.editedBy,
            } as any).eq('id', existingRun.id);
          }
        }
      }
    }

    // ── STEP 4: FOLLOW-UP QUEUE (self-cleaning) ──
    let didGenerateFollowups = false;

    // Sale or Not Interested → clear all pending follow-ups
    if (isNowSale && (wasDidntBuy || wasNoShow)) {
      await supabase.from('follow_up_queue').delete().eq('booking_id', params.bookingId);
    }

    // Transition TO didn't-buy or no-show → generate follow-ups
    if ((isNowDidntBuy || isNowNoShow) && !wasDidntBuy && !wasNoShow) {
      const personType = isNowNoShow ? 'no_show' : 'didnt_buy';
      const entries = generateFollowUpEntries(
        params.memberName, personType as 'no_show' | 'didnt_buy',
        params.classDate, params.bookingId, null, false,
        isNowDidntBuy ? params.objection || null : null, null,
      );
      // Use upsert-like behavior: delete existing then insert to respect unique constraint
      await supabase.from('follow_up_queue').delete().eq('booking_id', params.bookingId);
      await supabase.from('follow_up_queue').insert(entries);
      didGenerateFollowups = true;
    }

    // Switching BETWEEN didn't-buy and no-show
    if ((wasDidntBuy && isNowNoShow) || (wasNoShow && isNowDidntBuy)) {
      await supabase.from('follow_up_queue').delete().eq('booking_id', params.bookingId);
      const personType = isNowNoShow ? 'no_show' : 'didnt_buy';
      const entries = generateFollowUpEntries(
        params.memberName, personType as 'no_show' | 'didnt_buy',
        params.classDate, params.bookingId, null, false,
        isNowDidntBuy ? params.objection || null : null, null,
      );
      await supabase.from('follow_up_queue').insert(entries);
      didGenerateFollowups = true;
    }

    // Not interested → clear pending only
    if (isNowNotInterested) {
      await supabase.from('follow_up_queue')
        .delete()
        .eq('booking_id', params.bookingId)
        .eq('status', 'pending');
    }

    // Sale from any state → clear all pending
    if (isNowSale && !wasSale) {
      await supabase.from('follow_up_queue')
        .delete()
        .eq('booking_id', params.bookingId)
        .eq('status', 'pending');
    }

    // ── STEP 5: AUDIT LOG (outcome_events) ──
    await supabase.from('outcome_events' as any).insert({
      booking_id: params.bookingId,
      run_id: params.runId || existingRun?.id || null,
      old_result: params.previousResult || existingRun?.result || null,
      new_result: params.newResult,
      old_booking_status: oldBookingStatus,
      new_booking_status: mappedStatus,
      edited_by: params.editedBy,
      source_component: params.sourceComponent,
      edit_reason: params.editReason || `${params.sourceComponent}: ${params.previousResult || 'unknown'} → ${params.newResult}`,
      metadata: JSON.stringify({
        amc_incremented: didIncrementAmc,
        commission: params.commissionAmount ?? 0,
        lead_source: params.leadSource || existingRun?.lead_source || null,
        buy_date: isNowSale ? (existingRun?.buy_date || getTodayYMD()) : null,
      }),
    } as any);

    // Legacy backward compat
    try {
      await supabase.from('outcome_changes').insert({
        booking_id: params.bookingId,
        run_id: params.runId || existingRun?.id || null,
        old_result: params.previousResult || existingRun?.result || null,
        new_result: params.newResult,
        old_booking_status: oldBookingStatus,
        new_booking_status: mappedStatus,
        changed_by: params.editedBy,
        change_reason: params.editReason || `${params.sourceComponent}: ${params.previousResult || 'unknown'} → ${params.newResult}`,
        source_component: params.sourceComponent,
        amc_incremented: didIncrementAmc,
      } as any);
    } catch {
      // non-critical
    }

    return { success: true, runId: existingRun?.id || params.runId, didIncrementAmc, didGenerateFollowups };
  } catch (err: any) {
    console.error('applyIntroOutcomeUpdate error:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}
