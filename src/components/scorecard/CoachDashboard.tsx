import { useMemo, useState } from 'react';
import { useScorecards } from '@/hooks/useScorecards';
import { useFvTrendData } from '@/hooks/useFvTrendData';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { parseLocalDate, formatScorecardDate } from '@/lib/dateUtils';
import { ComparisonView } from './ComparisonView';
import { UnscoredDrillDown } from './UnscoredDrillDown';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip } from 'recharts';
import {
  getCadenceForDate,
  hasMetCadenceForWeek,
  cadenceStreakWeeks,
  isSelfEvalEveryWeekThisMonth,
} from '@/lib/scorecard/trends';
import { isScorecardScored } from '@/lib/scorecard/levels';

export function CoachDashboard({ coachName, allowPicker, coaches }: { coachName: string; allowPicker?: boolean; coaches?: string[] }) {
  const [selected, setSelected] = useState(coachName);
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const { data: scorecards = [], isLoading } = useScorecards({
    from: format(monthStart, 'yyyy-MM-dd'),
    to: format(monthEnd, 'yyyy-MM-dd'),
    evaluatee: selected,
  });
  const { data: trend = [] } = useScorecards({
    from: format(new Date(Date.now() - 90 * 86400_000), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
    evaluatee: selected,
  });
  // Pull broader window (current + last week submissions) for cadence eval status.
  const { data: cadenceCards = [] } = useScorecards({
    from: format(new Date(Date.now() - 60 * 86400_000), 'yyyy-MM-dd'),
    to: format(new Date(Date.now() + 7 * 86400_000), 'yyyy-MM-dd'),
    evaluatee: selected,
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [openUnscored, setOpenUnscored] = useState(false);

  // Ran first-intros this month, with unscored breakdown by coach.
  const fv = useFvTrendData({ start: monthStart, end: monthEnd }, 'self', false);
  const ranThisMonth = fv.data?.ranByCoach.get(selected) ?? 0;
  const unscoredForCoach = useMemo(
    () => (fv.data?.unscoredIntros ?? []).filter(i => i.coach === selected),
    [fv.data, selected]
  );
  const unscoredCount = unscoredForCoach.length;
  const scoredCount = Math.max(ranThisMonth - unscoredCount, 0);

  const submitted = scorecards.filter(s => !!s.submitted_at);
  const selfCount = submitted.filter(s => s.eval_type === 'self_eval').length;
  const formalCount = submitted.filter(s => s.eval_type === 'formal_eval').length;
  const avgScore = submitted.length ? (submitted.reduce((s, c) => s + c.total_score, 0) / submitted.length).toFixed(1) : '—';

  const cadence = getCadenceForDate();
  const met = hasMetCadenceForWeek(selected, cadenceCards, cadence.weekStart, cadence.weekEnd, cadence.type);
  const streak = cadenceStreakWeeks(selected, cadenceCards);
  const exceedsStandard = isSelfEvalEveryWeekThisMonth(selected, cadenceCards);

  const trendData = useMemo(() => {
    const byWeek: Record<string, { total: number; count: number; sortKey: string }> = {};
    trend.filter(s => !!s.submitted_at).forEach(s => {
      const d = parseLocalDate(s.class_date)!;
      const wk = format(d, 'MMM d');
      const sortKey = format(d, 'yyyy-MM-dd');
      if (!byWeek[wk]) byWeek[wk] = { total: 0, count: 0, sortKey };
      byWeek[wk].total += s.total_score;
      byWeek[wk].count += 1;
    });
    return Object.entries(byWeek)
      .map(([week, v]) => ({ week, avg: +(v.total / v.count).toFixed(1), sortKey: v.sortKey }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ week, avg }) => ({ week, avg }));
  }, [trend]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[110px] w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0,1,2,3].map(i => <Skeleton key={i} className="h-[88px]" />)}
        </div>
        <Skeleton className="h-[240px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {allowPicker && coaches && (
        <div className="flex items-center gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {coaches.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Lead measure: self-eval every ran intro this month. */}
      <Card className={`p-4 border-2 ${unscoredCount === 0 && ranThisMonth > 0 ? 'border-success/50 bg-success/5' : unscoredCount > 0 ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Lead measure</p>
            <p className="text-xl font-black mt-0.5">
              Self-eval every intro you run
              {unscoredCount === 0 && ranThisMonth > 0 && (
                <Badge className="ml-2 bg-success text-success-foreground text-[10px]">Caught up</Badge>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {ranThisMonth === 0
                ? 'No ran intros this month yet.'
                : unscoredCount === 0
                  ? `All ${ranThisMonth} ran intros scored this month. That's the standard.`
                  : `${unscoredCount} of ${ranThisMonth} ran intros still need a self-eval.`}
            </p>
          </div>
          {unscoredCount > 0 && (
            <button
              type="button"
              onClick={() => setOpenUnscored(true)}
              className="shrink-0 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-bold min-h-[44px]"
            >
              Score now →
            </button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t">
          Streak (alt-week cadence): <span className="font-bold text-primary">{streak} wk</span>
          {exceedsStandard && <span className="ml-2 text-success font-semibold">· Self-eval every week</span>}
        </p>
      </Card>


      {/* Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Avg score</p>
          <p className="text-3xl font-black tabular-nums">{avgScore}<span className="text-base text-muted-foreground">/30</span></p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Scored this month</p>
          <p className="text-3xl font-black tabular-nums">
            {scoredCount}<span className="text-base text-muted-foreground">/{ranThisMonth}</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">of ran 1st intros</p>
        </Card>
        <button
          type="button"
          onClick={() => unscoredCount > 0 && setOpenUnscored(true)}
          disabled={unscoredCount === 0}
          className="text-left"
        >
          <Card className={`p-4 h-full ${unscoredCount > 0 ? 'border-primary/40 bg-primary/5 hover:bg-primary/10 cursor-pointer' : ''}`}>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Unscored</p>
            <p className={`text-3xl font-black tabular-nums ${unscoredCount > 0 ? 'text-primary' : ''}`}>{unscoredCount}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {unscoredCount > 0 ? 'Tap to score →' : 'All caught up'}
            </p>
          </Card>
        </button>
        <Card className="p-4">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Self · Formal</p>
          <p className="text-3xl font-black tabular-nums">{selfCount}<span className="text-base text-muted-foreground"> · {formalCount}</span></p>
        </Card>
      </div>


      {/* Trend */}
      <Card className="p-4">
        <h3 className="font-bold text-sm mb-3">90-day trend (avg score)</h3>
        {trendData.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-8">
            Your trend line starts with your first scorecard. The studio is watching for what's possible.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 30]} tick={{ fontSize: 10 }} />
              <RTooltip />
              <Line type="monotone" dataKey="avg" stroke="hsl(var(--brand))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Recent */}
      <Card className="p-4">
        <h3 className="font-bold text-sm mb-3">Recent scorecards</h3>
        {submitted.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Nothing yet. Open the chip in My Day or score your next intro from Coach View.
          </p>
        ) : (
          <div className="space-y-2">
            {submitted.slice(0, 10).map(s => (
              <button
                key={s.id}
                onClick={() => setOpenId(s.id)}
                className="w-full flex items-center justify-between p-3 rounded-md border hover:bg-muted text-left transition-colors min-h-[44px]"
              >
                <div>
                  <p className="text-sm font-medium">
                    {s.first_timer_name || s.practice_name || 'First-Timer'} · {formatScorecardDate(s.class_date)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    by {s.evaluator_name} · <Badge variant="outline" className="text-[10px]">{s.eval_type === 'self_eval' ? 'Self' : 'Formal'}</Badge>
                    {s.reflection_text && s.eval_type === 'self_eval' && s.level === 1 && (
                      <span className="ml-1.5 text-[10px] text-primary font-semibold">· Reflection saved</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-black tabular-nums ${s.level === 3 ? 'text-primary' : s.level === 2 ? 'text-success' : 'text-muted-foreground'}`}>L{s.level}</span>
                  <p className="text-[10px] text-muted-foreground">{s.total_score}/30</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <ComparisonView scorecardId={openId} open={!!openId} onOpenChange={(o) => { if (!o) setOpenId(null); }} />
      <UnscoredDrillDown
        open={openUnscored}
        onOpenChange={setOpenUnscored}
        coach={selected}
        intros={unscoredForCoach}
      />

    </div>
  );
}
