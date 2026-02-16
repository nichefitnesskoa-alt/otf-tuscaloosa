import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, subWeeks, addDays } from 'date-fns';

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
  qCompletion: number;
  qCompletionPrev: number;
  followUpCompletion: number;
  followUpTotal: number;
  followUpCompleted: number;
  speedToLead: number;
  confirmationsSent: number;
  confirmationsTotal: number;
  newLeads: number;
  leadsContacted: number;
  leadsUncontacted: number;
  leadsBySource: Record<string, number>;
  objections: Record<string, number>;
  totalNonCloses: number;
  topObjection: string;
  outreach: { calls: number; texts: number; dms: number; emails: number };
  shoutouts: Shoutout[];
  biggestOpportunity: string;
  weekAhead: WeekAhead;
}

export interface Shoutout {
  category: string;
  name: string;
  metric: string;
  icon: string;
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

/** Get the Monday for the current meeting week */
export function getCurrentMeetingMonday(): Date {
  const now = new Date();
  // startOfWeek with weekStartsOn: 1 gives Monday
  return startOfWeek(now, { weekStartsOn: 1 });
}

/** Get the date range: previous Monday to Sunday */
export function getMeetingDateRange(meetingMonday: Date) {
  const start = subWeeks(meetingMonday, 1); // previous Monday
  const end = addDays(start, 6); // Sunday
  return { start, end };
}

export function useMeetingAgenda(meetingDate?: string) {
  const monday = meetingDate || format(getCurrentMeetingMonday(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['meeting_agenda', monday],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_agendas')
        .select('*')
        .eq('meeting_date', monday)
        .maybeSingle();
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
        .from('meeting_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
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
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as { meeting_date: string; metrics_snapshot: MeetingMetrics; wig_commitments: string | null } | null;
    },
    enabled: !!currentMeetingDate,
  });
}

export function useGenerateAgenda() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (meetingMonday: Date) => {
      const { start, end } = getMeetingDateRange(meetingMonday);
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      const meetingStr = format(meetingMonday, 'yyyy-MM-dd');

      // Previous week for comparison
      const prevStart = subWeeks(start, 1);
      const prevEnd = subWeeks(end, 1);
      const prevStartStr = format(prevStart, 'yyyy-MM-dd');
      const prevEndStr = format(prevEnd, 'yyyy-MM-dd');

      // Parallel data fetch
      const [
        introsBookedRes,
        introsRunRes,
        prevIntrosBookedRes,
        prevIntrosRunRes,
        followUpsRes,
        questionnairesRes,
        prevQuestionnairesRes,
        amcRes,
        prevAmcRes,
        shiftRecapsRes,
        leadsRes,
        scriptActionsRes,
        salesOutsideRes,
        nextWeekBookingsRes,
        nextWeekFollowUpsRes,
        nextWeekLeadsRes,
        vipEventsRes,
      ] = await Promise.all([
        supabase.from('intros_booked').select('id, member_name, lead_source, sa_working_shift, intro_owner, phone, class_date')
          .gte('class_date', startStr).lte('class_date', endStr).is('deleted_at', null).is('ignore_from_metrics', false),
        supabase.from('intros_run').select('id, member_name, result, sa_name, intro_owner, primary_objection, linked_intro_booked_id, run_date, buy_date, lead_source')
          .gte('run_date', startStr).lte('run_date', endStr).is('ignore_from_metrics', false),
        supabase.from('intros_booked').select('id')
          .gte('class_date', prevStartStr).lte('class_date', prevEndStr).is('deleted_at', null).is('ignore_from_metrics', false),
        supabase.from('intros_run').select('id, result, primary_objection')
          .gte('run_date', prevStartStr).lte('run_date', prevEndStr).is('ignore_from_metrics', false),
        supabase.from('follow_up_queue').select('id, status, sent_by, scheduled_date')
          .gte('scheduled_date', startStr).lte('scheduled_date', endStr),
        supabase.from('intro_questionnaires').select('id, status, booking_id')
          .gte('scheduled_class_date', startStr).lte('scheduled_class_date', endStr),
        supabase.from('intro_questionnaires').select('id, status')
          .gte('scheduled_class_date', prevStartStr).lte('scheduled_class_date', prevEndStr),
        supabase.from('amc_log').select('amc_value').order('created_at', { ascending: false }).limit(1),
        supabase.from('amc_log').select('amc_value').lte('logged_date', prevEndStr).order('created_at', { ascending: false }).limit(1),
        supabase.from('shift_recaps').select('staff_name, calls_made, texts_sent, dms_sent, emails_sent')
          .gte('shift_date', startStr).lte('shift_date', endStr),
        supabase.from('leads').select('id, source, created_at, stage')
          .gte('created_at', startStr + 'T00:00:00').lte('created_at', endStr + 'T23:59:59'),
        supabase.from('script_actions').select('action_type, completed_by, completed_at, booking_id, lead_id, script_category')
          .gte('completed_at', startStr + 'T00:00:00').lte('completed_at', endStr + 'T23:59:59'),
        supabase.from('sales_outside_intro').select('id, intro_owner, date_closed')
          .gte('date_closed', startStr).lte('date_closed', endStr),
        // Next week data
        supabase.from('intros_booked').select('id, class_date')
          .gte('class_date', meetingStr).lte('class_date', format(addDays(meetingMonday, 6), 'yyyy-MM-dd'))
          .is('deleted_at', null),
        supabase.from('follow_up_queue').select('id')
          .gte('scheduled_date', meetingStr).lte('scheduled_date', format(addDays(meetingMonday, 6), 'yyyy-MM-dd'))
          .eq('status', 'pending'),
        supabase.from('leads').select('id').in('stage', ['new', 'contacted']),
        supabase.from('vip_sessions').select('vip_class_name, session_date, capacity')
          .gte('session_date', meetingStr).lte('session_date', format(addDays(meetingMonday, 13), 'yyyy-MM-dd')),
      ]);

      const booked = introsBookedRes.data || [];
      const runs = introsRunRes.data || [];
      const prevBooked = prevIntrosBookedRes.data || [];
      const prevRuns = prevIntrosRunRes.data || [];
      const followUps = followUpsRes.data || [];
      const questionnaires = questionnairesRes.data || [];
      const prevQuestionnaires = prevQuestionnairesRes.data || [];
      const shiftRecaps = shiftRecapsRes.data || [];
      const leads = leadsRes.data || [];
      const scriptActions = scriptActionsRes.data || [];
      const salesOutside = salesOutsideRes.data || [];

      // Core metrics
      const EXCLUDED_SOURCES = ['Online Intro Offer (self-booked)', 'Run-first entry', 'Orangebook'];
      const filteredBooked = booked.filter(b => !EXCLUDED_SOURCES.includes(b.lead_source));
      const showed = runs.filter(r => r.result !== 'No-show');
      const sales = runs.filter(r => r.result === 'Purchased' || r.result === 'purchased');
      const totalSales = sales.length + salesOutside.length;

      const prevShowed = prevRuns.filter(r => r.result !== 'No-show');
      const prevSales = prevRuns.filter(r => r.result === 'Purchased' || r.result === 'purchased');

      const closeRate = showed.length > 0 ? (sales.length / showed.length) * 100 : 0;
      const prevCloseRate = prevShowed.length > 0 ? (prevSales.length / prevShowed.length) * 100 : 0;
      const showRate = filteredBooked.length > 0 ? (showed.length / filteredBooked.length) * 100 : 0;
      const prevFilteredBooked = prevBooked.length;
      const prevShowRate = prevFilteredBooked > 0 ? (prevShowed.length / prevFilteredBooked) * 100 : 0;

      // AMC
      const amc = amcRes.data?.[0]?.amc_value || 0;
      const prevAmc = prevAmcRes.data?.[0]?.amc_value || amc;

      // Q completion
      const qSubmitted = questionnaires.filter(q => q.status === 'submitted').length;
      const qCompletion = questionnaires.length > 0 ? (qSubmitted / questionnaires.length) * 100 : 0;
      const prevQSubmitted = prevQuestionnaires.filter((q: any) => q.status === 'submitted').length;
      const prevQCompletion = prevQuestionnaires.length > 0 ? (prevQSubmitted / prevQuestionnaires.length) * 100 : 0;

      // Follow-up completion
      const fuCompleted = followUps.filter(f => f.status === 'sent' || f.status === 'completed').length;

      // Speed-to-lead
      const firstContacts = scriptActions.filter(a => a.script_category === 'first_contact' && a.lead_id);
      let speedSum = 0, speedCount = 0;
      for (const contact of firstContacts) {
        const lead = leads.find((l: any) => l.id === contact.lead_id);
        if (lead) {
          const diff = (new Date(contact.completed_at).getTime() - new Date(lead.created_at).getTime()) / 60000;
          if (diff > 0 && diff < 1440) { speedSum += diff; speedCount++; }
        }
      }

      // Confirmations
      const confirmations = scriptActions.filter(a => a.script_category === 'booking_confirmation');
      const confirmationsTotal = booked.length;

      // Lead sources
      const leadsBySource: Record<string, number> = {};
      leads.forEach((l: any) => { leadsBySource[l.source] = (leadsBySource[l.source] || 0) + 1; });
      const contacted = leads.filter((l: any) => l.stage !== 'new').length;

      // Objections
      const objections: Record<string, number> = {};
      const nonCloses = runs.filter(r => r.result !== 'Purchased' && r.result !== 'purchased' && r.result !== 'No-show');
      nonCloses.forEach(r => {
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

      // Shoutouts
      const shoutouts = generateShoutouts(runs, followUps, shiftRecaps, questionnaires, booked, scriptActions, leads);

      // Biggest opportunity
      const noShowRate = filteredBooked.length > 0 ? ((filteredBooked.length - showed.length) / filteredBooked.length) * 100 : 0;
      let biggestOpportunity = '';
      if (noShowRate > 25) {
        const potentialExtra = Math.round((filteredBooked.length * 0.85 - showed.length) * (closeRate / 100));
        biggestOpportunity = `${filteredBooked.length - showed.length} no-shows this week. Improving show rate to 85% could mean ~${Math.max(potentialExtra, 1)} more sales at current close rate.`;
      } else if (closeRate < prevCloseRate - 3) {
        biggestOpportunity = `Close rate dropped ${(prevCloseRate - closeRate).toFixed(0)}% from last week. Focus on "${topObjection}" handling.`;
      } else if (qCompletion < 70) {
        biggestOpportunity = `Only ${qCompletion.toFixed(0)}% of intros had completed questionnaires. Prepped intros close at a significantly higher rate.`;
      } else if (speedCount > 0 && speedSum / speedCount > 30) {
        biggestOpportunity = `Average speed-to-lead is ${Math.round(speedSum / speedCount)} minutes. Leads contacted within 5 minutes book at a much higher rate.`;
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
        name: v.vip_class_name,
        date: v.session_date,
        count: v.capacity,
      }));

      const metrics: MeetingMetrics = {
        amc, amcChange: amc - prevAmc,
        sales: totalSales, salesPrev: prevSales.length,
        closeRate, closeRatePrev: prevCloseRate,
        showRate, showRatePrev: prevShowRate,
        booked: filteredBooked.length, showed: showed.length,
        noShows: filteredBooked.length - showed.length, noShowRate,
        qCompletion, qCompletionPrev: prevQCompletion,
        followUpCompletion: followUps.length > 0 ? (fuCompleted / followUps.length) * 100 : 0,
        followUpTotal: followUps.length, followUpCompleted: fuCompleted,
        speedToLead: speedCount > 0 ? Math.round(speedSum / speedCount) : 0,
        confirmationsSent: confirmations.length, confirmationsTotal,
        newLeads: leads.length,
        leadsContacted: contacted,
        leadsUncontacted: leads.length - contacted,
        leadsBySource, objections, totalNonCloses: nonCloses.length,
        topObjection, outreach, shoutouts, biggestOpportunity,
        weekAhead: {
          introsByDay, totalIntros: nextWeekBookings.length,
          followUpsDue: nextWeekFollowUpsRes.data?.length || 0,
          leadsInPipeline: nextWeekLeadsRes.data?.length || 0,
          vipEvents,
        },
      };

      // Upsert
      const { data: existing } = await supabase
        .from('meeting_agendas')
        .select('id')
        .eq('meeting_date', meetingStr)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('meeting_agendas')
          .update({ metrics_snapshot: metrics as any, date_range_start: startStr, date_range_end: endStr, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('meeting_agendas')
          .insert({ meeting_date: meetingStr, date_range_start: startStr, date_range_end: endStr, metrics_snapshot: metrics as any, status: 'draft' });
        if (error) throw error;
      }

      return metrics;
    },
    onSuccess: (_, meetingMonday) => {
      queryClient.invalidateQueries({ queryKey: ['meeting_agenda', format(meetingMonday, 'yyyy-MM-dd')] });
    },
  });
}

