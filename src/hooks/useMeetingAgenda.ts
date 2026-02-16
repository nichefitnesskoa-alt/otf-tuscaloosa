import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, addDays, subWeeks, subDays, startOfDay } from 'date-fns';
import {
  EXCLUDED_LEAD_SOURCES, EXCLUDED_SA_NAMES,
  isPurchased, isNoShow,
} from '@/lib/studio-metrics';
import { isMembershipSale, getRunSaleDate } from '@/lib/sales-detection';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ShoutoutCategory {
  category: string;
  icon: string;
  entries: { name: string; metric: string }[];
}

/** Kept for backward-compat with old JSONB snapshots */
export interface Shoutout {
  category: string;
  name: string;
  metric: string;
  icon: string;
}

export interface MeetingMetrics {
  amc: number;
  amcChange: number;
  sales: number;
  salesPrev: number;
  closeRate: number;
  closeRatePrev: number;
  showRate: number;
  showRatePrev: number;
  booked: number;
  showed: number;
  noShows: number;
  noShowRate: number;
  /* Lead measures */
  qCompletion: number;
  qCompletionPrev: number;
  confirmationRate: number;
  followUpCompletionRate: number;
  followUpTotal: number;
  followUpCompleted: number;
  speedToLead: number;
  confirmationsSent: number;
  confirmationsTotal: number;
  /* Leads */
  newLeads: number;
  leadsContacted: number;
  leadsUncontacted: number;
  leadsBySource: Record<string, number>;
  /* Objections */
  objections: Record<string, number>;
  totalNonCloses: number;
  topObjection: string;
  /* Outreach */
  outreach: { calls: number; texts: number; dms: number; emails: number };
  /* Shoutouts */
  shoutoutCategories: ShoutoutCategory[];
  /** @deprecated kept for backward compat */
  shoutouts: Shoutout[];
  /* Insights */
  biggestOpportunity: string;
  weekAhead: WeekAhead;
}

export interface WeekAhead {
  introsByDay: Record<string, number>;
  totalIntros: number;
  followUpsDue: number;
  leadsInPipeline: number;
  vipEvents: { name: string; date: string; count: number }[];
}

