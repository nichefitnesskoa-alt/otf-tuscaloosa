import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { localDateToStartISO, localDateToEndISO } from '@/lib/dateUtils';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { didIntroActuallyRun } from '@/lib/canon/introRules';

export interface OutreachPerson {
  id: string;
  name: string;
  subtitle?: string;
  rightLabel?: string;
}

export interface SALeadMeasure {
  saName: string;
  speedToLead: number | null; // avg minutes
  qCompletionPct: number | null;
  qCompletedCount: number;
  prepRatePct: number | null;
  followUpTouches: number;
  leadsReachedOut: number;
  introsRan: number;
  // Per-metric drill data
  followUpPeople?: OutreachPerson[];
  leadsReachedPeople?: OutreachPerson[];
}

interface UseLeadMeasuresOpts {
  startDate?: string;
  endDate?: string;
}

// NOTE: DMs Sent was removed with the close-out ritual (Phase Four). Its
// only writer was CloseOutShift/MyDayShiftSummary via shift_recaps.dms_sent,
// both retired. Raw shift_recaps rows are preserved in the DB.
export function useLeadMeasures(opts?: UseLeadMeasuresOpts) {
  const [data, setData] = useState<SALeadMeasure[]>([]);
  const [loading, setLoading] = useState(true);
  const { allActive: ALL_STAFF, loading: staffLoading } = useActiveStaff();

  useEffect(() => {
    if (staffLoading) return;
    load();
  }, [opts?.startDate, opts?.endDate, staffLoading]);

  const load = async () => {
    setLoading(true);
    const start = opts?.startDate || '2020-01-01';
    const end = opts?.endDate || '2099-12-31';

    try {
      const [
        { data: bookings },
        { data: runs },
        { data: touches },
        { data: leads },
        { data: activities },
      ] = await Promise.all([
        supabase.from('intros_booked')
          .select('id, sa_working_shift, booked_by, intro_owner, prepped_by, questionnaire_status_canon, prepped, class_date, is_vip, originating_booking_id, referred_by_member_name, deleted_at')
          .gte('class_date', start).lte('class_date', end)
          .is('deleted_at', null),
        supabase.from('intros_run')
          .select('id, sa_name, intro_owner, run_date, result, result_canon, linked_intro_booked_id')
          .gte('run_date', start).lte('run_date', end),
        supabase.from('followup_touches')
          .select('id, created_by, created_at, lead_id, booking_id, channel')
          .gte('created_at', localDateToStartISO(start)).lte('created_at', localDateToEndISO(end)),
        supabase.from('leads')
          .select('id, first_name, last_name, source, created_at, stage, updated_at')
          .gte('created_at', localDateToStartISO(start)).lte('created_at', localDateToEndISO(end)),
        supabase.from('lead_activities')
          .select('id, lead_id, activity_type, performed_by, created_at')
          .gte('created_at', localDateToStartISO(start)).lte('created_at', localDateToEndISO(end)),
      ]);

      const allBookings = (bookings || []).filter((b: any) => !b.is_vip && (!b.originating_booking_id || b.referred_by_member_name));

      const showedBookingIds = new Set(
        (runs || []).filter((r: any) =>
          didIntroActuallyRun(r) && r.linked_intro_booked_id
        ).map((r: any) => r.linked_intro_booked_id)
      );

      const saMap = new Map<string, {
        qTotal: number; qCompleted: number;
        prepTotal: number; prepDone: number;
        touches: number; leadsReached: number;
        speedSumMin: number; speedCount: number; introsRan: number;
        followUpPeople: OutreachPerson[];
        leadsReachedPeople: OutreachPerson[];
      }>();

      const ensure = (name: string) => {
        if (!name || !ALL_STAFF.includes(name)) return;
        if (!saMap.has(name)) saMap.set(name, { qTotal: 0, qCompleted: 0, prepTotal: 0, prepDone: 0, touches: 0, leadsReached: 0, speedSumMin: 0, speedCount: 0, introsRan: 0, followUpPeople: [], leadsReachedPeople: [] });
      };

      const leadById = new Map<string, any>();
      (leads || []).forEach((l: any) => leadById.set(l.id, l));

      allBookings.forEach((b: any) => {
        const sa = [b.intro_owner, b.prepped_by].find(n => n && ALL_STAFF.includes(n)) || '';
        if (!sa) return;
        ensure(sa);
        const s = saMap.get(sa);
        if (!s) return;
        if (showedBookingIds.has(b.id)) {
          s.prepTotal++;
          if (b.prepped) s.prepDone++;
        }
      });

      const bookingMap = new Map<string, any>();
      allBookings.forEach((b: any) => bookingMap.set(b.id, b));

      (runs || []).forEach((r: any) => {
        if (!didIntroActuallyRun(r)) return;
        const sa = r.intro_owner || r.sa_name || '';
        if (!sa) return;
        ensure(sa);
        const entry = saMap.get(sa);
        if (entry) {
          entry.introsRan++;
          entry.qTotal++;
          const linkedBooking = r.linked_intro_booked_id ? bookingMap.get(r.linked_intro_booked_id) : null;
          if (linkedBooking?.questionnaire_status_canon === 'completed') {
            entry.qCompleted++;
          }
        }
      });

      (touches || []).forEach((t: any) => {
        const sa = t.created_by || '';
        if (!sa) return;
        ensure(sa);
        const entry = saMap.get(sa);
        if (entry) {
          entry.touches++;
          const lead = t.lead_id ? leadById.get(t.lead_id) : null;
          const name = lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Lead' : 'Touch';
          entry.followUpPeople.push({
            id: t.id,
            name,
            subtitle: `${t.channel || 'touch'} · ${new Date(t.created_at).toLocaleDateString()}`,
          });
        }
      });

      const leadFirstContact = new Map<string, { performer: string; contactTime: string }>();
      (activities || []).forEach((a: any) => {
        if (a.activity_type !== 'contacted' && a.activity_type !== 'call' && a.activity_type !== 'text' && a.activity_type !== 'dm' && a.activity_type !== 'email') return;
        if (!leadFirstContact.has(a.lead_id) || a.created_at < leadFirstContact.get(a.lead_id)!.contactTime) {
          leadFirstContact.set(a.lead_id, { performer: a.performed_by, contactTime: a.created_at });
        }
      });

      (leads || []).forEach((l: any) => {
        if (l.stage !== 'new') {
          if (!leadFirstContact.has(l.id)) {
            leadFirstContact.set(l.id, { performer: '', contactTime: l.updated_at });
          }
        }
      });

      leadFirstContact.forEach((contact, leadId) => {
        const lead = leadById.get(leadId);
        if (!lead || !contact.performer) return;
        ensure(contact.performer);
        const s = saMap.get(contact.performer);
        if (!s) return;
        s.leadsReached++;
        const diffMin = (new Date(contact.contactTime).getTime() - new Date(lead.created_at).getTime()) / 60000;
        if (diffMin > 0 && diffMin < 2880) {
          s.speedSumMin += diffMin;
          s.speedCount++;
        }
        const name = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Lead';
        s.leadsReachedPeople.push({
          id: leadId,
          name,
          subtitle: `${lead.source || 'Unknown source'}`,
          rightLabel: diffMin > 0 && diffMin < 2880 ? (diffMin < 60 ? `${Math.round(diffMin)}m` : `${Math.round(diffMin / 60)}h`) : undefined,
        });
      });

      const result: SALeadMeasure[] = Array.from(saMap.entries())
        .map(([saName, s]) => ({
          saName,
          speedToLead: s.speedCount > 0 ? Math.round(s.speedSumMin / s.speedCount) : null,
          qCompletionPct: s.qTotal > 0 ? Math.round((s.qCompleted / s.qTotal) * 100) : null,
          qCompletedCount: s.qCompleted,
          prepRatePct: s.prepTotal > 0 ? Math.round((s.prepDone / s.prepTotal) * 100) : null,
          followUpTouches: s.touches,
          leadsReachedOut: s.leadsReached,
          introsRan: s.introsRan,
          followUpPeople: s.followUpPeople,
          leadsReachedPeople: s.leadsReachedPeople,
        }))
        .filter(s => (s.qCompletionPct !== null || s.prepRatePct !== null || s.introsRan > 0 || s.followUpTouches > 0 || s.leadsReachedOut > 0))
        .sort((a, b) => (b.introsRan - a.introsRan) || ((b.prepRatePct ?? 0) - (a.prepRatePct ?? 0)));

      setData(result);
    } catch (err) {
      console.error('Lead measures fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading };
}
