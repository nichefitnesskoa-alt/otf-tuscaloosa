/**
 * Centralized lead deduplication engine.
 * Checks a lead against intros_booked, intros_run, AND sales_outside_intro.
 * Priority: phone > email > name+date > name only
 */
import { supabase } from '@/integrations/supabase/client';

export type DuplicateConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type DuplicateMatchType = 'phone' | 'email' | 'name_date' | 'name_only' | null;
export type ExistingStatus = 'active_member' | 'prior_intro' | 'purchased' | null;

export interface DuplicateResult {
  isDuplicate: boolean;
  confidence: DuplicateConfidence;
  matchType: DuplicateMatchType;
  matchedRecord: { table: string; id: string; name: string; date?: string } | null;
  existingStatus: ExistingStatus;
  summaryNote: string | null;
}

/** Normalize a phone to digits only (10-digit US) */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

/** Case-insensitive email normalize */
function normalizeEmail(email: string | null | undefined): string | null {
  return email?.toLowerCase().trim() || null;
}

export async function detectDuplicate(lead: {
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
}): Promise<DuplicateResult> {
  const memberName = `${lead.first_name} ${lead.last_name}`;
  const normalizedPhone = normalizePhone(lead.phone);
  const normalizedEmail = normalizeEmail(lead.email);

  // ── PASS 1: Phone match in sales_outside_intro (active member) ──
  if (normalizedPhone) {
    // sales_outside_intro doesn't store phone, but we can match by name — skip phone here
  }

  // ── PASS 1b: Phone match in intros_booked (highest confidence) ──
  if (normalizedPhone) {
    const { data: phoneBookings } = await supabase
      .from('intros_booked')
      .select('id, member_name, class_date, booking_status_canon, phone, phone_e164')
      .is('deleted_at', null)
      .or(`phone.eq.${normalizedPhone},phone_e164.eq.+1${normalizedPhone}`)
      .limit(1);

    if (phoneBookings && phoneBookings.length > 0) {
      const b = phoneBookings[0];
      const isPurchased = b.booking_status_canon === 'PURCHASED';
      return {
        isDuplicate: true,
        confidence: 'HIGH',
        matchType: 'phone',
        matchedRecord: { table: 'intros_booked', id: b.id, name: b.member_name, date: b.class_date },
        existingStatus: isPurchased ? 'purchased' : 'prior_intro',
        summaryNote: `Phone match: ${b.member_name} — ${isPurchased ? 'purchased' : 'booked intro'} on ${b.class_date}`,
      };
    }
  }

  // ── PASS 2: Email match (high confidence) ──
  if (normalizedEmail) {
    const { data: emailBookings } = await supabase
      .from('intros_booked')
      .select('id, member_name, class_date, booking_status_canon, email')
      .is('deleted_at', null)
      .ilike('email', normalizedEmail)
      .limit(1);

    if (emailBookings && emailBookings.length > 0) {
      const b = emailBookings[0];
      const isPurchased = b.booking_status_canon === 'PURCHASED';
      return {
        isDuplicate: true,
        confidence: 'HIGH',
        matchType: 'email',
        matchedRecord: { table: 'intros_booked', id: b.id, name: b.member_name, date: b.class_date },
        existingStatus: isPurchased ? 'purchased' : 'prior_intro',
        summaryNote: `Email match: ${b.member_name} — ${isPurchased ? 'purchased' : 'booked intro'} on ${b.class_date}`,
      };
    }
  }

  // ── PASS 3: Name match in sales_outside_intro (active member / walk-in sale) ──
  const { data: outsideSales } = await supabase
    .from('sales_outside_intro')
    .select('id, member_name, date_closed, membership_type')
    .ilike('member_name', memberName)
    .limit(1);

  if (outsideSales && outsideSales.length > 0) {
    const s = outsideSales[0];
    return {
      isDuplicate: true,
      confidence: 'HIGH',
      matchType: 'name_date',
      matchedRecord: { table: 'sales_outside_intro', id: s.id, name: s.member_name, date: s.date_closed || undefined },
      existingStatus: 'active_member',
      summaryNote: `Walk-in sale match: ${s.member_name} — ${s.membership_type} purchased${s.date_closed ? ` on ${s.date_closed}` : ''}`,
    };
  }

  // ── PASS 4: Name match in intros_run ──
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const { data: runs } = await supabase
    .from('intros_run')
    .select('id, member_name, run_date, result_canon')
    .ilike('member_name', memberName)
    .gte('run_date', cutoffStr)
    .limit(1);

  if (runs && runs.length > 0) {
    const r = runs[0];
    const isPurchased = r.result_canon === 'PURCHASED';
    return {
      isDuplicate: true,
      confidence: 'MEDIUM',
      matchType: 'name_date',
      matchedRecord: { table: 'intros_run', id: r.id, name: r.member_name, date: r.run_date || undefined },
      existingStatus: isPurchased ? 'purchased' : 'prior_intro',
      summaryNote: `Intro run match: ${r.member_name} — ${isPurchased ? 'purchased' : 'ran an intro'} on ${r.run_date}`,
    };
  }

  // ── PASS 5: Name + date match in intros_booked ──
  const { data: nameBookings } = await supabase
    .from('intros_booked')
    .select('id, member_name, class_date, booking_status_canon')
    .is('deleted_at', null)
    .ilike('member_name', memberName)
    .gte('class_date', cutoffStr)
    .limit(3);

  if (nameBookings && nameBookings.length > 0) {
    const b = nameBookings[0];
    const isPurchased = b.booking_status_canon === 'PURCHASED';
    return {
      isDuplicate: true,
      confidence: 'MEDIUM',
      matchType: 'name_date',
      matchedRecord: { table: 'intros_booked', id: b.id, name: b.member_name, date: b.class_date },
      existingStatus: isPurchased ? 'purchased' : 'prior_intro',
      summaryNote: `Name match: ${b.member_name} — ${isPurchased ? 'purchased' : 'prior intro'} on ${b.class_date}`,
    };
  }

  // ── PASS 6: Name-only match in intros_booked (low confidence) ──
  const { data: nameOnlyBookings } = await supabase
    .from('intros_booked')
    .select('id, member_name, class_date, booking_status_canon')
    .is('deleted_at', null)
    .ilike('member_name', memberName)
    .limit(1);

  if (nameOnlyBookings && nameOnlyBookings.length > 0) {
    const b = nameOnlyBookings[0];
    return {
      isDuplicate: true,
      confidence: 'LOW',
      matchType: 'name_only',
      matchedRecord: { table: 'intros_booked', id: b.id, name: b.member_name, date: b.class_date },
      existingStatus: 'prior_intro',
      summaryNote: `Possible name match: ${b.member_name}`,
    };
  }

  return {
    isDuplicate: false,
    confidence: 'NONE',
    matchType: null,
    matchedRecord: null,
    existingStatus: null,
    summaryNote: null,
  };
}


