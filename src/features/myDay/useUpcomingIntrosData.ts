/**
 * Canonical data hook for the My Day upcoming intros queue.
 * Single fetch, enriches with questionnaire and run data.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays } from 'date-fns';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { UpcomingIntroItem, TimeRange, QuestionnaireStatus } from './myDayTypes';
import { enrichWithRisk, sortRiskFirst } from './myDaySelectors';
import { normalizeDbTime } from '@/lib/time/timeUtils';
import { isVipBooking } from '@/lib/vip/vipRules';

interface UseUpcomingIntrosOptions {
  timeRange: TimeRange;
  customStart?: string;
  customEnd?: string;
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
    case 'next24h': {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      return { start: today, end: tomorrow };
    }
    case 'next7d': {
      const weekOut = format(addDays(new Date(), 7), 'yyyy-MM-dd');
      return { start: today, end: weekOut };
    }
    case 'custom':
      return {
        start: options.customStart || today,
        end: options.customEnd || format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      };
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

      // Fetch bookings (capped at 200 for performance)
      const { data: bookings, error: bErr } = await supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_time, coach_name, intro_owner, intro_owner_locked, phone, email, lead_source, is_vip, vip_class_name, originating_booking_id, booking_status_canon')
        .is('deleted_at', null)
        .gte('class_date', start)
        .lte('class_date', end)
        .not('booking_status_canon', 'eq', 'PURCHASED')
        .order('class_date', { ascending: true })
        .order('intro_time', { ascending: true })
        .limit(200);

      if (bErr) throw bErr;
      if (!bookings || bookings.length === 0) {
        setItems([]);
        setCapped(false);
        setLastSyncAt(new Date().toISOString());
        return;
      }
      setCapped(bookings.length >= 200);

      const bookingIds = bookings.map(b => b.id);

      // Parallel fetch questionnaires, runs, confirmations
      const [qRes, runRes, confirmRes] = await Promise.all([
        supabase
          .from('intro_questionnaires')
          .select('booking_id, status, submitted_at, created_at')
          .in('booking_id', bookingIds),
        supabase
          .from('intros_run')
          .select('linked_intro_booked_id, result, created_at')
          .in('linked_intro_booked_id', bookingIds)
          .limit(500),
        supabase
          .from('script_actions')
          .select('booking_id, completed_at')
          .in('booking_id', bookingIds)
          .eq('action_type', 'confirmation_sent'),
      ]);

      // Build lookup maps - prioritize completed questionnaires
      const qMap = new Map<string, { status: string; submitted_at: string | null; created_at: string }>();
      for (const q of (qRes.data || [])) {
        if (!q.booking_id) continue;
        const existing = qMap.get(q.booking_id);
        const isCompleted = q.status === 'completed' || q.status === 'submitted';
        if (!existing || isCompleted) {
          qMap.set(q.booking_id, { status: q.status, submitted_at: q.submitted_at, created_at: q.created_at });
        }
      }

      const runMap = new Map<string, { result: string; created_at: string }>();
      for (const r of (runRes.data || [])) {
        if (!r.linked_intro_booked_id) continue;
        const existing = runMap.get(r.linked_intro_booked_id);
        if (!existing || r.created_at > existing.created_at) {
          runMap.set(r.linked_intro_booked_id, { result: r.result, created_at: r.created_at });
        }
      }

      const confirmMap = new Map<string, string>();
      for (const c of (confirmRes.data || [])) {
        if (c.booking_id) confirmMap.set(c.booking_id, c.completed_at);
      }

      // Check for second intros
      const allOriginatingIds = bookings
        .map(b => b.originating_booking_id)
        .filter(Boolean) as string[];
      const originatingSet = new Set(allOriginatingIds);

      // Build items
      const nowISO = new Date().toISOString();
      const rawItems: UpcomingIntroItem[] = bookings.map(b => {
        const q = deriveQStatus(qMap.get(b.id) || null);
        const run = runMap.get(b.id);
        // Ensure valid ISO string with canonical HH:mm
        const normalizedTime = normalizeDbTime(b.intro_time);
        const timePart = normalizedTime
          ? `${normalizedTime}:00`
          : '23:59:59';
        const timeStartISO = `${b.class_date}T${timePart}`;

        return {
          bookingId: b.id,
          memberName: b.member_name,
          classDate: b.class_date,
          introTime: b.intro_time,
          coachName: b.coach_name,
          introOwner: b.intro_owner,
          introOwnerLocked: b.intro_owner_locked ?? false,
          phone: b.phone,
          email: b.email,
          leadSource: b.lead_source,
          isVip: b.is_vip ?? false,
          vipClassName: b.vip_class_name,
          questionnaireStatus: q.status,
          qSentAt: q.sentAt,
          qCompletedAt: q.completedAt,
          confirmedAt: confirmMap.get(b.id) || null,
          hasLinkedRun: !!run,
          latestRunResult: run?.result || null,
          latestRunAt: run?.created_at || null,
          originatingBookingId: b.originating_booking_id,
          isSecondIntro: !!b.originating_booking_id || originatingSet.has(b.id),
          timeStartISO,
          // Will be enriched below
          riskFlags: { noQ: false, qIncomplete: false, unconfirmed: false, coachTbd: false, missingOwner: false },
          riskScore: 0,
        };
      });

      // Filter out items that already have a linked run (completed intros) and VIP bookings
      const activeItems = rawItems.filter(i => !i.hasLinkedRun && !i.isVip);

      // Enrich with risk and sort
      const enriched = enrichWithRisk(activeItems, nowISO);
      const sorted = sortRiskFirst(enriched);

      setItems(sorted);
      setLastSyncAt(new Date().toISOString());
    } catch (err) {
      console.error('useUpcomingIntrosData fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [options.timeRange, options.customStart, options.customEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { items, isLoading, lastSyncAt, isOnline, isCapped, refreshAll: fetchData };
}
