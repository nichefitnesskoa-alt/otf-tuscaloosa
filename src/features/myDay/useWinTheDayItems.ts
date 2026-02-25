/**
 * Hook that generates dynamic "Win the Day" checklist items
 * from live data: questionnaires, confirmations, prep, follow-ups, leads, shift recaps.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { format, addDays, differenceInHours, differenceInMinutes } from 'date-fns';
import { formatDisplayTime } from '@/lib/time/timeUtils';

export type ChecklistItemType =
  | 'q_send'
  | 'q_resend'
  | 'confirm_tomorrow'
  | 'prep_roleplay'
  | 'followups_due'
  | 'leads_overdue'
  | 'log_ig'
  | 'shift_recap';

export interface ChecklistItem {
  id: string;
  type: ChecklistItemType;
  text: string;
  actionLabel: string;
  completed: boolean;
  urgency: 'red' | 'amber' | 'normal' | 'low';
  /** Sort priority — lower = higher priority */
  sortOrder: number;
  /** Booking ID or lead ID for action routing */
  targetId?: string;
  /** Member name for display */
  memberName?: string;
  /** Class time for sorting by proximity */
  classTime?: string;
  /** Minutes until class starts (for priority) */
  minutesUntilClass?: number;
  /** Questionnaire link for copy */
  questionnaireLink?: string;
}

function getShiftEndHour(shiftType: string): number {
  if (shiftType.includes('AM')) return 13; // 1 PM
  if (shiftType.includes('Mid')) return 16; // 4 PM
  return 20; // 8 PM
}

function detectCurrentShift(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'AM Shift';
  if (hour < 16) return 'Mid Shift';
  return 'PM Shift';
}