/** Map confidence to lead stage */
export function confidenceToStage(confidence: DuplicateConfidence, currentStage = 'new'): string {
  if (confidence === 'HIGH') return 'already_in_system';
  if (confidence === 'MEDIUM') return 'flagged';
  // LOW stays as 'new' with a flag — stage doesn't change
  return currentStage;
}

/** Run dedup on a lead and update it in DB */
export async function runDeduplicationForLead(leadId: string, lead: {
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  stage: string;
  duplicate_override?: boolean;
}): Promise<DuplicateResult> {
  // Skip if SA manually confirmed NOT a duplicate
  if (lead.duplicate_override) {
    return { isDuplicate: false, confidence: 'NONE', matchType: null, matchedRecord: null, existingStatus: null, summaryNote: null };
  }

  const result = await detectDuplicate(lead);

  const newStage = confidenceToStage(result.confidence, lead.stage);
  const updatePayload: Record<string, unknown> = {
    duplicate_confidence: result.confidence,
    duplicate_match_type: result.matchType,
    duplicate_notes: result.summaryNote,
    updated_at: new Date().toISOString(),
  };

  // Only update stage if it's currently new or flagged (don't overwrite 'contacted' etc.)
  if (['new', 'flagged', 'already_in_system'].includes(lead.stage) && newStage !== lead.stage) {
    updatePayload.stage = newStage;
  }

  await supabase.from('leads').update(updatePayload).eq('id', leadId);

  return result;
}
