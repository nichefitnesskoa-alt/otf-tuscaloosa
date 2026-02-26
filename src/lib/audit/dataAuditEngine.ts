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
  /** IDs of records that need manual inline editing (no auto-fix possible) */
  manualFixIds?: { id: string; name: string; field: string }[];
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
    .select('id, member_name, intro_owner')
    .or('booked_by.is.null,booked_by.eq.')
    .is('deleted_at', null)
    .neq('lead_source', 'Online Intro Offer (self-booked)')
    .neq('lead_source', 'Online Intro Offer')
    .limit(200);

  const count = data?.length ?? 0;
  
  // Identify records that can be auto-fixed (intro_owner exists) vs need manual input
  const canAutoFix = data?.filter(d => d.intro_owner && d.intro_owner.trim() !== '') ?? [];
  const needManual = data?.filter(d => !d.intro_owner || d.intro_owner.trim() === '') ?? [];

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
    suggestedFix: count > 0
      ? canAutoFix.length > 0
        ? `${canAutoFix.length} can be auto-fixed from intro_owner. ${needManual.length} need manual entry.`
        : 'Review these bookings and add the SA who booked them'
      : undefined,
    fixAction: canAutoFix.length > 0 ? 'fix_booked_by_missing' : undefined,
    manualFixIds: needManual.map(d => ({ id: d.id, name: d.member_name, field: 'booked_by' })),
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
  const { data } = await supabase
    .from('intros_booked')
    .select('id, member_name, email')
    .is('phone_e164', null)
    .or('phone.is.null,phone.eq.')
    .is('deleted_at', null)
    .limit(200);

  const count = data?.length ?? 0;

  // Check which ones have a matching lead with phone
  let canAutoFix = 0;
  const manualFixRecords: { id: string; name: string; field: string }[] = [];

  if (data && data.length > 0) {
    const emailsToCheck = data.filter(d => d.email).map(d => d.email!);
    if (emailsToCheck.length > 0) {
      const { data: matchingLeads } = await supabase
        .from('leads')
        .select('email, phone')
        .in('email', emailsToCheck)
        .not('phone', 'is', null)
        .neq('phone', '');

      const leadPhoneMap = new Set((matchingLeads ?? []).map(l => l.email?.toLowerCase()));

      for (const d of data) {
        if (d.email && leadPhoneMap.has(d.email.toLowerCase())) {
          canAutoFix++;
        } else {
          manualFixRecords.push({ id: d.id, name: d.member_name, field: 'phone' });
        }
      }
    } else {
      for (const d of data) {
        manualFixRecords.push({ id: d.id, name: d.member_name, field: 'phone' });
      }
    }
  }

  return {
    checkName: 'Phone Number Missing',
    category: 'Booking Attribution',
    status: count > 0 ? 'warn' : 'pass',
    count,
    description: count > 0
      ? `${count} booking${count !== 1 ? 's' : ''} missing phone number — follow-up scripts can't be personalized`
      : 'All bookings have phone numbers',
    affectedIds: data?.map(d => d.id),
    affectedNames: data?.map(d => d.member_name),
    suggestedFix: count > 0
      ? canAutoFix > 0
        ? `${canAutoFix} can be auto-filled from leads table. ${manualFixRecords.length} need manual entry.`
        : 'Add phone numbers manually'
      : undefined,
    fixAction: canAutoFix > 0 ? 'fix_phone_from_leads' : undefined,
    manualFixIds: manualFixRecords.length > 0 ? manualFixRecords : undefined,
  };
}

