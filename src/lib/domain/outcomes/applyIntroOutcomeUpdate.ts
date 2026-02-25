/**
 * Canonical function for ALL outcome changes across the app.
 * Every component that changes a person's status MUST call this function.
 */
import { supabase } from '@/integrations/supabase/client';
import { isMembershipSale } from '@/lib/sales-detection';
import { incrementAmcOnSale, isAmcEligibleSale } from '@/lib/amc-auto';
import { generateFollowUpEntries } from '@/components/dashboard/FollowUpQueue';
import { computeCommission } from '@/lib/outcomes/commissionRules';
import {
  normalizeIntroResult,
  normalizeBookingStatus,
  isMembershipSaleResult,
  mapResultToBookingStatus,
  formatBookingStatusForDb,
  getTodayYMD,
  type IntroResult,
  type BookingStatus,
} from './types';
import { triggerAuditRefresh } from '@/hooks/useDataAudit';

export interface OutcomeUpdateParams {
  bookingId: string;
  memberName: string;
  classDate: string;
  newResult: string;
  previousResult?: string | null;
  membershipType?: string;
  /** @deprecated commission is now computed internally via commissionRules */
  commissionAmount?: number;
  leadSource?: string;
  objection?: string | null;
  /** Coach who taught the class — saved to intros_run.coach_name */
  coachName?: string;
  editedBy: string;
  sourceComponent: string;
  editReason?: string;
  runId?: string;
  secondIntroBookingDraft?: {
    class_start_at: string;
    coach_name: string;
  };
}

export interface OutcomeUpdateResult {
  success: boolean;
  runId?: string;
  didIncrementAmc?: boolean;
  didGenerateFollowups?: boolean;
  error?: string;
  newBookingId?: string;
  newBookingStartAt?: string;
  newBookingCoachName?: string;
}

