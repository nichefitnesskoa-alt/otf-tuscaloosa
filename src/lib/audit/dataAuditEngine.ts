/**
 * Data Self-Audit Engine
 * Runs consistency checks across the entire app and returns plain-English results.
 * References canonical functions only — never invents its own logic.
 */
import { supabase } from '@/integrations/supabase/client';

export interface AuditCheckResult {
  checkName: string;
  category: string;
  status: 'pass' | 'warn' | 'fail';
  count: number;
  description: string;
  affectedIds?: string[];
  affectedNames?: string[];
  suggestedFix?: string;
  fixAction?: string; // key for automated fix
}

export interface AuditRunResult {
  timestamp: string;
  totalChecks: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  results: AuditCheckResult[];
}

// ── INDIVIDUAL CHECKS ──

async function checkBookingsWithoutLeadSource(): Promise<AuditCheckResult> {
  const { data, error } = await supabase
    .from('intros_booked')
    .select('id, member_name')
    .or('lead_source.is.null,lead_source.eq.')
    .is('deleted_at', null)
    .limit(200);

  const count = data?.length ?? 0;
  return {
    checkName: 'Lead Source Missing',
    category: 'Booking Attribution',
    status: count > 0 ? 'fail' : 'pass',
    count,
    description: count > 0
      ? `${count} booking${count !== 1 ? 's have' : ' has'} no lead source — these can't be counted toward your non-paid intro bonus`
      : 'All bookings have a lead source recorded',
    affectedIds: data?.map(d => d.id),
    affectedNames: data?.map(d => d.member_name),
    suggestedFix: count > 0 ? 'Open each booking and add the correct lead source' : undefined,
  };
}

async function checkBookingsWithoutBookedBy(): Promise<AuditCheckResult> {
  const { data } = await supabase
    .from('intros_booked')
    .select('id, member_name')
    .or('booked_by.is.null,booked_by.eq.')
    .is('deleted_at', null)
    .neq('lead_source', 'Online Intro Offer (self-booked)')
    .neq('lead_source', 'Online Intro Offer')
    .limit(200);

  const count = data?.length ?? 0;
  return {
    checkName: 'Booked By Missing',
    category: 'Booking Attribution',
    status: count > 0 ? 'warn' : 'pass',
    count,
    description: count > 0
      ? `${count} booking${count !== 1 ? 's' : ''} missing the "booked by" SA name — credit can't be attributed`
      : 'All bookings have a "booked by" SA name',
    affectedIds: data?.map(d => d.id),
    affectedNames: data?.map(d => d.member_name),
    suggestedFix: count > 0 ? 'Review these bookings and add the SA who booked them' : undefined,
  };
}

async function checkVipBookingTypeCanon(): Promise<AuditCheckResult> {
  const { data } = await supabase
    .from('intros_booked')
    .select('id, member_name')
    .eq('is_vip', true)
    .neq('booking_type_canon', 'VIP')
    .neq('booking_type_canon', 'COMP')
    .is('deleted_at', null)
    .limit(200);

  const count = data?.length ?? 0;
  return {
    checkName: 'VIP Booking Type Mismatch',
    category: 'VIP Data',
    status: count > 0 ? 'fail' : 'pass',
    count,
    description: count > 0
      ? `${count} VIP member${count !== 1 ? 's are' : ' is'} showing up as regular intros instead of VIP — they may be appearing in MyDay incorrectly`
      : 'All VIP bookings are correctly classified',
    affectedIds: data?.map(d => d.id),
    affectedNames: data?.map(d => d.member_name),
    suggestedFix: count > 0 ? 'Fix these so VIP members stay in the VIP section only' : undefined,
    fixAction: count > 0 ? 'fix_vip_booking_types' : undefined,
  };
}