export interface MeetingAgenda {
  id: string;
  meeting_date: string;
  date_range_start: string;
  date_range_end: string;
  metrics_snapshot: MeetingMetrics;
  manual_shoutouts: string | null;
  housekeeping_notes: string | null;
  wig_commitments: string | null;
  wig_target: string | null;
  drill_override: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Date helpers                                                       */
/* ------------------------------------------------------------------ */

/** Return the Monday that represents the upcoming (or current) meeting. */
export function getCurrentMeetingMonday(): Date {
  const now = new Date();
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  if (now.getDay() === 1) return startOfDay(monday);
  return startOfDay(addDays(monday, 7));
}

/** 7-day range ending the day before the meeting Monday. */
export function getMeetingDateRange(meetingMonday: Date) {
  const end = subDays(meetingMonday, 1);
  const start = subDays(end, 6);
  return { start, end };
}

/** Check if a run_date string falls within start/end date strings */
function isRunDateInStrRange(runDate: string | null | undefined, startStr: string, endStr: string): boolean {
  if (!runDate) return false;
  return runDate >= startStr && runDate <= endStr;
}

/** Check if a run qualifies as a sale within start/end date strings */
function isSaleInStrRange(run: { buy_date?: string | null; run_date?: string | null; result?: string; created_at?: string }, startStr: string, endStr: string): boolean {
  if (!isMembershipSale(run.result || '')) return false;
  const saleDate = run.buy_date || run.run_date || (run.created_at || '').split('T')[0];
  if (!saleDate) return false;
  return saleDate >= startStr && saleDate <= endStr;
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

export function useMeetingAgenda(meetingDate?: string) {
  const monday = meetingDate || format(getCurrentMeetingMonday(), 'yyyy-MM-dd');
  return useQuery({
    queryKey: ['meeting_agenda', monday],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_agendas').select('*')
        .eq('meeting_date', monday).maybeSingle();
      if (error) throw error;
      return data as unknown as MeetingAgenda | null;
    },
    staleTime: 30_000,
  });
}

export function useMeetingSettings() {
  return useQuery({
    queryKey: ['meeting_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data as { id: string; meeting_day: number; meeting_time: string } | null;
    },
    staleTime: 60_000,
  });
}

export function usePreviousMeetingAgenda(currentMeetingDate: string) {
  return useQuery({
    queryKey: ['meeting_agenda_prev', currentMeetingDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_agendas')
        .select('meeting_date, metrics_snapshot, wig_commitments')
        .lt('meeting_date', currentMeetingDate)
        .order('meeting_date', { ascending: false })
        .limit(1).maybeSingle();
      if (error) throw error;
      return data as unknown as { meeting_date: string; metrics_snapshot: MeetingMetrics; wig_commitments: string | null } | null;
    },
    enabled: !!currentMeetingDate,
  });
}

/* ------------------------------------------------------------------ */
/*  Generate mutation                                                  */
/* ------------------------------------------------------------------ */

interface GenerateOpts {
  meetingMonday: Date;
  customStart?: string;
  customEnd?: string;
}

export function useGenerateAgenda() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (opts: GenerateOpts | Date) => {
      const meetingMonday = opts instanceof Date ? opts : opts.meetingMonday;
      const meetingStr = format(meetingMonday, 'yyyy-MM-dd');

      let startStr: string, endStr: string;
      if (!(opts instanceof Date) && opts.customStart && opts.customEnd) {
        startStr = opts.customStart;
        endStr = opts.customEnd;
      } else {
        const { start, end } = getMeetingDateRange(meetingMonday);
        startStr = format(start, 'yyyy-MM-dd');
        endStr = format(end, 'yyyy-MM-dd');
      }

      // Previous period for comparison
      const prevEnd = subDays(new Date(startStr + 'T12:00:00'), 1);
      const dayCount = Math.round(
        (new Date(endStr + 'T12:00:00').getTime() - new Date(startStr + 'T12:00:00').getTime()) / 86400000
      );
      const prevStart = subDays(prevEnd, dayCount);
      const prevStartStr = format(prevStart, 'yyyy-MM-dd');
      const prevEndStr = format(prevEnd, 'yyyy-MM-dd');

      // ---- Parallel data fetch ----
      // CRITICAL: intros_run query broadened to fetch runs where EITHER run_date OR buy_date
      // falls in range, so follow-up purchases are not missed.
      const [
        introsBookedRes, introsRunRes,
        prevIntrosBookedRes, prevIntrosRunRes,
        followUpsRes, questionnairesRes, prevQuestionnairesRes,
        amcRes, prevAmcRes,
        shiftRecapsRes, leadsRes, scriptActionsRes, salesOutsideRes,
        nextWeekBookingsRes, nextWeekFollowUpsRes, nextWeekLeadsRes, vipEventsRes,
      ] = await Promise.all([
        supabase.from('intros_booked')
          .select('id, member_name, lead_source, sa_working_shift, intro_owner, booked_by, phone, class_date, is_vip, originating_booking_id, deleted_at, ignore_from_metrics, booking_status')
          .gte('class_date', startStr).lte('class_date', endStr),
        // Dual-date query: fetch runs where run_date OR buy_date is in range
        supabase.from('intros_run')
          .select('id, member_name, result, sa_name, intro_owner, primary_objection, linked_intro_booked_id, run_date, buy_date, commission_amount, lead_source, ignore_from_metrics, created_at')
          .or(`and(run_date.gte.${startStr},run_date.lte.${endStr}),and(buy_date.gte.${startStr},buy_date.lte.${endStr})`),
        supabase.from('intros_booked')
          .select('id, is_vip, originating_booking_id, deleted_at, ignore_from_metrics, lead_source, booking_status')
          .gte('class_date', prevStartStr).lte('class_date', prevEndStr),
        // Dual-date query for previous period too
        supabase.from('intros_run')
          .select('id, result, primary_objection, ignore_from_metrics, linked_intro_booked_id, run_date, buy_date, created_at')
          .or(`and(run_date.gte.${prevStartStr},run_date.lte.${prevEndStr}),and(buy_date.gte.${prevStartStr},buy_date.lte.${prevEndStr})`),
        supabase.from('follow_up_queue')
          .select('id, status, sent_by, scheduled_date, sent_at')
          .gte('scheduled_date', startStr).lte('scheduled_date', endStr),
        supabase.from('intro_questionnaires')
          .select('id, status, booking_id')
          .gte('scheduled_class_date', startStr).lte('scheduled_class_date', endStr),
        supabase.from('intro_questionnaires')
          .select('id, status')
          .gte('scheduled_class_date', prevStartStr).lte('scheduled_class_date', prevEndStr),
        supabase.from('amc_log').select('amc_value').order('created_at', { ascending: false }).limit(1),
        supabase.from('amc_log').select('amc_value').lte('logged_date', prevEndStr).order('created_at', { ascending: false }).limit(1),
        supabase.from('shift_recaps')
          .select('staff_name, calls_made, texts_sent, dms_sent, emails_sent')
          .gte('shift_date', startStr).lte('shift_date', endStr),
        supabase.from('leads').select('id, source, created_at, stage')
          .gte('created_at', startStr + 'T00:00:00').lte('created_at', endStr + 'T23:59:59'),
        supabase.from('script_actions')
          .select('action_type, completed_by, completed_at, booking_id, lead_id, script_category')
          .gte('completed_at', startStr + 'T00:00:00').lte('completed_at', endStr + 'T23:59:59'),
        supabase.from('sales_outside_intro').select('id, intro_owner, date_closed')
          .gte('date_closed', startStr).lte('date_closed', endStr),
        supabase.from('intros_booked').select('id, class_date')
          .gte('class_date', meetingStr).lte('class_date', format(addDays(meetingMonday, 6), 'yyyy-MM-dd'))
          .is('deleted_at', null),
        supabase.from('follow_up_queue').select('id')
          .gte('scheduled_date', meetingStr).lte('scheduled_date', format(addDays(meetingMonday, 6), 'yyyy-MM-dd'))
          .eq('status', 'pending'),
        supabase.from('leads').select('id').in('stage', ['new', 'contacted']),
        supabase.from('vip_sessions')
          .select('vip_class_name, session_date, capacity')
          .gte('session_date', meetingStr)
          .lte('session_date', format(addDays(meetingMonday, 13), 'yyyy-MM-dd')),
      ]);

      const allBooked = introsBookedRes.data || [];
      const allRuns = introsRunRes.data || [];
      const prevAllBooked = prevIntrosBookedRes.data || [];
      const prevAllRuns = prevIntrosRunRes.data || [];
      const followUps = followUpsRes.data || [];
      const questionnaires = questionnairesRes.data || [];
      const prevQuestionnaires = prevQuestionnairesRes.data || [];
      const shiftRecaps = shiftRecapsRes.data || [];
      const leads = leadsRes.data || [];
      const scriptActions = scriptActionsRes.data || [];
      const salesOutside = salesOutsideRes.data || [];

      // ---- Filter using same logic as dashboard (useDashboardMetrics) ----
      const EXCLUDED_STATUSES = ['Duplicate', 'Deleted (soft)', 'DEAD'];
      const filterBookings = (arr: any[]) => arr.filter((b: any) => {
        const status = ((b as any).booking_status || '').toUpperCase();
        const isExcludedStatus = EXCLUDED_STATUSES.some(s => status.includes(s.toUpperCase()));
        return !isExcludedStatus &&
          !b.ignore_from_metrics &&
          !b.is_vip &&
          !b.originating_booking_id;
      });

      const filteredBooked = filterBookings(allBooked);
      const prevFilteredBooked = filterBookings(prevAllBooked);

      const vipIds = new Set(allBooked.filter((b: any) => b.is_vip).map((b: any) => b.id));
      const filterRuns = (arr: any[]) => arr.filter((r: any) =>
        !r.ignore_from_metrics &&
        !(r.linked_intro_booked_id && vipIds.has(r.linked_intro_booked_id))
      );

      const runs = filterRuns(allRuns);
      const prevRuns = filterRuns(prevAllRuns);

      // Build first-intro booking ID sets (matching dashboard logic)
      const firstIntroBookingIds = new Set(filteredBooked.map((b: any) => b.id));
      const prevFirstIntroBookingIds = new Set(prevFilteredBooked.map((b: any) => b.id));

      // Filter runs to first-intro bookings only (or unlinked), matching dashboard
      const firstIntroRuns = runs.filter((r: any) =>
        !r.linked_intro_booked_id || firstIntroBookingIds.has(r.linked_intro_booked_id)
      );
      const prevFirstIntroRuns = prevRuns.filter((r: any) =>
        !r.linked_intro_booked_id || prevFirstIntroBookingIds.has(r.linked_intro_booked_id)
      );

      // Deduplicate showed by booking (one "showed" per booking, matching dashboard)
      // Unlinked runs each count as one showed
      const countShowedAndSales = (filteredRuns: any[], start: string, end: string) => {
        const byBooking = new Map<string, any[]>();
        const unlinked: any[] = [];
        filteredRuns.forEach((r: any) => {
          if (r.linked_intro_booked_id) {
            const existing = byBooking.get(r.linked_intro_booked_id) || [];
            existing.push(r);
            byBooking.set(r.linked_intro_booked_id, existing);
          } else {
            unlinked.push(r);
          }
        });

        let showedCount = 0;
        let salesCount = 0;

        // Linked: one showed per booking, check any run for sale
        byBooking.forEach((bookingRuns) => {
          const sorted = [...bookingRuns].sort((a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          const first = sorted[0];
          if (first && !isNoShow(first.result) && isRunDateInStrRange(first.run_date, start, end)) {
            showedCount++;
          }
          const saleRun = bookingRuns.find((r: any) => isSaleInStrRange(r, start, end));
          if (saleRun) salesCount++;
        });

        // Unlinked: each counts individually
        unlinked.forEach((r: any) => {
          if (!isNoShow(r.result) && isRunDateInStrRange(r.run_date, start, end)) showedCount++;
          if (isSaleInStrRange(r, start, end)) salesCount++;
        });

        return { showedCount, salesCount };
      };

      const { showedCount: showedLen, salesCount: salesLen } = countShowedAndSales(firstIntroRuns, startStr, endStr);
      const { showedCount: prevShowedLen, salesCount: prevSalesLen } = countShowedAndSales(prevFirstIntroRuns, prevStartStr, prevEndStr);

      // Keep arrays for downstream use (objections, shoutouts still need full run list)
      const showed = runs.filter((r: any) => !isNoShow(r.result) && isRunDateInStrRange(r.run_date, startStr, endStr));
      const sales = runs.filter((r: any) => isSaleInStrRange(r, startStr, endStr));
      const totalSales = salesLen + salesOutside.length;

      // Close Rate = Sales / Showed (both deduplicated to first-intro bookings)
      const closeRate = showedLen > 0 ? (salesLen / showedLen) * 100 : 0;
      const prevCloseRate = prevShowedLen > 0 ? (prevSalesLen / prevShowedLen) * 100 : 0;
      const showRate = filteredBooked.length > 0 ? (showedLen / filteredBooked.length) * 100 : 0;
      const prevShowRate = prevFilteredBooked.length > 0 ? (prevShowedLen / prevFilteredBooked.length) * 100 : 0;

      // AMC
      const amc = amcRes.data?.[0]?.amc_value || 0;
      const prevAmc = prevAmcRes.data?.[0]?.amc_value || amc;

      // Q completion
      const qSubmitted = questionnaires.filter((q: any) => q.status === 'submitted' || q.status === 'completed').length;
      const qCompletion = questionnaires.length > 0 ? (qSubmitted / questionnaires.length) * 100 : 0;
      const prevQSubmitted = prevQuestionnaires.filter((q: any) => q.status === 'submitted' || q.status === 'completed').length;
      const prevQCompletion = prevQuestionnaires.length > 0 ? (prevQSubmitted / prevQuestionnaires.length) * 100 : 0;

      // Confirmation rate
      const confirmationActions = scriptActions.filter((a: any) =>
        a.action_type === 'script_sent' && (a.script_category === 'booking_confirmation' || a.script_category === 'confirmation')
      );
      const confirmationRate = filteredBooked.length > 0 ? (confirmationActions.length / filteredBooked.length) * 100 : 0;

      // Follow-up completion
      const fuCompleted = followUps.filter((f: any) => f.status === 'sent' || f.status === 'completed').length;
      const followUpCompletionRate = followUps.length > 0 ? (fuCompleted / followUps.length) * 100 : 0;

      // Speed-to-lead
      const firstContacts = scriptActions.filter((a: any) => a.script_category === 'first_contact' && a.lead_id);
      let speedSum = 0, speedCount = 0;
      for (const contact of firstContacts) {
        const lead = leads.find((l: any) => l.id === contact.lead_id);
        if (lead) {
          const diff = (new Date(contact.completed_at).getTime() - new Date(lead.created_at).getTime()) / 60000;
          if (diff > 0 && diff < 1440) { speedSum += diff; speedCount++; }
        }
      }

      // Lead sources
      const leadsBySource: Record<string, number> = {};
      leads.forEach((l: any) => { leadsBySource[l.source] = (leadsBySource[l.source] || 0) + 1; });
      const contacted = leads.filter((l: any) => l.stage !== 'new').length;

      // Objections — only from runs whose run_date is in range (booking metric)
      const objections: Record<string, number> = {};
      const nonCloses = runs.filter((r: any) => !isPurchased(r.result) && !isNoShow(r.result) && isRunDateInStrRange(r.run_date, startStr, endStr));
      nonCloses.forEach((r: any) => {
        const obj = r.primary_objection || 'Unknown';
        objections[obj] = (objections[obj] || 0) + 1;
      });
      const topObjection = Object.entries(objections).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Think About It';

      // Outreach
      const outreach = { calls: 0, texts: 0, dms: 0, emails: 0 };
      shiftRecaps.forEach((sr: any) => {
        outreach.calls += sr.calls_made || 0;
        outreach.texts += sr.texts_sent || 0;
        outreach.dms += sr.dms_sent || 0;
        outreach.emails += sr.emails_sent || 0;
      });

      // Shoutouts — top 3 per category, using dual-date logic
      const shoutoutCategories = generateShoutoutCategories(runs, allBooked, shiftRecaps, followUps, salesOutside, startStr, endStr);

      // Flatten for backward compat
      const shoutouts: Shoutout[] = shoutoutCategories.flatMap(cat =>
        cat.entries.map((e, i) => ({
          category: cat.category, name: e.name, metric: e.metric,
          icon: i === 0 ? cat.icon : (i === 1 ? '🥈' : '🥉'),
        }))
      );

      // Biggest opportunity
      const noShowRate = filteredBooked.length > 0 ? ((filteredBooked.length - showedLen) / filteredBooked.length) * 100 : 0;
      let biggestOpportunity = '';
      if (noShowRate > 25) {
        const extra = Math.round((filteredBooked.length * 0.85 - showedLen) * (closeRate / 100));
        biggestOpportunity = `${filteredBooked.length - showed.length} no-shows this week. Improving show rate to 85% could mean ~${Math.max(extra, 1)} more sales.`;
      } else if (closeRate < prevCloseRate - 3) {
        biggestOpportunity = `Close rate dropped ${(prevCloseRate - closeRate).toFixed(0)}% from last week. Focus on "${topObjection}" handling.`;
      } else if (qCompletion < 70) {
        biggestOpportunity = `Only ${qCompletion.toFixed(0)}% of intros had completed questionnaires. Prepped intros close at a significantly higher rate.`;
      } else if (confirmationRate < 90) {
        biggestOpportunity = `Confirmation rate is ${confirmationRate.toFixed(0)}%. Confirmed intros show up more reliably — aim for 90%+.`;
      } else {
        biggestOpportunity = `Keep pushing! Studio is at ${amc} AMC. ${Math.max(400 - amc, 0)} away from 400.`;
      }

      // Week ahead
      const nextWeekBookings = nextWeekBookingsRes.data || [];
      const introsByDay: Record<string, number> = {};
      nextWeekBookings.forEach((b: any) => {
        const day = format(new Date(b.class_date + 'T12:00:00'), 'EEE');
        introsByDay[day] = (introsByDay[day] || 0) + 1;
      });

      const vipEvents = (vipEventsRes.data || []).map((v: any) => ({
        name: v.vip_class_name, date: v.session_date, count: v.capacity,
      }));

      const metrics: MeetingMetrics = {
        amc, amcChange: amc - prevAmc,
        sales: totalSales, salesPrev: prevSalesLen,
        closeRate, closeRatePrev: prevCloseRate,
        showRate, showRatePrev: prevShowRate,
        booked: filteredBooked.length, showed: showedLen,
        noShows: filteredBooked.length - showedLen, noShowRate,
        qCompletion, qCompletionPrev: prevQCompletion,
        confirmationRate,
        followUpCompletionRate,
        followUpTotal: followUps.length, followUpCompleted: fuCompleted,
        speedToLead: speedCount > 0 ? Math.round(speedSum / speedCount) : 0,
        confirmationsSent: confirmationActions.length,
        confirmationsTotal: filteredBooked.length,
        newLeads: leads.length, leadsContacted: contacted,
        leadsUncontacted: leads.length - contacted,
        leadsBySource, objections, totalNonCloses: nonCloses.length,
        topObjection, outreach,
        shoutoutCategories, shoutouts,
        biggestOpportunity,
        weekAhead: {
          introsByDay, totalIntros: nextWeekBookings.length,
          followUpsDue: nextWeekFollowUpsRes.data?.length || 0,
          leadsInPipeline: nextWeekLeadsRes.data?.length || 0,
          vipEvents,
        },
      };

      // Upsert
      const { data: existing } = await supabase
        .from('meeting_agendas').select('id')
        .eq('meeting_date', meetingStr).maybeSingle();

      if (existing) {
        const { error } = await supabase.from('meeting_agendas')
          .update({ metrics_snapshot: metrics as any, date_range_start: startStr, date_range_end: endStr, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('meeting_agendas')
          .insert({ meeting_date: meetingStr, date_range_start: startStr, date_range_end: endStr, metrics_snapshot: metrics as any, status: 'draft' });
        if (error) throw error;
      }

      return metrics;
    },
    onSuccess: (_, opts) => {
      const monday = opts instanceof Date ? opts : opts.meetingMonday;
      queryClient.invalidateQueries({ queryKey: ['meeting_agenda', format(monday, 'yyyy-MM-dd')] });
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Shoutout generation — top 3 per category                           */
/*  Uses dual-date logic: "showed" uses run_date, "sales" uses         */
/*  purchase date fallback (buy_date > run_date > created_at)          */
/* ------------------------------------------------------------------ */

const MIN_INTROS = 2;

function generateShoutoutCategories(
  runs: any[], booked: any[], recaps: any[], followUps: any[], salesOutside: any[],
  startStr: string, endStr: string,
): ShoutoutCategory[] {
  const categories: ShoutoutCategory[] = [];
  const ok = (n: string) => !!n && !EXCLUDED_SA_NAMES.includes(n);

  // Per-SA run stats — dual-date: "showed" by run_date, "sales" by sale date
  const saRun = new Map<string, { sales: number; showed: number; total: number }>();
  runs.forEach(r => {
    const name = r.sa_name || r.intro_owner || '';
    if (!ok(name)) return;
    if (!saRun.has(name)) saRun.set(name, { sales: 0, showed: 0, total: 0 });
    const s = saRun.get(name)!;
    // Only count as "showed" if run_date is in range
    if (!isNoShow(r.result) && isRunDateInStrRange(r.run_date, startStr, endStr)) {
      s.showed++;
      s.total++;
    }
    // Count as "sale" if sale date is in range
    if (isSaleInStrRange(r, startStr, endStr)) {
      s.sales++;
    }
  });

  // Add sales_outside_intro to per-SA sales count
  (salesOutside || []).forEach((so: any) => {
    const name = so.intro_owner || '';
    if (!ok(name)) return;
    if (!saRun.has(name)) saRun.set(name, { sales: 0, showed: 0, total: 0 });
    saRun.get(name)!.sales++;
  });

  // 1) Contacts Made
  const outreach = new Map<string, number>();
  recaps.forEach((sr: any) => {
    const n = sr.staff_name;
    if (!ok(n)) return;
    const t = (sr.calls_made || 0) + (sr.texts_sent || 0) + (sr.dms_sent || 0) + (sr.emails_sent || 0);
    outreach.set(n, (outreach.get(n) || 0) + t);
  });
  addCategory(categories, 'Contacts Made', '📱', outreach, (n, v) => `${v} contacts`);

  // 2) Booked
  const bookerC = new Map<string, number>();
  booked.forEach((b: any) => {
    const n = b.booked_by || b.sa_working_shift || b.intro_owner || '';
    if (!ok(n)) return;
    bookerC.set(n, (bookerC.get(n) || 0) + 1);
  });
  addCategory(categories, 'Booked', '📅', bookerC, (_, v) => `${v} booked`);

  // 3) Show Rate
  const showStat = new Map<string, { b: number; s: number }>();
  booked.forEach((bk: any) => {
    const n = bk.intro_owner || bk.sa_working_shift || '';
    if (!ok(n)) return;
    if (!showStat.has(n)) showStat.set(n, { b: 0, s: 0 });
    showStat.get(n)!.b++;
  });
  runs.forEach(r => {
    const linked = booked.find((b: any) => b.id === r.linked_intro_booked_id);
    if (linked && !isNoShow(r.result) && isRunDateInStrRange(r.run_date, startStr, endStr)) {
      const n = linked.intro_owner || linked.sa_working_shift || '';
      if (showStat.has(n)) showStat.get(n)!.s++;
    }
  });
  const showEntries = Array.from(showStat.entries())
    .filter(([_, s]) => s.b >= MIN_INTROS)
    .map(([n, s]) => ({ name: n, rate: (s.s / s.b) * 100, s: s.s, b: s.b }))
    .sort((a, b) => b.rate - a.rate).slice(0, 3);
  if (showEntries.length) {
    categories.push({
      category: 'Show Rate', icon: '📈',
      entries: showEntries.map(e => ({ name: e.name, metric: `${e.rate.toFixed(0)}% (${e.s} of ${e.b})` })),
    });
  }

  // 4) Intros Showed — only count runs whose run_date is in range
  const showedBy = new Map<string, number>();
  runs.forEach(r => {
    if (isNoShow(r.result)) return;
    if (!isRunDateInStrRange(r.run_date, startStr, endStr)) return;
    const n = r.sa_name || r.intro_owner || '';
    if (!ok(n)) return;
    showedBy.set(n, (showedBy.get(n) || 0) + 1);
  });
  addCategory(categories, 'Intros Showed', '🏃', showedBy, (_, v) => `${v} showed`);

  // 5) Close Rate — uses dual-date: sales by sale date, showed by run_date
  // Close Rate = Sales (purchase-date filtered) / Intros Showed (run-date filtered)
  // This can exceed 100% when follow-up purchases from previous periods
  // land in a period with fewer new intros. This is correct behavior.
  const crEntries = Array.from(saRun.entries())
    .filter(([_, s]) => s.showed >= MIN_INTROS)
    .map(([n, s]) => ({ name: n, rate: (s.sales / s.showed) * 100, sales: s.sales, showed: s.showed }))
    .sort((a, b) => b.rate - a.rate).slice(0, 3);
  if (crEntries.length) {
    categories.push({
      category: 'Close Rate', icon: '🎯',
      entries: crEntries.map(e => ({ name: e.name, metric: `${e.rate.toFixed(0)}% (${e.sales} of ${e.showed})` })),
    });
  }

  // 6) Total Sales — uses sale date for counting
  const salesEntries = Array.from(saRun.entries())
    .filter(([_, s]) => s.sales > 0)
    .sort((a, b) => b[1].sales - a[1].sales).slice(0, 3);
  if (salesEntries.length) {
    categories.push({
      category: 'Total Sales', icon: '💰',
      entries: salesEntries.map(([n, s]) => ({ name: n, metric: `${s.sales} sales` })),
    });
  }

  return categories;
}

function addCategory(
  cats: ShoutoutCategory[], name: string, icon: string,
  map: Map<string, number>, fmt: (n: string, v: number) => string,
) {
  const sorted = Array.from(map.entries())
    .filter(([_, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (sorted.length) {
    cats.push({ category: name, icon, entries: sorted.map(([n, v]) => ({ name: n, metric: fmt(n, v) })) });
  }
}
