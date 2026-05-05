import { useMemo } from 'react';
import { useScorecards } from '@/hooks/useScorecards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import { format } from 'date-fns';
import type { DateRange } from '@/lib/pay-period';

export function WigFirstVisitSection({ dateRange }: { dateRange: DateRange }) {
  const from = format(dateRange.start, 'yyyy-MM-dd');
  const to = format(dateRange.end, 'yyyy-MM-dd');
  const { data: cards = [], isLoading } = useScorecards({ from, to });

  const { byLevel, perCoach } = useMemo(() => {
    const submitted = cards.filter(c => c.submitted_at);
    const byLevel = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>;
    const map: Record<string, { count: number; l3: number; total: number }> = {};
    submitted.forEach(c => {
      byLevel[c.level]++;
      const k = c.evaluatee_name;
      if (!map[k]) map[k] = { count: 0, l3: 0, total: 0 };
      map[k].count++;
      map[k].total += c.total_score;
      if (c.level === 3) map[k].l3++;
    });
    const perCoach = Object.entries(map)
      .map(([name, v]) => ({ name, ...v, avg: v.count ? v.total / v.count : 0 }))
      .sort((a, b) => b.l3 - a.l3 || b.avg - a.avg);
    return { byLevel, perCoach };
  }, [cards]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          First Visit Experience
        </CardTitle>
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
          <p className="text-xs text-muted-foreground text-center py-2">No scorecards in this period.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase text-muted-foreground">
                <th className="text-left font-medium py-1">Coach</th>
                <th className="text-center font-medium">Scored</th>
                <th className="text-center font-medium">L3</th>
                <th className="text-center font-medium">Avg</th>
              </tr>
            </thead>
            <tbody>
              {perCoach.map(r => (
                <tr key={r.name} className="border-t border-border">
                  <td className="py-1.5 font-medium">{r.name}</td>
                  <td className="text-center">{r.count}</td>
                  <td className="text-center text-primary font-semibold">{r.l3}</td>
                  <td className="text-center">{r.avg.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