export async function applyIntroOutcomeUpdate(params: OutcomeUpdateParams): Promise<OutcomeUpdateResult> {
  try {
    // ── COMP BOOKING GUARD: skip AMC, skip follow-ups, skip commission; log only ──
    let isCompBooking = false;
    if (params.bookingId) {
      const { data: bkType } = await supabase
        .from('intros_booked')
        .select('booking_type_canon')
        .eq('id', params.bookingId)
        .maybeSingle();
      isCompBooking = bkType?.booking_type_canon === 'COMP';
    }

    const isNowSale = isMembershipSale(params.newResult);
    const wasSale = params.previousResult ? isMembershipSale(params.previousResult) : false;
    const wasDidntBuy = params.previousResult === "Didn't Buy";
    const wasNoShow = params.previousResult === 'No-show';
    const isNowDidntBuy = params.newResult === "Didn't Buy";
    const isNowNoShow = params.newResult === 'No-show';
    const isNowNotInterested = params.newResult === 'Not interested';
    const isNowUnresolved = params.newResult === 'Unresolved' || params.newResult === '';

    // Compute commission internally — callers no longer pass this
    const resolvedCommission = computeCommission({
      membershipType: isNowSale ? (params.membershipType || params.newResult) : null,
    });

    // Skip processing for unresolved/empty results
    if (isNowUnresolved) {
      return { success: true };
    }

    // ── STEP 1: FIND / CREATE / UPDATE intros_run ──
    type RunSnapshot = { id: string; result: string; buy_date: string | null; lead_source: string | null; amc_incremented_at: string | null };
    let existingRun: RunSnapshot | null = null;

    if (params.runId) {
      const { data } = await supabase
        .from('intros_run')
        .select('id, result, buy_date, lead_source, amc_incremented_at')
        .eq('id', params.runId)
        .maybeSingle();
      existingRun = data;
    } else if (params.bookingId) {
      const { data } = await supabase
        .from('intros_run')
        .select('id, result, buy_date, lead_source, amc_incremented_at')
        .eq('linked_intro_booked_id', params.bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      existingRun = data;
    }

    // A2: CREATE RUN IF MISSING
    if (!existingRun && params.bookingId) {
      // Fetch booking to auto-populate run fields from the source record
      const { data: bookingData } = await supabase
        .from('intros_booked')
        .select('class_start_at, coach_name, class_date, lead_source, booked_by')
        .eq('id', params.bookingId)
        .maybeSingle();

      // Resolve intro owner: Personal Friend → booked_by gets credit, otherwise the SA running the intro
      const isPersonalFriend = (bookingData?.lead_source || '').toLowerCase().includes('personal friend');
      const resolvedOwner = isPersonalFriend && bookingData?.booked_by
        ? bookingData.booked_by
        : params.editedBy;

      const runDate = bookingData?.class_start_at
        ? bookingData.class_start_at.split('T')[0]
        : (params.classDate || getTodayYMD());

      // Extract HH:MM from class_start_at if available, else default to 00:00
      const classTime = bookingData?.class_start_at
        ? (bookingData.class_start_at.split('T')[1]?.substring(0, 5) || '00:00')
        : '00:00';

      const { data: newRun, error: createErr } = await supabase
        .from('intros_run')
        .insert({
          linked_intro_booked_id: params.bookingId,
          member_name: params.memberName,
          run_date: runDate,
          class_time: classTime,
          coach_name: params.coachName || bookingData?.coach_name || null,
          result: params.newResult,
          result_canon: normalizeIntroResult(params.newResult),
          lead_source: params.leadSource || null,
          sa_name: params.editedBy,
          intro_owner: resolvedOwner,
          commission_amount: resolvedCommission,
          primary_objection: params.objection || null,
          buy_date: isNowSale ? getTodayYMD() : null,
          created_at: new Date().toISOString(),
          last_edited_at: new Date().toISOString(),
          last_edited_by: params.editedBy,
          edit_reason: params.editReason || `Run auto-created via ${params.sourceComponent}`,
        })
        .select('id, result, buy_date, lead_source, amc_incremented_at')
        .single();

      if (createErr) {
        console.error('Failed to create run:', createErr);
      } else if (newRun) {
        existingRun = newRun;
        params.runId = newRun.id;

        // Sync intro_owner back to booking and lock it
        await supabase.from('intros_booked').update({
          intro_owner: resolvedOwner,
          intro_owner_locked: true,
        }).eq('id', params.bookingId);
      }
    }

    // Update existing run
    if (existingRun) {
      const buyDate = isNowSale
        ? (existingRun.buy_date || getTodayYMD())
        : existingRun.buy_date;

      const runUpdate: Record<string, unknown> = {
        result: params.newResult,
        result_canon: normalizeIntroResult(params.newResult),
        commission_amount: resolvedCommission,
        primary_objection: params.objection || null,
        buy_date: buyDate,
        last_edited_at: new Date().toISOString(),
        last_edited_by: params.editedBy,
        edit_reason: params.editReason || `Outcome changed to ${params.newResult} via ${params.sourceComponent}`,
      };
      if (params.coachName) {
        runUpdate.coach_name = params.coachName;
      }

      await supabase.from('intros_run').update(runUpdate).eq('id', existingRun.id);
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
        booking_status_canon: canonicalStatus,
        closed_at: isNowSale ? new Date().toISOString() : null,
        closed_by: isNowSale ? params.editedBy : null,
        last_edited_at: new Date().toISOString(),
        last_edited_by: params.editedBy,
        edit_reason: params.editReason || `Status synced: ${params.newResult}`,
      }).eq('id', params.bookingId);
    }

    // ── STEP 3: AMC (idempotent) — skip for COMP bookings ──
    let didIncrementAmc = false;
    if (!isCompBooking && isNowSale && !wasSale) {
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
            }).eq('id', existingRun.id);
          }
        }
      }
    }

    // ── STEP 4: FOLLOW-UP QUEUE (self-cleaning) — skip for COMP bookings ──
    let didGenerateFollowups = false;

    if (!isCompBooking) {
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
    }

    // ── STEP 5: AUDIT LOG (outcome_events) ──
    await supabase.from('outcome_events').insert({
      booking_id: params.bookingId,
      run_id: params.runId || existingRun?.id || null,
      old_result: params.previousResult || existingRun?.result || null,
      new_result: params.newResult,
      old_booking_status: oldBookingStatus,
      new_booking_status: mappedStatus,
      edited_by: params.editedBy,
      source_component: params.sourceComponent,
      edit_reason: params.editReason || `${params.sourceComponent}: ${params.previousResult || 'unknown'} → ${params.newResult}`,
      metadata: {
        amc_incremented: didIncrementAmc,
        commission: resolvedCommission,
        lead_source: params.leadSource || existingRun?.lead_source || null,
        buy_date: isNowSale ? (existingRun?.buy_date || getTodayYMD()) : null,
      },
    });

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
      });
    } catch {
      // non-critical
    }

    // ── STEP 6: 2ND INTRO BOOKING (if provided) ──
    if (params.secondIntroBookingDraft) {
      const draft = params.secondIntroBookingDraft;
      const classDate = draft.class_start_at.split('T')[0] || draft.class_start_at;
      const { data: newBooking } = await supabase
        .from('intros_booked')
        .insert({
          member_name: params.memberName,
          class_date: classDate,
          class_start_at: draft.class_start_at,
          coach_name: draft.coach_name,
          intro_time: draft.class_start_at.split('T')[1]?.substring(0, 5) || null,
          lead_source: params.leadSource || '',
          sa_working_shift: 'AM',
          originating_booking_id: params.bookingId,
          rebooked_from_booking_id: params.bookingId,
          rebook_reason: 'second_intro',
          booking_status_canon: 'ACTIVE',
          booking_type_canon: 'STANDARD',
          questionnaire_status_canon: 'not_sent',
        })
        .select('id')
        .single();

      if (newBooking) {
        return {
          success: true,
          runId: existingRun?.id || params.runId,
          didIncrementAmc,
          didGenerateFollowups,
          newBookingId: newBooking.id,
          newBookingStartAt: draft.class_start_at,
          newBookingCoachName: draft.coach_name,
        };
      }
    }

    // Trigger audit refresh after outcome change
    triggerAuditRefresh();

    return { success: true, runId: existingRun?.id || params.runId, didIncrementAmc, didGenerateFollowups };
  } catch (err: any) {
    console.error('applyIntroOutcomeUpdate error:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}