async function checkQuestionnaireStatusMismatch(): Promise<AuditCheckResult> {
  // Bookings where a completed questionnaire exists but status isn't 'completed'
  const { data } = await supabase
    .from('intros_booked')
    .select('id, member_name, questionnaire_status_canon')
    .in('questionnaire_status_canon', ['not_sent', 'sent'])
    .is('deleted_at', null)
    .limit(500);

  if (!data || data.length === 0) {
    return {
      checkName: 'Questionnaire Status Sync',
      category: 'Questionnaire',
      status: 'pass',
      count: 0,
      description: 'All questionnaire statuses match their actual completion state',
    };
  }

  // Check which have completed questionnaires
  const ids = data.map(d => d.id);
  const { data: completedQs } = await supabase
    .from('intro_questionnaires')
    .select('booking_id')
    .in('booking_id', ids)
    .in('status', ['completed', 'submitted']);

  const mismatchIds = new Set(completedQs?.map(q => q.booking_id).filter(Boolean) ?? []);
  const mismatched = data.filter(d => mismatchIds.has(d.id));
  const count = mismatched.length;

  return {
    checkName: 'Questionnaire Status Sync',
    category: 'Questionnaire',
    status: count > 0 ? 'fail' : 'pass',
    count,
    description: count > 0
      ? `${count} booking${count !== 1 ? 's show' : ' shows'} questionnaire as "not completed" but the guest already filled it out`
      : 'All questionnaire statuses match their actual completion state',
    affectedIds: mismatched.map(d => d.id),
    affectedNames: mismatched.map(d => d.member_name),
    suggestedFix: count > 0 ? 'Sync these questionnaire statuses to "completed"' : undefined,
    fixAction: count > 0 ? 'fix_questionnaire_statuses' : undefined,
  };
}

async function checkOrphanedRuns(): Promise<AuditCheckResult> {
  const { data } = await supabase
    .from('intros_run')
    .select('id, member_name, linked_intro_booked_id')
    .is('linked_intro_booked_id', null)
    .eq('ignore_from_metrics', false)
    .eq('is_vip', false)
    .limit(200);

  const count = data?.length ?? 0;
  return {
    checkName: 'Unlinked Intro Runs',
    category: 'Data Orphans',
    status: count > 0 ? 'warn' : 'pass',
    count,
    description: count > 0
      ? `${count} intro run${count !== 1 ? 's' : ''} not linked to any booking — results may not appear in pipeline or scoreboard correctly`
      : 'All intro runs are linked to a booking',
    affectedIds: data?.map(d => d.id),
    affectedNames: data?.map(d => d.member_name),
    suggestedFix: count > 0 ? 'Review these runs and link them to the correct booking' : undefined,
  };
}

async function checkFollowUpQueuePurchased(): Promise<AuditCheckResult> {
  // People in follow-up queue who have purchased
  const { data: pending } = await supabase
    .from('follow_up_queue')
    .select('id, person_name, booking_id')
    .eq('status', 'pending')
    .not('booking_id', 'is', null)
    .limit(500);

  if (!pending || pending.length === 0) {
    return {
      checkName: 'Follow-Up Queue Cleanup',
      category: 'Follow-Up Queue',
      status: 'pass',
      count: 0,
      description: 'No purchased members lingering in the follow-up queue',
    };
  }

  const bookingIds = [...new Set(pending.map(p => p.booking_id).filter(Boolean))];
  const { data: purchased } = await supabase
    .from('intros_booked')
    .select('id')
    .in('id', bookingIds as string[])
    .in('booking_status_canon', ['PURCHASED', 'NOT_INTERESTED']);

  const purchasedIds = new Set(purchased?.map(p => p.id) ?? []);
  const stale = pending.filter(p => p.booking_id && purchasedIds.has(p.booking_id));
  const count = stale.length;

  return {
    checkName: 'Follow-Up Queue Cleanup',
    category: 'Follow-Up Queue',
    status: count > 0 ? 'fail' : 'pass',
    count,
    description: count > 0
      ? `${count} ${count !== 1 ? 'people are' : 'person is'} still in the follow-up queue but already purchased or marked not interested — they should have been removed automatically`
      : 'No purchased members lingering in the follow-up queue',
    affectedIds: stale.map(s => s.id),
    affectedNames: stale.map(s => s.person_name),
    suggestedFix: count > 0 ? 'Remove these from the follow-up queue' : undefined,
    fixAction: count > 0 ? 'fix_followup_purchased' : undefined,
  };
}

