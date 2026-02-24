import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ALL_STAFF } from '@/types';

export interface SALeadMeasure {
  saName: string;
  speedToLead: number | null; // avg minutes
  qCompletionPct: number | null;
  prepRatePct: number | null;
  followUpTouches: number;
  dmsSent: number;
  leadsReachedOut: number;
}

interface UseLeadMeasuresOpts {
  startDate?: string;
  endDate?: string;
}

export function useLeadMeasures(opts?: UseLeadMeasuresOpts) {
  const [data, setData] = useState<SALeadMeasure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [opts?.startDate, opts?.endDate]);

  const load = async () => {
    setLoading(true);
    const start = opts?.startDate || '2020-01-01';
    const end = opts?.endDate || '2099-12-31';

    try {
      const [
        { data: bookings },
        { data: runs },
        { data: touches },
        { data: recaps },
        { data: leads },
        { data: activities },
      ] = await Promise.all([
        supabase.from('intros_booked')
          .select('id, sa_working_shift, booked_by, intro_owner, questionnaire_status_canon, prepped, class_date, is_vip, originating_booking_id, deleted_at')
          .gte('class_date', start).lte('class_date', end)
          .is('deleted_at', null),
        supabase.from('intros_run')
          .select('id, sa_name, intro_owner, run_date')
          .gte('run_date', start).lte('run_date', end),
        supabase.from('followup_touches')
          .select('id, created_by, created_at')
          .gte('created_at', start + 'T00:00:00').lte('created_at', end + 'T23:59:59'),
        supabase.from('shift_recaps')
          .select('staff_name, dms_sent')
          .gte('shift_date', start).lte('shift_date', end),
        supabase.from('leads')
          .select('id, created_at, stage, updated_at')
          .gte('created_at', start + 'T00:00:00').lte('created_at', end + 'T23:59:59'),
        supabase.from('lead_activities')
          .select('id, lead_id, activity_type, performed_by, created_at')
          .gte('created_at', start + 'T00:00:00').lte('created_at', end + 'T23:59:59'),
      ]);

      const allBookings = (bookings || []).filter((b: any) => !b.is_vip && !b.originating_booking_id);

      // Per-SA aggregation
      const saMap = new Map<string, {
        qTotal: number; qCompleted: number;
        prepTotal: number; prepDone: number;
        touches: number; dms: number; leadsReached: number;
        speedSumMin: number; speedCount: number;
      }>();

      const ensure = (name: string) => {
        if (!name || !ALL_STAFF.includes(name)) return;
        if (!saMap.has(name)) saMap.set(name, { qTotal: 0, qCompleted: 0, prepTotal: 0, prepDone: 0, touches: 0, dms: 0, leadsReached: 0, speedSumMin: 0, speedCount: 0 });
      };

      // Q completion & prep rate by SA
      allBookings.forEach((b: any) => {
        const sa = b.booked_by || b.intro_owner || '';
        if (!sa) return;
        ensure(sa);
        const s = saMap.get(sa)!;
        s.qTotal++;
        if (b.questionnaire_status_canon === 'completed') s.qCompleted++;
        s.prepTotal++;
        if (b.prepped) s.prepDone++;
      });

      // Follow-up touches
      (touches || []).forEach((t: any) => {
        const sa = t.created_by || '';
        if (!sa) return;
        ensure(sa);
        saMap.get(sa)!.touches++;
      });

      // DMs sent
      (recaps || []).forEach((r: any) => {
        const sa = r.staff_name || '';
        if (!sa || !r.dms_sent) return;
        ensure(sa);
        saMap.get(sa)!.dms += r.dms_sent;
      });

      // Speed to lead + leads reached out
      const leadFirstContact = new Map<string, { performer: string; contactTime: string }>();
      (activities || []).forEach((a: any) => {
        if (a.activity_type !== 'contacted' && a.activity_type !== 'call' && a.activity_type !== 'text' && a.activity_type !== 'dm' && a.activity_type !== 'email') return;
        if (!leadFirstContact.has(a.lead_id) || a.created_at < leadFirstContact.get(a.lead_id)!.contactTime) {
          leadFirstContact.set(a.lead_id, { performer: a.performed_by, contactTime: a.created_at });
        }
      });

      // Also check leads that moved from 'new' to 'contacted' via updated_at
      (leads || []).forEach((l: any) => {
        if (l.stage !== 'new') {
          // Lead was contacted - check if we have an activity for it
          if (!leadFirstContact.has(l.id)) {
            // Use updated_at as proxy
            leadFirstContact.set(l.id, { performer: '', contactTime: l.updated_at });
          }
        }
      });

      // Compute speed per SA
      leadFirstContact.forEach((contact, leadId) => {
        const lead = (leads || []).find((l: any) => l.id === leadId);
        if (!lead || !contact.performer) return;
        ensure(contact.performer);
        const s = saMap.get(contact.performer)!;
        s.leadsReached++;
        const diffMin = (new Date(contact.contactTime).getTime() - new Date(lead.created_at).getTime()) / 60000;
        if (diffMin > 0 && diffMin < 2880) { // < 48h
          s.speedSumMin += diffMin;
          s.speedCount++;
        }
      });

      const result: SALeadMeasure[] = Array.from(saMap.entries())
        .map(([saName, s]) => ({
          saName,
          speedToLead: s.speedCount > 0 ? Math.round(s.speedSumMin / s.speedCount) : null,
          qCompletionPct: s.qTotal > 0 ? Math.round((s.qCompleted / s.qTotal) * 100) : null,
          prepRatePct: s.prepTotal > 0 ? Math.round((s.prepDone / s.prepTotal) * 100) : null,
          followUpTouches: s.touches,
          dmsSent: s.dms,
          leadsReachedOut: s.leadsReached,
        }))
        .filter(s => (s.qCompletionPct !== null || s.followUpTouches > 0 || s.dmsSent > 0 || s.leadsReachedOut > 0))
        .sort((a, b) => (b.leadsReachedOut + b.followUpTouches + b.dmsSent) - (a.leadsReachedOut + a.followUpTouches + a.dmsSent));

      setData(result);
    } catch (err) {
      console.error('Lead measures fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading };
}
