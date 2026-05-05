import { useMemo, useState } from 'react';
import { useScorecards } from '@/hooks/useScorecards';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ComparisonView } from './ComparisonView';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip } from 'recharts';

const L3_TARGET = 6;

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
  const [openId, setOpenId] = useState<string | null>(null);

  const submitted = scorecards.filter(s => !!s.submitted_at);
  const l3Count = submitted.filter(s => s.level === 3).length;
  const l2Count = submitted.filter(s => s.level === 2).length;
  const l1Count = submitted.filter(s => s.level === 1).length;
  const avgScore = submitted.length ? (submitted.reduce((s, c) => s + c.total_score, 0) / submitted.length).toFixed(1) : '—';

  const trendData = useMemo(() => {
    const byWeek: Record<string, { total: number; count: number }> = {};
    trend.filter(s => !!s.submitted_at).forEach(s => {
      const wk = format(new Date(s.class_date), 'MMM d');
      if (!byWeek[wk]) byWeek[wk] = { total: 0, count: 0 };
      byWeek[wk].total += s.total_score;
      byWeek[wk].count += 1;
    });
    return Object.entries(byWeek).map(([week, v]) => ({ week, avg: +(v.total / v.count).toFixed(1) }));
  }, [trend]);

  return (
    <div className="space-y-4">
      {allowPicker && coaches && (
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {coaches.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {/* Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Level 3 this month</p>
          <p className="text-3xl font-black tabular-nums" style={{ color: 'hsl(20, 90%, 47%)' }}>{l3Count}<span className="text-base text-muted-foreground">/{L3_TARGET}</span></p>
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, (l3Count / L3_TARGET) * 100)}%` }} />
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Avg score</p>
          <p className="text-3xl font-black tabular-nums">{avgScore}<span className="text-base text-muted-foreground">/15</span></p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Total scored</p>
          <p className="text-3xl font-black tabular-nums">{submitted.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide">L1 / L2 / L3</p>
          <p className="text-2xl font-black tabular-nums">{l1Count} · {l2Count} · {l3Count}</p>
        </Card>
      </div>

      {/* Trend */}
      <Card className="p-4">
        <h3 className="font-bold text-sm mb-3">90-day trend (avg score)</h3>
        {trendData.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-8">No scorecards yet — first eval will start the trend.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 15]} tick={{ fontSize: 10 }} />
              <RTooltip />
              <Line type="monotone" dataKey="avg" stroke="#E8540A" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Recent */}
      <Card className="p-4">
        <h3 className="font-bold text-sm mb-3">Recent scorecards</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : submitted.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nothing yet this month.</p>
        ) : (
          <div className="space-y-2">
            {submitted.slice(0, 10).map(s => (
              <button
                key={s.id}
                onClick={() => setOpenId(s.id)}
                className="w-full flex items-center justify-between p-3 rounded-md border hover:bg-muted text-left transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{s.practice_name || 'First-timer'}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(s.class_date), 'MMM d')} · by {s.evaluator_name} · <Badge variant="outline" className="text-[10px]">{s.eval_type === 'self_eval' ? 'Self' : 'Formal'}</Badge>
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-black tabular-nums ${s.level === 3 ? 'text-primary' : s.level === 2 ? 'text-success' : 'text-muted-foreground'}`}>L{s.level}</span>
                  <p className="text-[10px] text-muted-foreground">{s.total_score}/15</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <ComparisonView scorecardId={openId} open={!!openId} onOpenChange={(o) => { if (!o) setOpenId(null); }} />
    </div>
  );
}