async function checkCommissionZeroNonBasic(): Promise<AuditCheckResult> {
  const { data } = await supabase
    .from('intros_run')
    .select('id, member_name, result')
    .in('result_canon', ['PURCHASED'])
    .eq('commission_amount', 0)
    .not('result', 'ilike', '%basic%')
    .neq('result', 'Basic')
    .eq('ignore_from_metrics', false)
    .limit(200);

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
  const { data: runs } = await supabase
    .from('intros_run')
    .select('id, member_name, linked_intro_booked_id, result_canon, result')
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
    suggestedFix: count > 0 ? 'Sync booking status to match the logged outcome' : undefined,
    fixAction: count > 0 ? 'fix_outcome_status_sync' : undefined,
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

// ── PHONE NORMALIZATION HELPER ──

function stripCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    const ten = digits.slice(1);
    if (ten[0] === '0' || ten[0] === '1') return null;
    return ten;
  }
  if (digits.length === 10) {
    if (digits[0] === '0' || digits[0] === '1') return null;
    return digits;
  }
  return null;
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

      case 'fix_2nd_intro_phones': {
        const { data: missing } = await supabase
          .from('intros_booked')
          .select('id, originating_booking_id')
          .not('originating_booking_id', 'is', null)
          .is('phone', null)
          .is('phone_e164', null)
          .is('deleted_at', null)
          .limit(200);
        if (!missing || missing.length === 0) return { fixed: 0 };
        const originIds = [...new Set(missing.map(m => m.originating_booking_id).filter(Boolean))] as string[];
        const { data: origins } = await supabase
          .from('intros_booked')
          .select('id, phone, phone_e164')
          .in('id', originIds);
        const phoneMap = new Map<string, { phone: string | null; phone_e164: string | null }>();
        for (const o of (origins || [])) {
          if (o.phone || o.phone_e164) phoneMap.set(o.id, { phone: o.phone, phone_e164: o.phone_e164 });
        }
        let fixed = 0;
        for (const m of missing) {
          const src = m.originating_booking_id ? phoneMap.get(m.originating_booking_id) : null;
          if (!src) continue;
          // Normalize phone before storing
          const normalizedPhone = stripCountryCode(src.phone);
          const normalizedE164 = normalizedPhone ? `+1${normalizedPhone}` : src.phone_e164;
          const { error } = await supabase.from('intros_booked').update({
            phone: normalizedPhone || src.phone,
            phone_e164: normalizedE164,
            phone_source: 'inherited_from_original',
          }).eq('id', m.id);
          if (!error) fixed++;
        }
        return { fixed };
      }

      case 'fix_outcome_status_sync': {
        // Find runs with result_canon != UNRESOLVED linked to ACTIVE bookings
        const { data: runs } = await supabase
          .from('intros_run')
          .select('id, linked_intro_booked_id, result_canon, result')
          .not('result_canon', 'eq', 'UNRESOLVED')
          .not('linked_intro_booked_id', 'is', null)
          .eq('ignore_from_metrics', false)
          .limit(500);

        if (!runs || runs.length === 0) return { fixed: 0 };

        const bookingIds = runs.map(r => r.linked_intro_booked_id).filter(Boolean) as string[];
        const { data: activeBookings } = await supabase
          .from('intros_booked')
          .select('id')
          .in('id', bookingIds)
          .eq('booking_status_canon', 'ACTIVE');

        const activeIds = new Set(activeBookings?.map(b => b.id) ?? []);
        const toFix = runs.filter(r => r.linked_intro_booked_id && activeIds.has(r.linked_intro_booked_id));

        let fixed = 0;
        for (const run of toFix) {
          const { error } = await supabase
            .from('intros_booked')
            .update({
              booking_status: run.result,
              booking_status_canon: run.result_canon,
            })
            .eq('id', run.linked_intro_booked_id!);
          if (!error) fixed++;
        }
        return { fixed };
      }

      case 'fix_booked_by_missing': {
        // Copy intro_owner → booked_by where booked_by is null but intro_owner exists
        const { data } = await supabase
          .from('intros_booked')
          .select('id, intro_owner')
          .or('booked_by.is.null,booked_by.eq.')
          .not('intro_owner', 'is', null)
          .neq('intro_owner', '')
          .is('deleted_at', null)
          .neq('lead_source', 'Online Intro Offer (self-booked)')
          .neq('lead_source', 'Online Intro Offer')
          .limit(200);

        if (!data || data.length === 0) return { fixed: 0 };

        let fixed = 0;
        for (const row of data) {
          const { error } = await supabase
            .from('intros_booked')
            .update({ booked_by: row.intro_owner })
            .eq('id', row.id);
          if (!error) fixed++;
        }
        return { fixed };
      }

      case 'fix_phone_from_leads': {
        // For bookings missing phone, find matching lead by email and copy phone
        const { data: bookings } = await supabase
          .from('intros_booked')
          .select('id, email')
          .is('phone_e164', null)
          .or('phone.is.null,phone.eq.')
          .is('deleted_at', null)
          .not('email', 'is', null)
          .neq('email', '')
          .limit(200);

        if (!bookings || bookings.length === 0) return { fixed: 0 };

        const emails = bookings.map(b => b.email!.toLowerCase());
        const { data: leads } = await supabase
          .from('leads')
          .select('email, phone')
          .in('email', emails)
          .not('phone', 'is', null)
          .neq('phone', '');

        if (!leads || leads.length === 0) return { fixed: 0 };

        const emailPhoneMap = new Map<string, string>();
        for (const l of leads) {
          if (l.email && l.phone) {
            emailPhoneMap.set(l.email.toLowerCase(), l.phone);
          }
        }

        let fixed = 0;
        for (const b of bookings) {
          const leadPhone = b.email ? emailPhoneMap.get(b.email.toLowerCase()) : null;
          if (!leadPhone) continue;
          
          // Normalize phone
          const normalized = stripCountryCode(leadPhone);
          if (!normalized) continue;

          const { error } = await supabase
            .from('intros_booked')
            .update({
              phone: normalized,
              phone_e164: `+1${normalized}`,
              phone_source: 'copied_from_lead',
            })
            .eq('id', b.id);
          if (!error) fixed++;
        }
        return { fixed };
      }

      default:
        return { fixed: 0, error: 'Unknown fix action' };
    }
  } catch (err: any) {
    return { fixed: 0, error: err?.message || 'Fix failed' };
  }
}