function generateShoutouts(
  runs: any[], followUps: any[], recaps: any[], questionnaires: any[], booked: any[], scriptActions: any[], leads: any[]
): Shoutout[] {
  const shoutouts: Shoutout[] = [];
  const usedNames = new Set<string>();

  // Per-SA stats from runs
  const saStats = new Map<string, { sales: number; showed: number; total: number }>();
  runs.forEach(r => {
    const name = r.sa_name || r.intro_owner || 'Unknown';
    if (!saStats.has(name)) saStats.set(name, { sales: 0, showed: 0, total: 0 });
    const s = saStats.get(name)!;
    s.total++;
    if (r.result !== 'No-show') s.showed++;
    if (r.result === 'Purchased' || r.result === 'purchased') s.sales++;
  });

  // Top closer (min 2 intros)
  let topCloser = { name: '', rate: 0, sales: 0, total: 0 };
  saStats.forEach((stats, name) => {
    if (stats.showed >= 2) {
      const rate = (stats.sales / stats.showed) * 100;
      if (rate > topCloser.rate) topCloser = { name, rate, sales: stats.sales, total: stats.showed };
    }
  });
  if (topCloser.name && !usedNames.has(topCloser.name)) {
    shoutouts.push({ category: 'Top Closer', name: topCloser.name, metric: `${topCloser.rate.toFixed(0)}% close rate (${topCloser.sales} of ${topCloser.total})`, icon: '🎯' });
    usedNames.add(topCloser.name);
  }

  // Most sales
  let topSales = { name: '', count: 0 };
  saStats.forEach((stats, name) => {
    if (stats.sales > topSales.count && !usedNames.has(name)) topSales = { name, count: stats.sales };
  });
  if (topSales.name && topSales.count > 0) {
    shoutouts.push({ category: 'Most Sales', name: topSales.name, metric: `${topSales.count} memberships sold`, icon: '💰' });
    usedNames.add(topSales.name);
  }

  // Best show rate from bookers
  const bookerStats = new Map<string, { booked: number; showed: number }>();
  booked.forEach((b: any) => {
    const name = b.intro_owner || b.sa_working_shift || 'Unknown';
    if (!bookerStats.has(name)) bookerStats.set(name, { booked: 0, showed: 0 });
    bookerStats.get(name)!.booked++;
  });
  runs.forEach(r => {
    const linkedBooking = booked.find((b: any) => b.id === r.linked_intro_booked_id);
    if (linkedBooking) {
      const name = linkedBooking.intro_owner || linkedBooking.sa_working_shift || 'Unknown';
      if (r.result !== 'No-show' && bookerStats.has(name)) bookerStats.get(name)!.showed++;
    }
  });
  let bestShowRate = { name: '', rate: 0, showed: 0, total: 0 };
  bookerStats.forEach((stats, name) => {
    if (stats.booked >= 2 && !usedNames.has(name)) {
      const rate = (stats.showed / stats.booked) * 100;
      if (rate > bestShowRate.rate) bestShowRate = { name, rate, showed: stats.showed, total: stats.booked };
    }
  });
  if (bestShowRate.name) {
    shoutouts.push({ category: 'Best Show Rate', name: bestShowRate.name, metric: `${bestShowRate.rate.toFixed(0)}% (${bestShowRate.showed} of ${bestShowRate.total} showed)`, icon: '📈' });
    usedNames.add(bestShowRate.name);
  }

  // Follow-up machine
  const fuBySa = new Map<string, { total: number; done: number }>();
  followUps.forEach((f: any) => {
    const name = f.sent_by || 'Unknown';
    if (!fuBySa.has(name)) fuBySa.set(name, { total: 0, done: 0 });
    fuBySa.get(name)!.total++;
    if (f.status === 'sent' || f.status === 'completed') fuBySa.get(name)!.done++;
  });
  let bestFu = { name: '', rate: 0, done: 0, total: 0 };
  fuBySa.forEach((stats, name) => {
    if (stats.total >= 2 && !usedNames.has(name)) {
      const rate = (stats.done / stats.total) * 100;
      if (rate > bestFu.rate) bestFu = { name, rate, done: stats.done, total: stats.total };
    }
  });
  if (bestFu.name && bestFu.done > 0) {
    shoutouts.push({ category: 'Follow-Up Machine', name: bestFu.name, metric: `${bestFu.done} of ${bestFu.total} follow-ups on time`, icon: '🔥' });
    usedNames.add(bestFu.name);
  }

  // Outreach leader
  const outreachBySa = new Map<string, number>();
  recaps.forEach((sr: any) => {
    const name = sr.staff_name;
    const total = (sr.calls_made || 0) + (sr.texts_sent || 0) + (sr.dms_sent || 0) + (sr.emails_sent || 0);
    outreachBySa.set(name, (outreachBySa.get(name) || 0) + total);
  });
  let topOutreach = { name: '', count: 0 };
  outreachBySa.forEach((count, name) => {
    if (count > topOutreach.count && !usedNames.has(name)) topOutreach = { name, count };
  });
  if (topOutreach.name && topOutreach.count > 0) {
    shoutouts.push({ category: 'Outreach Leader', name: topOutreach.name, metric: `${topOutreach.count} outreach touches`, icon: '📱' });
    usedNames.add(topOutreach.name);
  }

  return shoutouts.slice(0, 5);
}
