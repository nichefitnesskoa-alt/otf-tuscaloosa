/**
 * Canonical data hook for the My Day upcoming intros queue.
 * Three modes: "today", "restOfWeek" (tomorrow through Sunday), "needsOutcome" (past, unresolved).
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, endOfWeek, startOfWeek, addDays, subDays } from 'date-fns';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { UpcomingIntroItem, TimeRange, QuestionnaireStatus } from './myDayTypes';
import { enrichWithRisk, sortByTime } from './myDaySelectors';
import { normalizeDbTime } from '@/lib/time/timeUtils';
import { isVipBooking } from '@/lib/vip/vipRules';
import { extractPhone, stripCountryCode } from '@/lib/parsing/phone';

interface UseUpcomingIntrosOptions {
  timeRange: TimeRange;
}

interface UseUpcomingIntrosReturn {
  items: UpcomingIntroItem[];
  isLoading: boolean;
  lastSyncAt: string | null;
  isOnline: boolean;
  isCapped: boolean;
  refreshAll: () => Promise<void>;
}

function getDateRange(options: UseUpcomingIntrosOptions): { start: string; end: string } {
  const today = format(new Date(), 'yyyy-MM-dd');
  switch (options.timeRange) {
    case 'today':
      return { start: today, end: today };
    case 'restOfWeek': {
      // Full week: Monday through Sunday
      const monday = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const sunday = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      return { start: monday, end: sunday };
    }
    case 'needsOutcome': {
      // Past 45 days, excluding today
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      const fortyFiveDaysAgo = format(subDays(new Date(), 45), 'yyyy-MM-dd');
      return { start: fortyFiveDaysAgo, end: yesterday };
    }
  }
}

function deriveQStatus(
  qData: { status: string; submitted_at: string | null; created_at: string } | null,
): { status: QuestionnaireStatus; sentAt: string | null; completedAt: string | null } {
  if (!qData) return { status: 'NO_Q', sentAt: null, completedAt: null };
  if (qData.status === 'completed' || qData.status === 'submitted') {
    return { status: 'Q_COMPLETED', sentAt: qData.created_at, completedAt: qData.submitted_at || qData.created_at };
  }
  if (qData.status === 'sent') {
    return { status: 'Q_SENT', sentAt: qData.created_at, completedAt: null };
  }
  return { status: 'NO_Q', sentAt: null, completedAt: null };
}

export function useUpcomingIntrosData(options: UseUpcomingIntrosOptions): UseUpcomingIntrosReturn {
  const [items, setItems] = useState<UpcomingIntroItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isCapped, setCapped] = useState(false);
  const isOnline = useOnlineStatus();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { start, end } = getDateRange(options);

      const isNeedsOutcome = options.timeRange === 'needsOutcome';

      const statusExclusion = isNeedsOutcome
        ? '("PURCHASED","CLOSED_PURCHASED","NOT_INTERESTED","SECOND_INTRO_SCHEDULED","CANCELLED","PLANNING_RESCHEDULE")'
        : '("CANCELLED","PLANNING_RESCHEDULE")'; // today/restOfWeek: keep completed intros visible

      let query = supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_time, coach_name, intro_owner, intro_owner_locked, phone, email, lead_source, is_vip, vip_class_name, originating_booking_id, booking_status_canon, booking_type_canon, questionnaire_status_canon, questionnaire_sent_at, questionnaire_completed_at, phone_e164, class_start_at, prepped, prepped_at, prepped_by, referred_by_member_name')
        .is('deleted_at', null)
        .not('booking_type_canon', 'in', '("VIP","COMP")')
        .gte('class_date', start)
        .lte('class_date', end)
        .not('booking_status_canon', 'in', statusExclusion)
        .order('class_date', { ascending: isNeedsOutcome ? false : true }) // most recent first for needs outcome
        .order('intro_time', { ascending: true })
        .limit(200);

      const { data: bookings, error: bErr } = await query;

      if (bErr) throw bErr;
      if (!bookings || bookings.length === 0) {
        setItems([]);
        setCapped(false);
        setLastSyncAt(new Date().toISOString());
        return;
      }
      setCapped(bookings.length >= 200);

      const bookingIds = bookings.map(b => b.id);

      const [qRes, runRes, confirmRes] = await Promise.all([
        supabase
          .from('intro_questionnaires')
          .select('booking_id, status, submitted_at, created_at')
          .in('booking_id', bookingIds),
        supabase
          .from('intros_run')
          .select('id, linked_intro_booked_id, result, created_at, coach_name, primary_objection, notes')
          .in('linked_intro_booked_id', bookingIds)
          .limit(500),
        supabase
          .from('script_actions')
          .select('booking_id, completed_at')
          .in('booking_id', bookingIds)
          .eq('action_type', 'confirmation_sent'),
      ]);

      const qMap = new Map<string, { status: string; submitted_at: string | null; created_at: string }>();
      for (const q of (qRes.data || [])) {
        if (!q.booking_id) continue;
        const existing = qMap.get(q.booking_id);
        const isCompleted = q.status === 'completed' || q.status === 'submitted';
        if (!existing || isCompleted) {
          qMap.set(q.booking_id, { status: q.status, submitted_at: q.submitted_at, created_at: q.created_at });
        }
      }

      const runMap = new Map<string, { result: string; created_at: string; id: string; coach_name: string | null; primary_objection: string | null; notes: string | null }>();
      for (const r of (runRes.data || [])) {
        if (!r.linked_intro_booked_id) continue;
        const existing = runMap.get(r.linked_intro_booked_id);
        if (!existing || r.created_at > existing.created_at) {
          runMap.set(r.linked_intro_booked_id, { result: r.result, created_at: r.created_at, id: r.id, coach_name: r.coach_name, primary_objection: r.primary_objection, notes: r.notes });
        }
      }

      const confirmMap = new Map<string, string>();
      for (const c of (confirmRes.data || [])) {
        if (c.booking_id) confirmMap.set(c.booking_id, c.completed_at);
      }

      const allOriginatingIds = bookings
        .map(b => b.originating_booking_id)
        .filter(Boolean) as string[];
      const originatingSet = new Set(allOriginatingIds);

      const nowISO = new Date().toISOString();
      const rawItems: UpcomingIntroItem[] = bookings.map(b => {
        // Use canonical questionnaire status from DB if available, fall back to joined data
        const bookingQStatus = (b as any).questionnaire_status_canon as string | undefined;
        let qStatus: QuestionnaireStatus;
        let qSentAt: string | null = null;
        let qCompletedAt: string | null = null;

        if (bookingQStatus === 'completed') {
          qStatus = 'Q_COMPLETED';
          qSentAt = (b as any).questionnaire_sent_at || null;
          qCompletedAt = (b as any).questionnaire_completed_at || null;
        } else if (bookingQStatus === 'sent') {
          qStatus = 'Q_SENT';
          qSentAt = (b as any).questionnaire_sent_at || null;
        } else {
          // Fall back to joined questionnaire data
          const q = deriveQStatus(qMap.get(b.id) || null);
          qStatus = q.status;
          qSentAt = q.sentAt;
          qCompletedAt = q.completedAt;
        }

        const run = runMap.get(b.id);
        const normalizedTime = normalizeDbTime(b.intro_time);
        const timePart = normalizedTime ? `${normalizedTime}:00` : '23:59:59';
        const timeStartISO = (b as any).class_start_at || `${b.class_date}T${timePart}`;

        // Use phone_e164 if available, fall back to legacy phone, then try extracting from email
        // Always normalize through stripCountryCode to ensure clean 10-digit storage
        const rawPhone = (b as any).phone_e164 || b.phone;
        let displayPhone = stripCountryCode(rawPhone);
        if (!displayPhone && b.email) {
          displayPhone = stripCountryCode(extractPhone(b.email));
        }

        // isSecond will be set after the loop using priorRunMembers lookup

        return {
          bookingId: b.id,
          memberName: b.member_name,
          classDate: b.class_date,
          introTime: b.intro_time,
          coachName: b.coach_name,
          introOwner: b.intro_owner,
          introOwnerLocked: b.intro_owner_locked ?? false,
          phone: displayPhone,
          email: b.email,
          leadSource: b.lead_source,
          isVip: b.is_vip ?? false,
          vipClassName: b.vip_class_name,
          questionnaireStatus: qStatus,
          qSentAt,
          qCompletedAt,
          confirmedAt: confirmMap.get(b.id) || null,
          hasLinkedRun: !!run,
          latestRunResult: run?.result || null,
          latestRunAt: run?.created_at || null,
          latestRunId: run?.id || null,
          latestRunCoach: run?.coach_name || null,
          latestRunObjection: run?.primary_objection || null,
          latestRunNotes: run?.notes || null,
          originatingBookingId: b.originating_booking_id,
          isSecondIntro: false, // will be set after prior-run lookup
          prepped: (b as any).prepped ?? false,
          preppedAt: (b as any).prepped_at || null,
          preppedBy: (b as any).prepped_by || null,
          referredBy: (b as any).referred_by_member_name || null,
          timeStartISO,
          riskFlags: { noQ: false, qIncomplete: false, unconfirmed: false, coachTbd: false, missingOwner: false },
          riskScore: 0,
        };
      });

      // ── 2nd intro detection: check originating_booking_id + prior runs ──
      {
        // 1) originating_booking_id with same member name = definitive 2nd intro
        for (const item of rawItems) {
          const b = bookings.find(bk => bk.id === item.bookingId);
          if (!b || !b.originating_booking_id) continue;
          const orig = bookings.find(o => o.id === b.originating_booking_id);
          if (orig && orig.member_name.toLowerCase().replace(/\s+/g, '') === b.member_name.toLowerCase().replace(/\s+/g, '')) {
            item.isSecondIntro = true;
          }
          // If originating booking not in batch, query it
          if (!orig && b.originating_booking_id) {
            // Will be resolved below via prior-run check
          }
        }

        // 2) Check for prior intros_run records for each member name
        const uniqueNames = [...new Set(bookings.map(b => b.member_name))];
        // Query in batches of 50 to avoid URL length limits
        const priorRunMembers = new Set<string>();
        for (let i = 0; i < uniqueNames.length; i += 50) {
          const batch = uniqueNames.slice(i, i + 50);
          const { data: priorRuns } = await supabase
            .from('intros_run')
            .select('member_name, linked_intro_booked_id')
            .in('member_name', batch);
          if (priorRuns) {
            for (const pr of priorRuns) {
              priorRunMembers.add(pr.member_name.toLowerCase().replace(/\s+/g, ''));
            }
          }
        }

        // For items not yet marked as 2nd intro, check if they have a prior run
        // A booking is 2nd intro if ANOTHER booking for the same member has a run
        for (const item of rawItems) {
          if (item.isSecondIntro) continue; // already determined
          const nameKey = item.memberName.toLowerCase().replace(/\s+/g, '');
          if (!priorRunMembers.has(nameKey)) continue;
          
          // Member has runs — check if any run is linked to a DIFFERENT booking
          // (not the current one) to confirm this is a subsequent visit
          const memberBookings = rawItems.filter(ri => 
            ri.memberName.toLowerCase().replace(/\s+/g, '') === nameKey
          );
          // Sort by class_date to find the earliest
          const sorted = [...memberBookings].sort((a, c) => {
            const d = a.classDate.localeCompare(c.classDate);
            if (d !== 0) return d;
            return (a.introTime || '').localeCompare(c.introTime || '');
          });
          // The first booking in chronological order is the 1st intro (or might be)
          // But we need to check if prior runs exist from BEFORE this batch
          // Since priorRunMembers confirms runs exist, and if this isn't the earliest booking,
          // it's a 2nd intro
          if (sorted.length > 1 && sorted[0].bookingId !== item.bookingId) {
            item.isSecondIntro = true;
          } else if (sorted.length === 1 || sorted[0].bookingId === item.bookingId) {
            // This is the only/earliest booking in batch — check if prior run is from outside batch
            // Query for runs NOT linked to any booking in current batch
            const batchIds = new Set(rawItems.map(ri => ri.bookingId));
            const { data: externalRuns } = await supabase
              .from('intros_run')
              .select('id, linked_intro_booked_id')
              .eq('member_name', item.memberName)
              .limit(5);
            const hasExternalRun = (externalRuns || []).some(r => 
              r.linked_intro_booked_id && !batchIds.has(r.linked_intro_booked_id)
            );
            if (hasExternalRun) {
              item.isSecondIntro = true;
            }
          }
        }

        // 3) Handle originating_booking_id pointing outside the batch
        for (const item of rawItems) {
          if (item.isSecondIntro) continue;
          const b = bookings.find(bk => bk.id === item.bookingId);
          if (!b || !b.originating_booking_id) continue;
          if (bookings.find(o => o.id === b.originating_booking_id)) continue; // already handled
          // Originating booking is outside batch — check if same member
          const { data: origBooking } = await supabase
            .from('intros_booked')
            .select('member_name')
            .eq('id', b.originating_booking_id)
            .maybeSingle();
          if (origBooking && origBooking.member_name.toLowerCase().replace(/\s+/g, '') === b.member_name.toLowerCase().replace(/\s+/g, '')) {
            item.isSecondIntro = true;
          }
        }
      }

      // ── 2nd intro phone inheritance: fill missing phone from originating booking ──
      const phoneMap = new Map<string, string>();
      const missingPhoneOriginIds: string[] = [];
      for (const item of rawItems) {
        if (item.phone) phoneMap.set(item.bookingId, item.phone);
        if (!item.phone && item.originatingBookingId) {
          missingPhoneOriginIds.push(item.originatingBookingId);
        }
      }
      // Check local batch first, then query DB for any remaining
      const stillMissing = missingPhoneOriginIds.filter(id => !phoneMap.has(id));
      if (stillMissing.length > 0) {
        const { data: originBookings } = await supabase
          .from('intros_booked')
          .select('id, phone, phone_e164, email')
          .in('id', stillMissing);
        for (const ob of (originBookings || [])) {
          const ph = ob.phone_e164 || ob.phone || extractPhone(ob.email);
          if (ph) phoneMap.set(ob.id, ph);
        }
      }
      // Apply inherited phone + auto-fix in background
      for (const item of rawItems) {
        if (!item.phone && item.originatingBookingId) {
          const inherited = phoneMap.get(item.originatingBookingId);
          if (inherited) {
            item.phone = inherited;
            // Background auto-fix: persist so we don't re-query next time
            supabase.from('intros_booked').update({
              phone_e164: inherited.startsWith('+') ? inherited : null,
              phone: inherited.startsWith('+') ? null : inherited,
            }).eq('id', item.bookingId).is('phone_e164', null).is('phone', null).then(() => {});
          }
        }
      }

      // For needsOutcome: keep items with NO linked run OR with an UNRESOLVED run
      // For today/restOfWeek: filter out items that have any linked run (already had outcome)
      const activeItems = isNeedsOutcome
        ? rawItems.filter(i => {
            if (!i.hasLinkedRun) return true;
            // Has a run — only show if result is unresolved
            const result = (i.latestRunResult || '').toLowerCase().trim();
            return !result || result === 'unresolved';
          })
        : rawItems; // Keep all intros visible on today/restOfWeek for review & edits

      // Client-side guard: exclude any VIP bookings that slipped through the DB filter
      const nonVipItems = activeItems.filter(i => !i.isVip);

      // Enrich with risk (kept internally for "needs attention" logic) and sort by time
      const enriched = enrichWithRisk(nonVipItems, nowISO);
      const sorted = sortByTime(enriched);

      setItems(sorted);
      setLastSyncAt(new Date().toISOString());
    } catch (err) {
      console.error('useUpcomingIntrosData fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [options.timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { items, isLoading, lastSyncAt, isOnline, isCapped, refreshAll: fetchData };
}
