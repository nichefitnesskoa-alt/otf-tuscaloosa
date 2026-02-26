/**
 * Canonical data hook for the My Day upcoming intros queue.
 * Three modes: "today", "restOfWeek" (tomorrow through Sunday), "needsOutcome" (past, unresolved).
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, endOfWeek, addDays, subDays } from 'date-fns';
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
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      // End of week = Sunday
      const sunday = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      // If today is Sunday, show next week
      if (tomorrow > sunday) {
        const nextSunday = format(endOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        return { start: tomorrow, end: nextSunday };
      }
      return { start: tomorrow, end: sunday };
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
        .select('id, member_name, class_date, intro_time, coach_name, intro_owner, intro_owner_locked, phone, email, lead_source, is_vip, vip_class_name, originating_booking_id, booking_status_canon, booking_type_canon, questionnaire_status_canon, questionnaire_sent_at, questionnaire_completed_at, phone_e164, class_start_at, prepped, prepped_at, prepped_by')
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
          isSecondIntro: !!b.originating_booking_id || originatingSet.has(b.id),
          prepped: (b as any).prepped ?? false,
          preppedAt: (b as any).prepped_at || null,
          preppedBy: (b as any).prepped_by || null,
          timeStartISO,
          riskFlags: { noQ: false, qIncomplete: false, unconfirmed: false, coachTbd: false, missingOwner: false },
          riskScore: 0,
        };
      });

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