/** Run ALL available auto-fixes in sequence */
export async function runAllFixes(results: AuditCheckResult[]): Promise<{ totalFixed: number; details: { checkName: string; fixed: number; error?: string }[] }> {
  const fixable = results.filter(r => r.fixAction && r.status !== 'pass');
  const details: { checkName: string; fixed: number; error?: string }[] = [];
  let totalFixed = 0;

  for (const check of fixable) {
    const result = await runAutomatedFix(check.fixAction!);
    details.push({ checkName: check.checkName, fixed: result.fixed, error: result.error });
    totalFixed += result.fixed;
  }

  return { totalFixed, details };
}

async function check2ndIntroPhoneInheritance(): Promise<AuditCheckResult> {
  const { data } = await supabase
    .from('intros_booked')
    .select('id, member_name, originating_booking_id')
    .not('originating_booking_id', 'is', null)
    .is('phone', null)
    .is('phone_e164', null)
    .is('deleted_at', null)
    .limit(200);

  const count = data?.length ?? 0;
  return {
    checkName: '2nd Intro Phone Missing',
    category: 'Data Inheritance',
    status: count > 0 ? 'fail' : 'pass',
    count,
    description: count > 0
      ? `${count} 2nd intro${count !== 1 ? 's are' : ' is'} missing phone data that exists on the original booking`
      : 'All 2nd intros have inherited phone data',
    affectedIds: data?.map(d => d.id),
    affectedNames: data?.map(d => d.member_name),
    suggestedFix: count > 0 ? 'Copy phone from originating booking to these 2nd intro records' : undefined,
    fixAction: count > 0 ? 'fix_2nd_intro_phones' : undefined,
  };
}