async function checkLeadsAlreadyInSystem(): Promise<AuditCheckResult> {
  const { data: leads } = await supabase
    .from('leads')
    .select('id, first_name, last_name, phone, email')
    .in('stage', ['new', 'contacted'])
    .limit(300);

  if (!leads || leads.length === 0) {
    return {
      checkName: 'Leads Already in System',
      category: 'Lead Data',
      status: 'pass',
      count: 0,
      description: 'No active leads that already have bookings',
    };
  }

  // Check if any of these leads match bookings by phone
  const phones = leads.map(l => l.phone).filter(Boolean);
  const { data: matchingBookings } = await supabase
    .from('intros_booked')
    .select('phone, phone_e164')
    .in('phone', phones)
    .is('deleted_at', null)
    .limit(500);

  const bookedPhones = new Set([
    ...(matchingBookings?.map(b => b.phone).filter(Boolean) ?? []),
    ...(matchingBookings?.map(b => b.phone_e164).filter(Boolean) ?? []),
  ]);

  const alreadyBooked = leads.filter(l => bookedPhones.has(l.phone));
  const count = alreadyBooked.length;

  return {
    checkName: 'Leads Already in System',
    category: 'Lead Data',
    status: count > 0 ? 'warn' : 'pass',
    count,
    description: count > 0
      ? `${count} lead${count !== 1 ? 's' : ''} marked as "new" or "contacted" already ${count !== 1 ? 'have' : 'has'} a booking in the system — ${count !== 1 ? 'they' : 'this lead'} should be moved to "Already in System"`
      : 'No active leads that already have bookings',
    affectedIds: alreadyBooked.map(l => l.id),
    affectedNames: alreadyBooked.map(l => `${l.first_name} ${l.last_name}`),
    suggestedFix: count > 0 ? 'Move these leads to "Already in System" stage' : undefined,
    fixAction: count > 0 ? 'fix_leads_already_in_system' : undefined,
  };
}

async function checkBookingsMissingPhone(): Promise<AuditCheckResult> {
  // Bookings with intake events but no phone
  const { data } = await supabase
    .from('intros_booked')
    .select('id, member_name')
    .is('phone_e164', null)
    .is('deleted_at', null)
    .not('email', 'is', null)
    .limit(200);

  const count = data?.length ?? 0;
  return {
    checkName: 'Phone Number Missing',
    category: 'Booking Attribution',
    status: count > 5 ? 'warn' : 'pass',
    count,
    description: count > 0
      ? `${count} booking${count !== 1 ? 's have' : ' has'} an email but no phone number — follow-up scripts can't be personalized with phone info`
      : 'All bookings with email also have phone numbers',
    affectedIds: data?.map(d => d.id),
    affectedNames: data?.map(d => d.member_name),
    suggestedFix: count > 0 ? 'Run the phone backfill tool to parse phone numbers from email intake data' : undefined,
    fixAction: count > 5 ? 'fix_phone_backfill' : undefined,
  };
}

async function checkCommissionZeroNonBasic(): Promise<AuditCheckResult> {
  // Sale records where commission is 0 but membership is not Basic
  const { data } = await supabase
    .from('intros_run')
    .select('id, member_name, result')
    .in('result_canon', ['PURCHASED'])
    .eq('commission_amount', 0)
    .not('result', 'ilike', '%basic%')
    .neq('result', 'Basic')
    .eq('ignore_from_metrics', false)
    .limit(200);

  // Filter out Basic results client-side for safety
  const nonBasic = data?.filter(d => {
    const r = d.result?.toLowerCase() ?? '';
    return !r.includes('basic') || r.includes('otbeat');
  }) ?? [];
  const count = nonBasic.length;

  return {
    checkName: 'Commission Zero on Non-Basic Sale',
    category: 'Commission',
    status: count > 0 ? 'fail' : 'pass',
    count,
    description: count > 0
      ? `${count} sale${count !== 1 ? 's' : ''} ${count !== 1 ? 'have' : 'has'} $0 commission but ${count !== 1 ? "aren't" : "isn't"} Basic memberships — commission may not have been computed correctly`
      : 'All non-Basic sales have commission recorded',
    affectedIds: nonBasic.map(d => d.id),
    affectedNames: nonBasic.map(d => d.member_name),
    suggestedFix: count > 0 ? 'Review these sales and verify the membership type and commission amount' : undefined,
  };
}

