/**
 * S2 outcome header on the shift checklist.
 *
 * Wires the "prospecting" standard's top of the section to the SAME
 * monthly targets and pace helper the WIG page reads
 * (`loadMonthlyTargets` + `paceToToday`). Never a second, separately
 * maintained number: change the target in WIG Admin and this moves too.
 *
 * Referrals metric: reuses `useSomlData` (booker-credited, sale-gated per
 * SOML). No per-SA monthly referral target exists, so target/pace render
 * as "—" and status is derived from whether the SA has any referrals
 * logged this month (0 → behind-pace prompt; >0 → on-pace prompt).
 *
 * Each metric shows a reflective prompt driven by statusColor(): behind
 * (red/yellow) → "what to do" question; on/ahead (green) → "keep going"
 * reinforcement. Same threshold as WIG so colors and prompts agree.
 */
import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { getNowCentral } from '@/lib/dateUtils';
import { loadMonthlyTargets, type MonthlyTargets } from '@/lib/wig/targets';
import { paceToToday, statusColor, statusClasses, formatPace, type WigStatus } from '@/lib/wig/pace';
import { useTrailingConversion, deriveBookedTargetFromSales } from '@/lib/wig/derivedBookedTarget';
import { useSaLeads } from '@/hooks/useSaLeads';
import { useSaAllBooked } from '@/hooks/useSaAllBooked';
import { useSaSales } from '@/hooks/useSaSales';
import { useSomlData } from '@/hooks/useSomlData';
import { ShiftTaskGuidanceIcon } from './ShiftTaskGuidanceIcon';
import { cn } from '@/lib/utils';
import { Target } from 'lucide-react';

// Must match the task_name attached to the outreach guidance playbook.
const OUTREACH_GUIDANCE_TASK = 'IG DMs sent this shift';

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

interface TileProps {
  label: string;
  current: number;
  target: number | null;
  pace: number | null;
  status: WigStatus;
  behindPrompt: string;
  onPacePrompt: string;
  guidanceTaskName?: string | null;
}

function MetricTile({
  label, current, target, pace, status,
  behindPrompt, onPacePrompt, guidanceTaskName,
}: TileProps) {
  const cls = statusClasses(status);
  const pct = target && target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const isBehind = status === 'red' || status === 'yellow';
  const prompt = isBehind ? behindPrompt : onPacePrompt;

  return (
    <div className="rounded-md border border-border bg-surface-card p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-text-secondary truncate">
          {label}
        </p>
        <div className="flex items-baseline gap-1 shrink-0">
          <span className={cn('text-lg font-black tabular-nums leading-none', cls.text)}>
            {current}
          </span>
          <span className="text-[10px] text-text-secondary">
            / {pace != null ? formatPace(pace) : '—'} today
          </span>
        </div>
      </div>
      <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', cls.bar)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-start gap-1.5">
        <p className={cn(
          'text-[11px] leading-snug flex-1',
          isBehind ? 'text-foreground font-medium' : 'text-text-secondary',
        )}>
          {prompt}
        </p>
        {isBehind && guidanceTaskName && (
          <ShiftTaskGuidanceIcon taskName={guidanceTaskName} />
        )}
      </div>
      <p className="text-[9px] text-text-secondary">
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
  const soml = useSomlData();

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

  // Referrals: count THIS SA's realized referrals with a realized date in the
  // current calendar month. Reuses useSomlData's booker-credited, sale-gated
  // ledger — no parallel counting rule.
  const myReferrals = useMemo(() => {
    if (!user?.name) return 0;
    return soml.realizedReferrals.filter(r =>
      r.sa === user.name && r.date && r.date >= start && r.date <= end,
    ).length;
  }, [soml.realizedReferrals, user?.name, start, end]);

  const { data: trailing } = useTrailingConversion();
  // Booked Intros target is DERIVED — sales goal ÷ (60d show × 60d close).
  // Single source of truth; the flat sa_leads_booked_target setting is ignored.
  const derivedBookedTarget = useMemo(
    () => deriveBookedTargetFromSales(targets.saSales, trailing),
    [targets.saSales, trailing],
  );

  const now = getNowCentral();
  const pace = {
    sgl: paceToToday(targets.saSgl, now),
    booked: paceToToday(derivedBookedTarget, now),
    sales: paceToToday(targets.saSales, now),
  };

  const status = {
    sgl: statusColor(mySgl, pace.sgl),
    booked: statusColor(myBooked, pace.booked),
    sales: statusColor(mySales, pace.sales),
    // Referrals have no per-SA monthly target. Treat 0 as behind, any as on-pace.
    referrals: (myReferrals === 0 ? 'red' : 'green') as WigStatus,
  };

  return (
    <div className="rounded-lg border border-brand/40 bg-brand/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Target className="w-3.5 h-3.5 text-brand" />
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand">
          Your WIG today — this is the scoreboard
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <MetricTile
          label="Self-gen leads"
          current={mySgl}
          target={targets.saSgl}
          pace={pace.sgl}
          status={status.sgl}
          behindPrompt="You're behind on leads today. Who's one person you could reach out to right now?"
          onPacePrompt="You're on pace on leads. What's working? Keep doing it."
          guidanceTaskName={OUTREACH_GUIDANCE_TASK}
        />
        <MetricTile
          label="Booked intros"
          current={myBooked}
          target={targets.saBooked}
          pace={pace.booked}
          status={status.booked}
          behindPrompt="You're behind on booked intros. Who in your pipeline could you follow up with in the next hour?"
          onPacePrompt="You're on pace on intros. Nice work, keep the momentum."
        />
        <MetricTile
          label="Sales"
          current={mySales}
          target={targets.saSales}
          pace={pace.sales}
          status={status.sales}
          behindPrompt="You're behind on sales today. Who's close to deciding? Give them a reason to say yes today."
          onPacePrompt="You're on pace on sales. Stay sharp through the next intro."
        />
        <MetricTile
          label="Referrals"
          current={myReferrals}
          target={null}
          pace={null}
          status={status.referrals}
          behindPrompt="No referrals logged yet today. Who's one member you could ask?"
          onPacePrompt="You're on pace on referrals. Keep asking, every booking is a chance."
        />
      </div>

      <p className="text-[11px] font-semibold text-foreground/90 leading-snug pt-1 border-t border-border">
        Bottom line: find a self-generated lead, book an intro, ask for a referral, get a sale.
      </p>
    </div>
  );
}
