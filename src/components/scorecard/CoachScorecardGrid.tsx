import { useMemo } from 'react';
import { useScorecards, type FvScorecard } from '@/hooks/useScorecards';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { cn, parseLocalDate } from '@/lib/utils';
import { format, startOfWeek, addWeeks, addDays } from 'date-fns';

const WEEK_COUNT = 6;
const PUSH_THRESHOLD = 25;

export type GridMode = 'best' | 'avg';
export type GridEvalType = 'self' | 'formal' | 'all';

interface Props {
  isPresentMode?: boolean;
  /** 'best' = max score that week (Meeting view default). 'avg' = mean. */
  mode?: GridMode;
  /** Filter the scorecards averaged into each cell. Defaults to 'all'. */
  evalType?: GridEvalType;
  /** Tap a cell to surface the underlying scorecards for that coach/week. */
  onCellTap?: (args: { coach: string; weekStart: Date; weekEnd: Date; cards: FvScorecard[] }) => void;
  /** Optional title override for the header strip. */
  title?: string;
  /** Optional subtitle override. */
  subtitle?: string;
}

interface WeekCol {
  start: Date;
  end: Date;
  key: string;
  label: string;
}

function buildWeeks(): WeekCol[] {
  const thisMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const firstMonday = addWeeks(thisMonday, -(WEEK_COUNT - 1));
  return Array.from({ length: WEEK_COUNT }, (_, i) => {
    const start = addWeeks(firstMonday, i);
    const end = addDays(start, 6);
    return {
      start,
      end,
      key: format(start, 'yyyy-MM-dd'),
      label: `Week of ${format(start, 'M/d')}`,
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

function aggregate(scores: number[], mode: GridMode): number {
  if (mode === 'best') return Math.max(...scores);
  const sum = scores.reduce((a, b) => a + b, 0);
  return sum / scores.length;
}

function formatScore(value: number, mode: GridMode): string {
  // Best mode is always an integer (0-30). Avg can have a decimal.
  return mode === 'best' ? `${Math.round(value)}/30` : `${value.toFixed(1)}/30`;
}

export function CoachScorecardGrid({
  isPresentMode = false,
  mode = 'best',
  evalType = 'all',
  onCellTap,
  title = 'Coach Lead Measure — First Visit Scorecard',
  subtitle,
}: Props) {
  const weeks = useMemo(buildWeeks, []);
  const from = format(weeks[0].start, 'yyyy-MM-dd');
  const to = format(weeks[weeks.length - 1].end, 'yyyy-MM-dd');
  const { data: scorecards = [] } = useScorecards({ from, to });
  const { coaches: activeCoaches, loading: staffLoading } = useActiveStaff();

  // coach -> week.key -> array of {score, card}
  const grid = useMemo(() => {
    const m = new Map<string, Map<string, FvScorecard[]>>();
    for (const c of activeCoaches) m.set(c, new Map());
    const wantType = evalType === 'self' ? 'self_eval' : evalType === 'formal' ? 'formal_eval' : null;
    for (const sc of scorecards as FvScorecard[]) {
      if (!sc.submitted_at) continue;
      if (wantType && sc.eval_type !== wantType) continue;
      const coach = sc.evaluatee_name;
      if (!m.has(coach)) continue; // skip inactive / non-coach evaluatees
      const d = parseLocalDate(sc.class_date);
      // Bucket by Mon–Sun (local). Use half-open interval [start, start+7) so
      // a Monday class lands in its own week, not the previous one.
      const wk = weeks.find(w => d >= w.start && d < addDays(w.start, 7));
      if (!wk) continue;
      const inner = m.get(coach)!;
      const arr = inner.get(wk.key) || [];
      arr.push(sc);
      inner.set(wk.key, arr);
    }
    return m;
  }, [scorecards, weeks, activeCoaches, evalType]);

  const resolvedSubtitle = subtitle ?? (
    mode === 'best'
      ? 'All coaches push to Level 3 (25+) on First Visit Scorecard'
      : `Average score per week${evalType === 'self' ? ' · Self evals' : evalType === 'formal' ? ' · Formal evals' : ''}`
  );

  const isInteractive = !!onCellTap;

  const renderCell = (coach: string, wk: WeekCol, presenting: boolean) => {
    const cards = grid.get(coach)?.get(wk.key) || [];
    if (cards.length === 0) {
      return (
        <span className={presenting ? 'text-destructive font-bold' : 'text-destructive font-bold'}>X</span>
      );
    }
    const scores = cards.map(c => c.total_score);
    const value = aggregate(scores, mode);
    const tipScores = scores.length > 1 ? `All scores this week: ${scores.join(', ')}` : `${scores[0]}/30`;
    const content = presenting ? (
      <span
        className={cn('font-semibold', colorForScore(value))}
        title={tipScores}
      >
        {formatScore(value, mode)}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5" title={tipScores}>
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full', dotForScore(value))} />
        <span className={cn('font-semibold', colorForScore(value))}>{formatScore(value, mode)}</span>
      </span>
    );
    if (!isInteractive) return content;
    return (
      <button
        type="button"
        onClick={() => onCellTap!({ coach, weekStart: wk.start, weekEnd: wk.end, cards })}
        className="inline-flex items-center justify-center px-1.5 min-h-[28px] rounded hover:bg-muted/60 cursor-pointer"
        title="Open scorecards for this week"
      >
        {content}
      </button>
    );
  };

  if (isPresentMode) {
    return (
      <div className="bg-white/10 rounded-xl p-4 overflow-x-auto">
        <p className="text-lg font-semibold text-primary mb-1">{title}</p>
        <p className="text-sm text-white/60 mb-3">{resolvedSubtitle}</p>
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
            {activeCoaches.map(coach => (
              <tr key={coach} className="border-b border-white/10">
                <td className="py-2 pr-3 font-medium">{coach}</td>
                {weeks.map(w => (
                  <td key={w.key} className="text-center py-2 px-2">{renderCell(coach, w, true)}</td>
                ))}
              </tr>
            ))}
            {!staffLoading && activeCoaches.length === 0 && (
              <tr><td colSpan={weeks.length + 1} className="text-center py-4 text-white/60">No active coaches.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <div className="px-3 py-2 border-b bg-muted/40">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[11px] text-muted-foreground">{resolvedSubtitle}</p>
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
          {activeCoaches.map(coach => (
            <tr key={coach} className="border-b border-border/30 last:border-0">
              <td className="py-1.5 px-2 font-medium">{coach}</td>
              {weeks.map(w => (
                <td key={w.key} className="text-center py-1.5 px-2">{renderCell(coach, w, false)}</td>
              ))}
            </tr>
          ))}
          {!staffLoading && activeCoaches.length === 0 && (
            <tr><td colSpan={weeks.length + 1} className="text-center py-3 text-muted-foreground">No active coaches.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