async function checkOutcomeMismatch(): Promise<AuditCheckResult> {
  // Runs with a result but booking still ACTIVE
  const { data: runs } = await supabase
    .from('intros_run')
    .select('id, member_name, linked_intro_booked_id, result_canon')
    .not('result_canon', 'eq', 'UNRESOLVED')
    .not('linked_intro_booked_id', 'is', null)
    .eq('ignore_from_metrics', false)
    .limit(500);

  if (!runs || runs.length === 0) {
    return {
      checkName: 'Outcome Status Sync',
      category: 'Outcomes',
      status: 'pass',
      count: 0,
      description: 'All outcome results match their booking status',
    };
  }

  const bookingIds = runs.map(r => r.linked_intro_booked_id).filter(Boolean) as string[];
  const { data: bookings } = await supabase
    .from('intros_booked')
    .select('id, booking_status_canon')
    .in('id', bookingIds)
    .eq('booking_status_canon', 'ACTIVE');

  const activeBookingIds = new Set(bookings?.map(b => b.id) ?? []);
  const mismatched = runs.filter(r => r.linked_intro_booked_id && activeBookingIds.has(r.linked_intro_booked_id));
  const count = mismatched.length;

  return {
    checkName: 'Outcome Status Sync',
    category: 'Outcomes',
    status: count > 0 ? 'fail' : 'pass',
    count,
    description: count > 0
      ? `${count} intro${count !== 1 ? 's have' : ' has'} an outcome logged but the booking still shows as "Active" — the booking status wasn't updated when the outcome was recorded`
      : 'All outcome results match their booking status',
    affectedIds: mismatched.map(d => d.id),
    affectedNames: mismatched.map(d => d.member_name),
    suggestedFix: count > 0 ? 'Re-save the outcome for these intros to sync the booking status' : undefined,
  };
}

async function checkMissingClassStartAt(): Promise<AuditCheckResult> {
  const { data } = await supabase
    .from('intros_booked')
    .select('id, member_name')
    .is('class_start_at', null)
    .not('intro_time', 'is', null)
    .is('deleted_at', null)
    .limit(200);

  const count = data?.length ?? 0;
  return {
    checkName: 'Missing Class Start Time',
    category: 'Booking Attribution',
    status: count > 10 ? 'warn' : 'pass',
    count,
    description: count > 0
      ? `${count} booking${count !== 1 ? 's have' : ' has'} an intro time entered but no class start timestamp — sorting and countdown timers may not work correctly`
      : 'All bookings with intro times have proper timestamps',
    affectedIds: data?.map(d => d.id),
    affectedNames: data?.map(d => d.member_name),
  };
}

async function checkLeadsWithoutSource(): Promise<AuditCheckResult> {
  const { data } = await supabase
    .from('leads')
    .select('id, first_name, last_name')
    .or('source.is.null,source.eq.')
    .limit(200);

  const count = data?.length ?? 0;
  return {
    checkName: 'Leads Missing Source',
    category: 'Lead Data',
    status: count > 0 ? 'warn' : 'pass',
    count,
    description: count > 0
      ? `${count} lead${count !== 1 ? 's' : ''} missing a source — you can't tell if ${count !== 1 ? 'they came' : 'they came'} from Instagram, referrals, or walk-ins`
      : 'All leads have a source recorded',
    affectedIds: data?.map(d => d.id),
    affectedNames: data?.map(d => `${d.first_name} ${d.last_name}`),
  };
}

// ── AUTOMATED FIX FUNCTIONS ──

