/**
 * S2 outcome header on the shift checklist.
 *
 * Wires the SA's month-to-date leads to the monthly SGL target
 * (`loadMonthlyTargets`), but reads Sales and Referral Leads goals from
 * the SOML section (soml_config + soml_sa_goals) via the canonical
 * `useSomlEffectiveTargets` resolver — same numbers Koa sees on the WIG
 * page SOML section, no second calculation.
 *
 * Sales / Booked / Referrals tiles are scoped to the SOML window so
 * pace and totals agree with SomlSection.
 *
 * Booked Intros target is DERIVED from the SOML effective Sales goal ÷
 * trailing 60d show × 60d close conversion.
 *
 * Each metric shows a reflective prompt: behind (red/yellow) → "what to
 * do" question; on/ahead (green) → "keep going" reinforcement.
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
import { useSomlEffectiveTargets, somlPaceAnchor } from '@/lib/soml/effectiveTargets';
import { useEffectiveSglTargets } from '@/lib/wig/effectiveSglTarget';
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
        Goal: <span className="font-bold text-text-primary">{target ?? '—'}</span>
      </p>
    </div>
  );
}

export function ShiftOutcomeHeader() {
  const { user } = useAuth();
  const { start: monthStart, end: monthEnd, yyyymm } = useMemo(monthRange, []);
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

  // SOML effective per-SA goals — same resolver SomlSection uses.
  const somlTargets = useSomlEffectiveTargets();
  const soml = useSomlData();

  // SOML window scopes Sales / Booked / Referrals counts.
  const somlStart = somlTargets.config?.start_date ?? monthStart;
  const somlEnd = somlTargets.config?.end_date ?? monthEnd;

  // SGL stays on the current calendar month (separate monthly SGL target).
  const sgl = useSaLeads(monthStart, monthEnd);
  // Booked/Sales windowed to SOML so pace matches SomlSection.
  const booked = useSaAllBooked(somlStart, somlEnd);
  const sales = useSaSales(somlStart, somlEnd);

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

  // Referral Leads — count-at-booking-time, from the SAME per-SA
  // rollup SomlSection reads. Not "referrals that closed".
  const myReferralLeads = useMemo(
    () => soml.rows.find(r => r.sa === user?.name)?.referralLeads ?? 0,
    [soml.rows, user?.name],
  );

  // Effective per-SA SOML targets for THIS user.
  const salesTarget = useMemo(() => {
    if (!user?.name || somlTargets.loading || !somlTargets.config) return null;
    const v = somlTargets.effectiveFor(user.name, 'sales');
    return v > 0 ? Math.round(v * 10) / 10 : 0;
  }, [user?.name, somlTargets]);
  const referralLeadsTarget = useMemo(() => {
    if (!user?.name || somlTargets.loading || !somlTargets.config) return null;
    const v = somlTargets.effectiveFor(user.name, 'referralLeads');
    return v > 0 ? Math.round(v * 10) / 10 : 0;
  }, [user?.name, somlTargets]);

  const { data: trailing } = useTrailingConversion();
  // Booked Intros target = SOML effective sales ÷ (60d show × 60d close).
  const derivedBookedTarget = useMemo(
    () => deriveBookedTargetFromSales(salesTarget, trailing),
    [salesTarget, trailing],
  );

  const now = getNowCentral();
  const somlAnchor = useMemo(
    () => somlPaceAnchor(somlTargets.config, now),
    [somlTargets.config, now],
  );

  // Per-SA effective SGL target — reads the canonical helper (global goal,
  // per-SA overrides, and redistributed shortfall) so this tile can never
  // disagree with the WIG SA Leaderboard or SaWeeklyGoals.
  const sglTargets = useEffectiveSglTargets(yyyymm);
  const mySglTarget = user?.name ? sglTargets.effectiveFor(user.name) : null;

  // Pace helper matches SomlSection exactly: same paceToToday + capped-to-window anchor.
  const pace = {
    sgl: paceToToday(mySglTarget, now),
    booked: paceToToday(derivedBookedTarget, somlAnchor),
    sales: paceToToday(salesTarget, somlAnchor),
    referrals: paceToToday(referralLeadsTarget, somlAnchor),
  };

  const status = {
    sgl: statusColor(mySgl, pace.sgl),
    booked: statusColor(myBooked, pace.booked),
    sales: statusColor(mySales, pace.sales),
    referrals: statusColor(myReferralLeads, pace.referrals),
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
          target={mySglTarget != null ? Math.round(mySglTarget * 10) / 10 : null}
          pace={pace.sgl}
          status={status.sgl}
          behindPrompt="You're behind on leads today. Who's one person you could reach out to right now?"
          onPacePrompt="You're on pace on leads. What's working? Keep doing it."
          guidanceTaskName={OUTREACH_GUIDANCE_TASK}
        />
        <MetricTile
          label="Booked intros"
          current={myBooked}
          target={derivedBookedTarget}
          pace={pace.booked}
          status={status.booked}
          behindPrompt="You're behind on booked intros. Who in your pipeline could you follow up with in the next hour?"
          onPacePrompt="You're on pace on intros. Nice work, keep the momentum."
        />
        <MetricTile
          label="Sales"
          current={mySales}
          target={salesTarget}
          pace={pace.sales}
          status={status.sales}
          behindPrompt="You're behind on sales today. Who's close to deciding? Give them a reason to say yes today."
          onPacePrompt="You're on pace on sales. Stay sharp through the next intro."
        />
        <MetricTile
          label="Referral leads"
          current={myReferralLeads}
          target={referralLeadsTarget}
          pace={pace.referrals}
          status={status.referrals}
          behindPrompt="Behind on referral leads. Who's one member you could ask for a friend today?"
          onPacePrompt="You're on pace on referral leads. Keep asking, every booking is a chance."
        />
      </div>

      <p className="text-[11px] font-semibold text-foreground/90 leading-snug pt-1 border-t border-border">
        Bottom line: find a self-generated lead, book an intro, ask for a referral, get a sale.
      </p>
    </div>
  );
}

