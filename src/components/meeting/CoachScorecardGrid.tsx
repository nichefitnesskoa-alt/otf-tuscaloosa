import { useMemo } from 'react';
import { useScorecards, type FvScorecard } from '@/hooks/useScorecards';
import { COACHES } from '@/types';
import { cn } from '@/lib/utils';
import { format, startOfWeek, addWeeks, addDays } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

const WEEK_COUNT = 6;
const PUSH_THRESHOLD = 25;

interface Props {
  isPresentMode: boolean;
}

interface WeekCol {
  start: Date; // Monday CST
  end: Date;   // Sunday CST
  key: string; // yyyy-MM-dd of monday
  label: string;
}

function buildWeeks(): WeekCol[] {
  // Use local time which the app anchors to CST already
  const thisMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const firstMonday = addWeeks(thisMonday, -(WEEK_COUNT - 1));
  return Array.from({ length: WEEK_COUNT }, (_, i) => {
    const start = addWeeks(firstMonday, i);
    const end = addDays(start, 6);
    return {
      start,
      end,
      key: format(start, 'yyyy-MM-dd'),
      label: format(start, 'M/d'),
    };
  });
}

function colorForScore(total: number): string {
  if (total >= PUSH_THRESHOLD) return 'text-success';
  if (total >= 12) return 'text-warning';
  return 'text-destructive';
}

function dotForScore(total: number): string {
  if (total >= PUSH_THRESHOLD) return 'bg-success';
  if (total >= 12) return 'bg-warning';
  return 'bg-destructive';
}

export function CoachScorecardGrid({ isPresentMode }: Props) {
  const weeks = useMemo(buildWeeks, []);
  const from = format(weeks[0].start, 'yyyy-MM-dd');
  const to = format(weeks[weeks.length - 1].end, 'yyyy-MM-dd');
  const { data: scorecards = [] } = useScorecards({ from, to });

  // Map: coach -> week.key -> array of scores
  const grid = useMemo(() => {
    const m = new Map<string, Map<string, number[]>>();
    for (const c of COACHES) m.set(c, new Map());
    for (const sc of scorecards as FvScorecard[]) {
      const coach = sc.evaluatee_name;
      if (!m.has(coach)) continue; // only canonical coaches
      const d = parseLocalDate(sc.class_date);
      const wk = weeks.find(w => d >= w.start && d <= addDays(w.end, 1));
      if (!wk) continue;
      const inner = m.get(coach)!;
      const arr = inner.get(wk.key) || [];
      arr.push(sc.total_score);
      inner.set(wk.key, arr);
    }
    return m;
  }, [scorecards, weeks]);

  if (isPresentMode) {
    return (
      <div className="bg-white/10 rounded-xl p-4 overflow-x-auto">
        <p className="text-lg font-semibold text-primary mb-1">Coach Lead Measure — First Visit Scorecard</p>
        <p className="text-sm text-white/60 mb-3">All Coaches will increase to a Push Level (25+) on the First Visit Scorecard</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/20">
              <th className="text-left py-2 pr-3 text-white/60">Coach</th>
              {weeks.map(w => (
                <th key={w.key} className="text-center py-2 px-2 text-white/60 whitespace-nowrap">wk {w.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COACHES.map(coach => (
              <tr key={coach} className="border-b border-white/10">
                <td className="py-2 pr-3 font-medium">{coach}</td>
                {weeks.map(w => {
                  const scores = grid.get(coach)?.get(w.key) || [];
                  if (scores.length === 0) {
                    return <td key={w.key} className="text-center py-2 px-2 text-destructive font-bold">X</td>;
                  }
                  const best = Math.max(...scores);
                  return (
                    <td key={w.key} className={cn('text-center py-2 px-2 font-semibold', colorForScore(best))}
                        title={scores.length > 1 ? `All: ${scores.join(', ')}` : undefined}>
                      {best}/30
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <div className="px-3 py-2 border-b bg-muted/40">
        <p className="text-sm font-semibold">Coach Lead Measure — First Visit Scorecard</p>
        <p className="text-[11px] text-muted-foreground">All coaches push to Level 3 (25+) on First Visit Scorecard</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/20">
            <th className="text-left py-2 px-2 font-medium text-muted-foreground">Coach</th>
            {weeks.map(w => (
              <th key={w.key} className="text-center py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">
                wk {w.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COACHES.map(coach => (
            <tr key={coach} className="border-b border-border/30 last:border-0">
              <td className="py-1.5 px-2 font-medium">{coach}</td>
              {weeks.map(w => {
                const scores = grid.get(coach)?.get(w.key) || [];
                if (scores.length === 0) {
                  return (
                    <td key={w.key} className="text-center py-1.5 px-2 text-destructive font-bold">X</td>
                  );
                }
                const best = Math.max(...scores);
                return (
                  <td
                    key={w.key}
                    className="text-center py-1.5 px-2"
                    title={scores.length > 1 ? `All scores this week: ${scores.join(', ')}` : undefined}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn('inline-block w-1.5 h-1.5 rounded-full', dotForScore(best))} />
                      <span className={cn('font-semibold', colorForScore(best))}>{best}/30</span>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