export async function runAutomatedFix(fixAction: string): Promise<{ fixed: number; error?: string }> {
  try {
    switch (fixAction) {
      case 'fix_vip_booking_types': {
        const { data, error } = await supabase
          .from('intros_booked')
          .update({ booking_type_canon: 'VIP' } as any)
          .eq('is_vip', true)
          .neq('booking_type_canon', 'VIP')
          .neq('booking_type_canon', 'COMP')
          .select('id');
        if (error) throw error;
        return { fixed: data?.length ?? 0 };
      }

      case 'fix_questionnaire_statuses': {
        const { data, error } = await supabase.rpc('reconcile_questionnaire_statuses');
        if (error) throw error;
        return { fixed: (data as any)?.updated ?? 0 };
      }

      case 'fix_followup_purchased': {
        // Get pending follow-ups for purchased/not-interested bookings
        const { data: pending } = await supabase
          .from('follow_up_queue')
          .select('id, booking_id')
          .eq('status', 'pending')
          .not('booking_id', 'is', null);

        if (!pending || pending.length === 0) return { fixed: 0 };

        const bookingIds = [...new Set(pending.map(p => p.booking_id).filter(Boolean))];
        const { data: resolved } = await supabase
          .from('intros_booked')
          .select('id')
          .in('id', bookingIds as string[])
          .in('booking_status_canon', ['PURCHASED', 'NOT_INTERESTED']);

        const resolvedIds = new Set(resolved?.map(r => r.id) ?? []);
        const toDelete = pending.filter(p => p.booking_id && resolvedIds.has(p.booking_id)).map(p => p.id);
        
        if (toDelete.length === 0) return { fixed: 0 };
        
        const { error } = await supabase.from('follow_up_queue').delete().in('id', toDelete);
        if (error) throw error;
        return { fixed: toDelete.length };
      }

      case 'fix_leads_already_in_system': {
        const { data: leads } = await supabase
          .from('leads')
          .select('id, phone')
          .in('stage', ['new', 'contacted']);
        
        if (!leads || leads.length === 0) return { fixed: 0 };

        const phones = leads.map(l => l.phone).filter(Boolean);
        const { data: bookings } = await supabase
          .from('intros_booked')
          .select('phone')
          .in('phone', phones)
          .is('deleted_at', null);

        const bookedPhones = new Set(bookings?.map(b => b.phone).filter(Boolean) ?? []);
        const toUpdate = leads.filter(l => bookedPhones.has(l.phone)).map(l => l.id);

        if (toUpdate.length === 0) return { fixed: 0 };

        const { error } = await supabase
          .from('leads')
          .update({ stage: 'already_in_system' })
          .in('id', toUpdate);
        if (error) throw error;
        return { fixed: toUpdate.length };
      }

      case 'fix_phone_backfill': {
        const { data, error } = await supabase.rpc('backfill_booking_phones');
        if (error) throw error;
        return { fixed: (data as any)?.updated ?? 0 };
      }

      default:
        return { fixed: 0, error: 'Unknown fix action' };
    }
  } catch (err: any) {
    return { fixed: 0, error: err?.message || 'Fix failed' };
  }
}

// ── MAIN ENGINE ──

export async function runFullAudit(): Promise<AuditRunResult> {
  const checks = await Promise.all([
    checkBookingsWithoutLeadSource(),
    checkBookingsWithoutBookedBy(),
    checkVipBookingTypeCanon(),
    checkQuestionnaireStatusMismatch(),
    checkOrphanedRuns(),
    checkFollowUpQueuePurchased(),
    checkLeadsAlreadyInSystem(),
    checkBookingsMissingPhone(),
    checkCommissionZeroNonBasic(),
    checkOutcomeMismatch(),
    checkMissingClassStartAt(),
    checkLeadsWithoutSource(),
  ]);

  const result: AuditRunResult = {
    timestamp: new Date().toISOString(),
    totalChecks: checks.length,
    passCount: checks.filter(c => c.status === 'pass').length,
    warnCount: checks.filter(c => c.status === 'warn').length,
    failCount: checks.filter(c => c.status === 'fail').length,
    results: checks,
  };

  return result;
}

// ── HISTORY ──

export async function saveAuditRun(run: AuditRunResult): Promise<void> {
  await supabase.from('data_audit_log').insert({
    total_checks: run.totalChecks,
    pass_count: run.passCount,
    warn_count: run.warnCount,
    fail_count: run.failCount,
    results: run.results as any,
  });

  // Keep only last 30 runs
  const { data: all } = await supabase
    .from('data_audit_log')
    .select('id')
    .order('created_at', { ascending: false })
    .range(30, 100);

  if (all && all.length > 0) {
    await supabase.from('data_audit_log').delete().in('id', all.map(a => a.id));
  }
}

export async function getAuditHistory(): Promise<{ created_at: string; pass_count: number; warn_count: number; fail_count: number; total_checks: number }[]> {
  const { data } = await supabase
    .from('data_audit_log')
    .select('created_at, pass_count, warn_count, fail_count, total_checks')
    .order('created_at', { ascending: false })
    .limit(30);
  return (data as any[]) ?? [];
}
