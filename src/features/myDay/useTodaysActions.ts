import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getTodayYMD } from '@/lib/dateUtils';

export interface ActionChip {
  id: string;
  kind: 'score' | 'follow_up_coach' | 'milestone' | 'referral_ask' | 'formal_eval';
  label: string;
  meta?: any;
  tone: 'primary' | 'amber' | 'green';
}

export function useTodaysActions(personName: string | null, role: 'Coach' | 'SA' | 'Admin' | null) {
  const [chips, setChips] = useState<ActionChip[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!personName || !role) { setChips([]); return; }
    setLoading(true);
    const today = getTodayYMD();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const next: ActionChip[] = [];

    if (role === 'Coach') {
      // Score chip — runs from yesterday/today by this coach without scorecard
      const { data: runs } = await supabase
        .from('intros_run')
        .select('id, member_name, run_date, coach_name, linked_intro_booked_id')
        .eq('coach_name', personName)
        .gte('run_date', yesterday)
        .lte('run_date', today);
      const runIds = (runs || []).map((r: any) => r.linked_intro_booked_id).filter(Boolean);
      let scoredBookingIds = new Set<string>();
      if (runIds.length > 0) {
        const { data: scs } = await supabase
          .from('fv_scorecards' as any)
          .select('first_timer_id')
          .in('first_timer_id', runIds);
        scoredBookingIds = new Set((scs || []).map((s: any) => s.first_timer_id));
      }
      (runs || []).forEach((r: any) => {
        if (r.linked_intro_booked_id && scoredBookingIds.has(r.linked_intro_booked_id)) return;
        next.push({
          id: 'score-' + r.id,
          kind: 'score',
          label: `Score ${r.member_name}'s intro`,
          meta: { runId: r.id, bookingId: r.linked_intro_booked_id, memberName: r.member_name },
          tone: 'primary',
        });
      });

      // Follow-up overdue (coach owner)
      const { data: fus } = await supabase
        .from('follow_up_queue')
        .select('id, person_name, scheduled_date, booking_id, lead_id')
        .eq('coach_owner', personName)
        .eq('owner_role', 'Coach')
        .is('not_interested_at', null)
        .is('transferred_to_sa_at', null)
        .lte('scheduled_date', today);
      (fus || []).forEach((f: any) => {
        next.push({
          id: 'fu-' + f.id,
          kind: 'follow_up_coach',
          label: `Follow up with ${f.person_name}`,
          meta: f,
          tone: 'amber',
        });
      });
    }

    if (role === 'SA') {
      // SA sales today owned by this person
      const { data: sales } = await supabase
        .from('intros_run')
        .select('id, member_name, buy_date, intro_owner, linked_intro_booked_id, result_canon')
        .eq('result_canon', 'SALE')
        .eq('intro_owner', personName)
        .eq('buy_date', today);

      const memberNames = (sales || []).map((s: any) => s.member_name);
      let milestonedNames = new Set<string>();
      if (memberNames.length > 0) {
        const { data: ms } = await supabase
          .from('milestones')
          .select('member_name')
          .in('member_name', memberNames);
        milestonedNames = new Set((ms || []).map((m: any) => (m.member_name || '').toLowerCase()));
      }

      const bookingIds = (sales || []).map((s: any) => s.linked_intro_booked_id).filter(Boolean);
      let askedSet = new Set<string>();
      if (bookingIds.length > 0) {
        const { data: bs } = await supabase
          .from('intros_booked')
          .select('id, coach_referral_asked')
          .in('id', bookingIds);
        askedSet = new Set((bs || []).filter((b: any) => b.coach_referral_asked === true).map((b: any) => b.id));
      }

      (sales || []).forEach((s: any) => {
        if (!milestonedNames.has((s.member_name || '').toLowerCase())) {
          next.push({
            id: 'ms-' + s.id,
            kind: 'milestone',
            label: `Mark milestone for ${s.member_name}`,
            meta: { memberName: s.member_name },
            tone: 'primary',
          });
        }
        if (s.linked_intro_booked_id && !askedSet.has(s.linked_intro_booked_id)) {
          next.push({
            id: 'ref-' + s.id,
            kind: 'referral_ask',
            label: `Log POS referral ask for ${s.member_name}`,
            meta: { bookingId: s.linked_intro_booked_id, memberName: s.member_name },
            tone: 'amber',
          });
        }
      });
    }

    setChips(next);
    setLoading(false);
  }, [personName, role]);

  useEffect(() => { fetch(); }, [fetch]);

  return { chips, loading, refresh: fetch };
}
