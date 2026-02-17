import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { isMembershipSale } from '@/lib/sales-detection';
import { incrementAmcOnSale, isAmcEligibleSale } from '@/lib/amc-auto';
import { generateFollowUpEntries } from '@/components/dashboard/FollowUpQueue';

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
  error?: string;
}

/**
 * Canonical function for ALL outcome changes across the app.
 * Handles: intros_run update, intros_booked sync, AMC, follow-ups, audit log.
 */
export async function applyIntroOutcomeUpdate(params: OutcomeUpdateParams): Promise<OutcomeUpdateResult> {
  try {
    const isNowSale = isMembershipSale(params.newResult);
    const wasSale = params.previousResult ? isMembershipSale(params.previousResult) : false;
    const wasDidntBuy = params.previousResult === "Didn't Buy";
    const wasNoShow = params.previousResult === 'No-show';
    const isNowDidntBuy = params.newResult === "Didn't Buy";
    const isNowNoShow = params.newResult === 'No-show';
    const isNowNotInterested = params.newResult === 'Not interested';

    // ── STEP 1: UPDATE intros_run ──
    let existingRun: { id: string; result: string; buy_date: string | null; lead_source: string | null } | null = null;

    if (params.runId) {
      const { data } = await supabase
        .from('intros_run')
        .select('id, result, buy_date, lead_source')
        .eq('id', params.runId)
        .maybeSingle();
      existingRun = data;
    } else if (params.bookingId) {
      const { data } = await supabase
        .from('intros_run')
        .select('id, result, buy_date, lead_source')
        .eq('linked_intro_booked_id', params.bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      existingRun = data;
    }

    if (existingRun) {
      const buyDate = isNowSale
        ? (existingRun.buy_date || format(new Date(), 'yyyy-MM-dd'))
        : existingRun.buy_date;

      await supabase.from('intros_run').update({
        result: params.newResult,
        commission_amount: params.commissionAmount || 0,
        primary_objection: params.objection || null,
        buy_date: buyDate,
        last_edited_at: new Date().toISOString(),
        last_edited_by: params.editedBy,
        edit_reason: params.editReason || `Outcome changed to ${params.newResult} via ${params.sourceComponent}`,
      }).eq('id', existingRun.id);
    }

    // ── STEP 2: UPDATE intros_booked ──
    let mappedStatus = 'Active';
    if (isNowSale) mappedStatus = 'Closed – Bought';
    else if (isNowNotInterested) mappedStatus = 'Not Interested';
    else if (isNowDidntBuy || isNowNoShow) mappedStatus = 'Active';

    // Get old booking status for audit
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

    // ── STEP 3: AMC ──
    let didIncrementAmc = false;
    if (isNowSale && !wasSale) {
      const leadSource = params.leadSource || existingRun?.lead_source || '';
      if (isAmcEligibleSale({ membershipType: params.newResult, leadSource })) {
        await incrementAmcOnSale(params.memberName, params.newResult, params.editedBy, format(new Date(), 'yyyy-MM-dd'));
        didIncrementAmc = true;
      }
    }

    // ── STEP 4: FOLLOW-UP QUEUE ──
    // Sale from didnt_buy/no_show → remove follow-ups
    if (isNowSale && (wasDidntBuy || wasNoShow)) {
      await supabase.from('follow_up_queue').delete().eq('booking_id', params.bookingId);
    }

    // Transition TO didnt_buy/no_show (from something else)
    if ((isNowDidntBuy || isNowNoShow) && !wasDidntBuy && !wasNoShow) {
      const personType = isNowNoShow ? 'no_show' : 'didnt_buy';
      const entries = generateFollowUpEntries(
        params.memberName, personType as 'no_show' | 'didnt_buy',
        params.classDate, params.bookingId, null, false,
        isNowDidntBuy ? params.objection || null : null, null,
      );
      await supabase.from('follow_up_queue').insert(entries);
    }

    // Switch BETWEEN didnt_buy and no_show
    if ((wasDidntBuy && isNowNoShow) || (wasNoShow && isNowDidntBuy)) {
      await supabase.from('follow_up_queue').delete().eq('booking_id', params.bookingId);
      const personType = isNowNoShow ? 'no_show' : 'didnt_buy';
      const entries = generateFollowUpEntries(
        params.memberName, personType as 'no_show' | 'didnt_buy',
        params.classDate, params.bookingId, null, false,
        isNowDidntBuy ? params.objection || null : null, null,
      );
      await supabase.from('follow_up_queue').insert(entries);
    }

    // Not interested → remove pending follow-ups
    if (isNowNotInterested) {
      await supabase.from('follow_up_queue')
        .delete()
        .eq('booking_id', params.bookingId)
        .eq('status', 'pending');
    }

    // ── STEP 5: AUDIT LOG ──
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

    return { success: true, runId: existingRun?.id || params.runId };
  } catch (err: any) {
    console.error('applyIntroOutcomeUpdate error:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}
