/**
 * S2 outcome header on the shift checklist.
 *
 * Wires the "prospecting" standard's top of the section to the SAME
 * monthly targets and pace helper the WIG page reads
 * (`loadMonthlyTargets` + `paceToToday`). Never a second, separately
 * maintained number: change the target in WIG Admin and this moves too.
 *
 * Shows THIS SA's month-to-date SGL / booked / sales vs today's pace slice
 * of the individual per-SA monthly target. Non-destructive: the underlying
 * s2 tasks (Comments Made, DMs sent, Texts sent) render below unchanged.
 */
import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { getNowCentral } from '@/lib/dateUtils';
import { loadMonthlyTargets, type MonthlyTargets } from '@/lib/wig/targets';
import { paceToToday, statusColor, statusClasses, formatPace } from '@/lib/wig/pace';
import { useSaLeads } from '@/hooks/useSaLeads';
import { useSaAllBooked } from '@/hooks/useSaAllBooked';
import { useSaSales } from '@/hooks/useSaSales';
import { cn } from '@/lib/utils';
import { Target } from 'lucide-react';

function monthRange(): { start: string; end: string; yyyymm: string } {
  const now = getNowCentral();
  const y = now.getFullYear();
  const m = now.getMonth();
  const startDate = new Date(y, m, 1);
  const endDate = new Date(y, m + 1, 0);
  return {
    start: format(startDate, 'yyyy-MM-dd'),
    end: format(endDate, 'yyyy-MM-dd'),
    yyyymm: format(startDate, 'yyyy-MM'),
  };
}

function Tile({
  label,
  current,
  target,
  pace,
}: {
  label: string;
  current: number;
  target: number | null;
  pace: number | null;
}) {
  const status = statusColor(current, pace);
  const cls = statusClasses(status);
  const pct = target && target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return (
    <div className="rounded-md border border-border bg-surface-card px-2.5 py-2 flex-1 min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wide text-text-secondary truncate">
        {label}
      </p>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className={cn('text-lg font-black tabular-nums leading-none', cls.text)}>
          {current}
        </span>
        <span className="text-[10px] text-text-secondary">
          / {pace != null ? formatPace(pace) : '—'} today
        </span>
      </div>
      <div className="w-full h-1 rounded-full bg-secondary overflow-hidden mt-1.5">
        <div className={cn('h-full rounded-full transition-all', cls.bar)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[9px] text-text-secondary mt-1">
        Month goal: <span className="font-bold text-text-primary">{target ?? '—'}</span>
      </p>
    </div>
  );
}

export function ShiftOutcomeHeader() {
  const { user } = useAuth();
  const { start, end, yyyymm } = useMemo(monthRange, []);
  const [targets, setTargets] = useState<MonthlyTargets>({
    saSgl: null, saBooked: null, saSales: null,
    coachClose: null, studioLeads: null, netGain: null,
  });

  useEffect(() => {
    (async () => setTargets(await loadMonthlyTargets(yyyymm)))();
    const handler = () => loadMonthlyTargets(yyyymm).then(setTargets);
    window.addEventListener('otf:dataChanged', handler);
    return () => window.removeEventListener('otf:dataChanged', handler);
  }, [yyyymm]);

  const sgl = useSaLeads(start, end);
  const booked = useSaAllBooked(start, end);
  const sales = useSaSales(start, end);

  const mySgl = useMemo(
    () => sgl.rows.find(r => r.sa === user?.name)?.count ?? 0,
    [sgl.rows, user?.name],
  );
  const myBooked = useMemo(
    () => booked.rows.find(r => r.sa === user?.name)?.count ?? 0,
    [booked.rows, user?.name],
  );
  const mySales = useMemo(
    () => sales.rows.find(r => r.sa === user?.name)?.count ?? 0,
    [sales.rows, user?.name],
  );

  const now = getNowCentral();
  const pace = {
    sgl: paceToToday(targets.saSgl, now),
    booked: paceToToday(targets.saBooked, now),
    sales: paceToToday(targets.saSales, now),
  };

  return (
    <div className="rounded-lg border border-brand/40 bg-brand/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Target className="w-3.5 h-3.5 text-brand" />
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand">
          Your WIG today — this is the scoreboard
        </p>
      </div>
      <div className="flex gap-2">
        <Tile label="Self-gen leads" current={mySgl} target={targets.saSgl} pace={pace.sgl} />
        <Tile label="Booked intros" current={myBooked} target={targets.saBooked} pace={pace.booked} />
        <Tile label="Sales" current={mySales} target={targets.saSales} pace={pace.sales} />
      </div>
      <p className="text-[10px] text-text-secondary leading-snug">
        Volume below (DMs, texts, comments) is <em>how</em> you get there — these numbers are <em>whether</em> you got there.
      </p>
    </div>
  );
}
