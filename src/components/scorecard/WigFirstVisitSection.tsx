import { useEffect, useMemo, useState } from 'react';
import { useScorecards } from '@/hooks/useScorecards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { DateRange } from '@/lib/pay-period';

export function WigFirstVisitSection({ dateRange }: { dateRange: DateRange }) {
  const from = format(dateRange.start, 'yyyy-MM-dd');
  const to = format(dateRange.end, 'yyyy-MM-dd');
  const { data: cards = [], isLoading } = useScorecards({ from, to });
  const [coachRanCounts, setCoachRanCounts] = useState<Record<string, number>>({});

  // Pull intros ran per coach (showed first intros, excluding VIP/no-show)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: bookings } = await supabase
        .from('intros_booked')
        .select('id, coach_name, originating_booking_id, is_vip, ignore_from_metrics, booking_status_canon, referred_by_member_name')
        .gte('class_date', from)
        .lte('class_date', to)
        .is('deleted_at', null);
      const valid = (bookings || []).filter((b: any) => {
        if (b.is_vip || b.ignore_from_metrics) return false;
        const s = (b.booking_status_canon || '').toUpperCase();
        if (s === 'DELETED_SOFT') return false;
        return !b.originating_booking_id || !!b.referred_by_member_name;
      });
      const ids = valid.map((b: any) => b.id);
      if (ids.length === 0) {
        if (!cancelled) setCoachRanCounts({});
        return;
      }
      const ranCoaches = new Map<string, string>(); // booking_id -> coach
      for (let i = 0; i < ids.length; i += 500) {
        const batch = ids.slice(i, i + 500);
        const { data: runs } = await supabase
          .from('intros_run')
          .select('linked_intro_booked_id, coach_name, result_canon')
          .in('linked_intro_booked_id', batch);
        (runs || []).forEach((r: any) => {
          if (r.result_canon === 'NO_SHOW' || r.result_canon === 'UNRESOLVED' || r.result_canon === 'VIP_CLASS_INTRO') return;
          const b = valid.find((x: any) => x.id === r.linked_intro_booked_id);
          const coach = r.coach_name || b?.coach_name;
          if (coach && !/^tbd$/i.test(coach.trim())) ranCoaches.set(r.linked_intro_booked_id, coach);
        });
      }
      const counts: Record<string, number> = {};
      ranCoaches.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
      if (!cancelled) setCoachRanCounts(counts);
    })();
    return () => { cancelled = true; };
  }, [from, to]);

  const { byLevel, perCoach } = useMemo(() => {
    const submitted = cards.filter(c => c.submitted_at);
    const byLevel = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>;
    const map: Record<string, { selfCount: number; selfTotal: number; formalCount: number; formalTotal: number; l3: number }> = {};
    submitted.forEach(c => {
      byLevel[c.level]++;
      const k = c.evaluatee_name;
      if (!map[k]) map[k] = { selfCount: 0, selfTotal: 0, formalCount: 0, formalTotal: 0, l3: 0 };
      if (c.eval_type === 'self_eval') {
        map[k].selfCount++;
        map[k].selfTotal += c.total_score;
      } else {
        map[k].formalCount++;
        map[k].formalTotal += c.total_score;
      }
      if (c.level === 3) map[k].l3++;
    });
    // Include coaches with ran intros even if no scorecards yet
    Object.keys(coachRanCounts).forEach(coach => {
      if (!map[coach]) map[coach] = { selfCount: 0, selfTotal: 0, formalCount: 0, formalTotal: 0, l3: 0 };
    });
    const perCoach = Object.entries(map)
      .map(([name, v]) => {
        const ran = coachRanCounts[name] || 0;
        const selfAvg = v.selfCount ? v.selfTotal / v.selfCount : null;
        const formalAvg = v.formalCount ? v.formalTotal / v.formalCount : null;
        const gap = selfAvg !== null && formalAvg !== null ? formalAvg - selfAvg : null;
        const scored = v.selfCount + v.formalCount;
        return { name, ran, scored, ...v, selfAvg, formalAvg, gap };
      })
      .sort((a, b) => b.ran - a.ran || b.l3 - a.l3);
    return { byLevel, perCoach };
  }, [cards, coachRanCounts]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          First Visit Experience
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Auto-counts every first intro each coach ran, then compares their self-score to the formal score from the floor.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Level 3" value={byLevel[3]} tone="primary" />
          <Stat label="Level 2" value={byLevel[2]} tone="success" />
          <Stat label="Level 1" value={byLevel[1]} tone="muted" />
        </div>
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-2">Loading…</p>
        ) : perCoach.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No intros ran in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase text-muted-foreground">
                  <th className="text-left font-medium py-1">Coach</th>
                  <th className="text-center font-medium">Ran</th>
                  <th className="text-center font-medium">Self</th>
                  <th className="text-center font-medium">Self Avg</th>
                  <th className="text-center font-medium">Formal</th>
                  <th className="text-center font-medium">Formal Avg</th>
                  <th className="text-center font-medium">Gap</th>
                  <th className="text-center font-medium">L3</th>
                </tr>
              </thead>
              <tbody>
                {perCoach.map(r => {
                  const gapColor = r.gap === null
                    ? 'text-muted-foreground'
                    : r.gap > 2 ? 'text-destructive' : r.gap < -2 ? 'text-success' : 'text-warning';
                  return (
                    <tr key={r.name} className="border-t border-border">
                      <td className="py-1.5 font-medium">{r.name}</td>
                      <td className="text-center">{r.ran}</td>
                      <td className="text-center">{r.selfCount}</td>
                      <td className="text-center">{r.selfAvg !== null ? r.selfAvg.toFixed(1) : '—'}</td>
                      <td className="text-center">{r.formalCount}</td>
                      <td className="text-center">{r.formalAvg !== null ? r.formalAvg.toFixed(1) : '—'}</td>
                      <td className={`text-center font-medium ${gapColor}`}>
                        {r.gap === null ? '—' : (r.gap > 0 ? '+' : '') + r.gap.toFixed(1)}
                      </td>
                      <td className="text-center text-primary font-semibold">{r.l3}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-[10px] text-muted-foreground mt-2 px-1">
              Gap = Formal Avg − Self Avg. Positive means the coach scored themselves easier than the floor did.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'primary' | 'success' | 'muted' }) {
  const cls = tone === 'primary' ? 'text-primary' : tone === 'success' ? 'text-success' : 'text-muted-foreground';
  return (
    <div className="rounded-md border border-border bg-card p-2 text-center">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-2xl font-black ${cls}`}>{value}</p>
    </div>
  );
}