export function useWinTheDayItems() {
  const { user } = useAuth();
  const { introsBooked, followUpQueue } = useData();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const userName = user?.name || '';

  const fetchItems = useCallback(async () => {
    if (!userName) return;
    setIsLoading(true);

    try {
      const now = new Date();
      const todayStart = todayStr + 'T00:00:00';
      const newItems: ChecklistItem[] = [];

      // ── 1. Fetch today's intros (non-VIP, non-deleted) ──
      const { data: todayIntros } = await supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_time, questionnaire_status_canon, questionnaire_link, prepped, originating_booking_id, class_start_at, booking_type_canon')
        .eq('class_date', todayStr)
        .is('deleted_at', null)
        .not('booking_type_canon', 'in', '("VIP","COMP")');

      // Fetch questionnaire slugs for today's bookings to build real links
      const todayBookingIds = (todayIntros || []).map(i => i.id);
      const { data: qRecords } = todayBookingIds.length > 0
        ? await supabase
            .from('intro_questionnaires')
            .select('booking_id, slug')
            .in('booking_id', todayBookingIds)
        : { data: [] };
      const qSlugByBooking = new Map<string, string>();
      for (const q of (qRecords || [])) {
        if (q.slug && q.booking_id) qSlugByBooking.set(q.booking_id, q.slug);
      }

      // ── 2. Fetch tomorrow's intros for confirmations ──
      const { data: tomorrowIntros } = await supabase
        .from('intros_booked')
        .select('id, member_name, intro_time, class_start_at')
        .eq('class_date', tomorrowStr)
        .is('deleted_at', null)
        .not('booking_type_canon', 'in', '("VIP","COMP")');

      // ── 3. Fetch today's confirmation script_actions ──
      const { data: todayConfirmations } = await supabase
        .from('script_actions')
        .select('booking_id')
        .eq('action_type', 'confirmation_sent')
        .gte('completed_at', todayStart);

      const confirmedIds = new Set((todayConfirmations || []).map(c => c.booking_id).filter(Boolean));

      // ── 4. Follow-ups due today ──
      const { data: followUpsDue } = await supabase
        .from('follow_up_queue')
        .select('id, status')
        .lte('scheduled_date', todayStr)
        .eq('status', 'pending');

      const fuDueCount = (followUpsDue || []).length;

      // ── 5. Overdue new leads ──
      const { data: newLeads } = await supabase
        .from('leads')
        .select('id, first_name, last_name, created_at, stage')
        .eq('stage', 'new')
        .neq('stage', 'archived');

      // ── 6. Today's IG/DM lead logs ──
      const { data: todayIgLeads } = await supabase
        .from('ig_leads')
        .select('id')
        .gte('created_at', todayStart)
        .eq('sa_name', userName)
        .limit(1);

      const hasLoggedIgToday = (todayIgLeads || []).length > 0;

      // ── 7. Shift recap submitted today ──
      const { data: todayRecap } = await supabase
        .from('shift_recaps')
        .select('id, submitted_at')
        .eq('staff_name', userName)
        .eq('shift_date', todayStr)
        .not('submitted_at', 'is', null)
        .limit(1);

      const recapSubmitted = (todayRecap || []).length > 0;

      // ── 8. Today's reflections (to mark items complete) ──
      const { data: todayReflections } = await supabase
        .from('win_the_day_reflections')
        .select('reflection_type, result, booking_id')
        .eq('reflection_date', todayStr);

      const reflectionsByBooking = new Map<string, string>();
      const reflectionsByType = new Set<string>();
      (todayReflections || []).forEach((r: any) => {
        if (r.booking_id) reflectionsByBooking.set(`${r.reflection_type}_${r.booking_id}`, r.result);
        reflectionsByType.add(r.reflection_type);
      });

      // ── 9. Today's followup daily log ──
      const { data: todayFuLog } = await supabase
        .from('followup_daily_log')
        .select('id')
        .eq('log_date', todayStr)
        .limit(1);

      const followupLogExists = (todayFuLog || []).length > 0;

      // ── BUILD ITEMS ──

      // Questionnaire sends & resends
      for (const intro of (todayIntros || [])) {
        if (intro.originating_booking_id) continue; // skip 2nd intros

        const classStartISO = intro.class_start_at || `${intro.class_date}T${intro.intro_time || '23:59'}:00`;
        const classStart = new Date(classStartISO);
        const minutesUntil = differenceInMinutes(classStart, now);
        const timeDisplay = formatDisplayTime(intro.intro_time);

        if (intro.questionnaire_status_canon === 'not_sent') {
          const qReflected = reflectionsByBooking.has(`questionnaire_outreach_${intro.id}`);
          newItems.push({
            id: `q_send_${intro.id}`,
            type: 'q_send',
            text: `Send questionnaire to ${intro.member_name} — ${timeDisplay}`,
            actionLabel: 'Copy Q Link',
            completed: qReflected,
            urgency: qReflected ? 'normal' : minutesUntil <= 120 ? 'amber' : 'normal',
            sortOrder: qReflected ? 9000 : minutesUntil <= 120 ? 200 + minutesUntil : 700 + minutesUntil,
            targetId: intro.id,
            memberName: intro.member_name,
            classTime: intro.intro_time || undefined,
            minutesUntilClass: minutesUntil,
            questionnaireLink: qSlugByBooking.has(intro.id)
              ? `https://otf-tuscaloosa.lovable.app/q/${qSlugByBooking.get(intro.id)}`
              : intro.questionnaire_link || undefined,
          });
        } else if (intro.questionnaire_status_canon === 'sent' && minutesUntil > 120) {
          const qReflected = reflectionsByBooking.has(`questionnaire_outreach_${intro.id}`);
          newItems.push({
            id: `q_resend_${intro.id}`,
            type: 'q_resend',
            text: `Resend questionnaire to ${intro.member_name} — hasn't answered yet`,
            actionLabel: 'Resend Script',
            completed: qReflected,
            urgency: 'normal',
            sortOrder: qReflected ? 9000 : 400 + minutesUntil,
            targetId: intro.id,
            memberName: intro.member_name,
            classTime: intro.intro_time || undefined,
            minutesUntilClass: minutesUntil,
          });
        }

        // Prep & role play
        if (!intro.prepped) {
          newItems.push({
            id: `prep_${intro.id}`,
            type: 'prep_roleplay',
            text: `Prep & role play ${intro.member_name} — ${timeDisplay}`,
            actionLabel: 'Open Prep Card',
            completed: false,
            urgency: minutesUntil <= 120 ? 'amber' : 'normal',
            sortOrder: minutesUntil <= 120 ? 300 + minutesUntil : 300 + minutesUntil,
            targetId: intro.id,
            memberName: intro.member_name,
            classTime: intro.intro_time || undefined,
            minutesUntilClass: minutesUntil,
          });
        } else {
          // Show completed prep item
          newItems.push({
            id: `prep_${intro.id}`,
            type: 'prep_roleplay',
            text: `Prep & role play ${intro.member_name} — ${timeDisplay}`,
            actionLabel: 'Open Prep Card',
            completed: true,
            urgency: 'normal',
            sortOrder: 9000,
            targetId: intro.id,
            memberName: intro.member_name,
          });
        }
      }

      // Booking confirmations for tomorrow
      for (const intro of (tomorrowIntros || [])) {
        const isConfirmed = confirmedIds.has(intro.id);
        const hasReflection = reflectionsByBooking.has(`booking_confirmation_${intro.id}`);
        const completed = isConfirmed || hasReflection;
        const timeDisplay = formatDisplayTime(intro.intro_time);
        newItems.push({
          id: `confirm_${intro.id}`,
          type: 'confirm_tomorrow',
          text: `Confirm ${intro.member_name}'s intro — tomorrow at ${timeDisplay}`,
          actionLabel: 'Send Confirmation',
          completed,
          urgency: 'normal',
          sortOrder: completed ? 9000 : 500,
          targetId: intro.id,
          memberName: intro.member_name,
        });
      }

      // Follow-ups due
      if (fuDueCount > 0) {
        newItems.push({
          id: 'followups_due',
          type: 'followups_due',
          text: `${fuDueCount} follow-up${fuDueCount !== 1 ? 's' : ''} due today`,
          actionLabel: 'Go to Follow-Ups',
          completed: followupLogExists,
          urgency: followupLogExists ? 'normal' : 'normal',
          sortOrder: followupLogExists ? 9000 : 600,
        });
      }

      // Overdue new leads
      const overdueLeads = (newLeads || []).filter(l => {
        const hoursOld = differenceInHours(now, new Date(l.created_at));
        return hoursOld >= 1;
      });
      if (overdueLeads.length > 0) {
        const maxHours = Math.max(...overdueLeads.map(l => differenceInHours(now, new Date(l.created_at))));
        const leadsReflected = reflectionsByType.has('new_leads_contact');
        newItems.push({
          id: 'leads_overdue',
          type: 'leads_overdue',
          text: `${overdueLeads.length} lead${overdueLeads.length !== 1 ? 's' : ''} waiting over 1 hour — contact now`,
          actionLabel: 'Go to New Leads',
          completed: leadsReflected,
          urgency: leadsReflected ? 'normal' : maxHours >= 4 ? 'red' : 'amber',
          sortOrder: leadsReflected ? 9000 : 100,
        });
      }

      // Log IG leads
      if (!hasLoggedIgToday) {
        newItems.push({
          id: 'log_ig',
          type: 'log_ig',
          text: 'Log any Instagram or social media leads from today',
          actionLabel: '+ Add Lead',
          completed: false,
          urgency: 'low',
          sortOrder: 800,
        });
      }

      // Shift recap (only in last 2 hours of shift)
      const currentShift = detectCurrentShift();
      const shiftEndHour = getShiftEndHour(currentShift);
      const hoursUntilEnd = shiftEndHour - now.getHours();
      if (hoursUntilEnd <= 2) {
        newItems.push({
          id: 'shift_recap',
          type: 'shift_recap',
          text: 'Submit your shift recap',
          actionLabel: 'End Shift',
          completed: recapSubmitted,
          urgency: recapSubmitted ? 'normal' : 'low',
          sortOrder: recapSubmitted ? 9000 : 900,
        });
      }

      // Sort by sortOrder
      newItems.sort((a, b) => a.sortOrder - b.sortOrder);

      setItems(newItems);
    } catch (err) {
      console.error('Win the Day fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userName, todayStr, tomorrowStr]);

  // Initial fetch
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Realtime subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('win-the-day')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intros_booked' }, () => fetchItems())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intro_questionnaires' }, () => fetchItems())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'script_actions' }, () => fetchItems())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follow_up_queue' }, () => fetchItems())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchItems())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_recaps' }, () => fetchItems())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ig_leads' }, () => fetchItems())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'win_the_day_reflections' }, () => fetchItems())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'followup_daily_log' }, () => fetchItems())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchItems]);

  const completedCount = items.filter(i => i.completed).length;
  const totalCount = items.length;
  const allComplete = totalCount > 0 && completedCount === totalCount;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return { items, isLoading, completedCount, totalCount, allComplete, progressPct, refresh: fetchItems };
}