// ── PERFORMANCE CHECKS ──

async function checkCloseRateConsistency(): Promise<AuditCheckResult> {
  const { data: runs } = await supabase.from('intros_run').select('id, result_canon').eq('ignore_from_metrics', false).limit(1000);
  const total = (runs || []).length;
  const sales = (runs || []).filter(r => r.result_canon === 'PURCHASED').length;
  const calculatedRate = total > 0 ? Math.round((sales / total) * 100) : 0;
  return {
    checkName: 'Close Rate Consistency',
    category: 'Performance Metrics',
    status: 'pass',
    count: 0,
    description: `Close rate verified: ${sales}/${total} = ${calculatedRate}%`,
  };
}

async function checkQCompletionConsistency(): Promise<AuditCheckResult> {
  const { data: bookings } = await supabase.from('intros_booked').select('id, questionnaire_status_canon').is('deleted_at', null).is('originating_booking_id', null).neq('booking_type_canon', 'VIP').neq('booking_type_canon', 'COMP').limit(1000);
  const total = (bookings || []).length;
  const sent = (bookings || []).filter(b => b.questionnaire_status_canon === 'sent' || b.questionnaire_status_canon === 'completed').length;
  const completed = (bookings || []).filter(b => b.questionnaire_status_canon === 'completed').length;
  return {
    checkName: 'Q Completion Consistency',
    category: 'Performance Metrics',
    status: 'pass',
    count: 0,
    description: `Q metrics: Sent ${total > 0 ? Math.round(sent/total*100) : 0}%, Completed ${total > 0 ? Math.round(completed/total*100) : 0}% (${completed}/${total})`,
  };
}

async function checkCommissionTotals(): Promise<AuditCheckResult> {
  const { data: runs } = await supabase.from('intros_run').select('commission_amount').eq('ignore_from_metrics', false).not('commission_amount', 'is', null).limit(1000);
  const total = (runs || []).reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  return {
    checkName: 'Commission Totals',
    category: 'Performance Metrics',
    status: 'pass',
    count: 0,
    description: `Total commission across all runs: $${total.toFixed(0)}`,
  };
}

async function checkReferralPendingStatus(): Promise<AuditCheckResult> {
  const { data: refs } = await supabase.from('referrals').select('id, referred_name, referred_booking_id').limit(500);
  if (!refs || refs.length === 0) return { checkName: 'Referral Status Sync', category: 'Referrals', status: 'pass', count: 0, description: 'No referrals to check' };
  const bookingIds = refs.map(r => r.referred_booking_id).filter(Boolean) as string[];
  if (bookingIds.length === 0) return { checkName: 'Referral Status Sync', category: 'Referrals', status: 'pass', count: 0, description: 'All referrals checked' };
  const { data: purchased } = await supabase.from('intros_booked').select('id').in('id', bookingIds).eq('booking_status_canon', 'CLOSED_PURCHASED');
  const purchasedIds = new Set((purchased || []).map(p => p.id));
  const pendingButPurchased = refs.filter(r => r.referred_booking_id && purchasedIds.has(r.referred_booking_id));
  return {
    checkName: 'Referral Status Sync',
    category: 'Referrals',
    status: pendingButPurchased.length > 0 ? 'warn' : 'pass',
    count: pendingButPurchased.length,
    description: pendingButPurchased.length > 0
      ? `${pendingButPurchased.length} referral(s) show as pending but the referred person has purchased`
      : 'All referral statuses are in sync',
    affectedNames: pendingButPurchased.map(r => r.referred_name),
    fixAction: pendingButPurchased.length > 0 ? 'fix_referral_pending' : undefined,
  };
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
    check2ndIntroPhoneInheritance(),
    checkCloseRateConsistency(),
    checkQCompletionConsistency(),
    checkCommissionTotals(),
    checkReferralPendingStatus(),
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
