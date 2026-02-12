import { useState, useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LabelList } from 'recharts';
import { TrendingUp, Target, Users } from 'lucide-react';
import { isMembershipSale } from '@/lib/sales-detection';
import { parseLocalDate } from '@/lib/utils';
import { isWithinInterval } from 'date-fns';

interface SAMetrics {
  name: string;
  closeRate: number;
  goalWhyRate: number;
  friendRate: number;
  totalRuns: number;
  totalSales: number;
}

type CoachingPreset = 'this_week' | '7_days' | '30_days' | 'this_month' | 'last_month' | 'all';

function getCoachingRange(preset: CoachingPreset): { start: Date; end: Date } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (preset) {
    case 'this_week': {
      const day = today.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const start = new Date(today); start.setDate(today.getDate() - diff);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      return { start, end };
    }
    case '7_days': {
      const start = new Date(today); start.setDate(today.getDate() - 6);
      return { start, end: today };
    }
    case '30_days': {
      const start = new Date(today); start.setDate(today.getDate() - 29);
      return { start, end: today };
    }
    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start, end };
    }
    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start, end };
    }
    case 'all': return null;
  }
}

export default function CoachingView() {
  const { introsRun, introsBooked } = useData();
  const [preset, setPreset] = useState<CoachingPreset>('30_days');

  const range = useMemo(() => getCoachingRange(preset), [preset]);

  const saMetrics = useMemo(() => {
    // Build set of VIP booking IDs to exclude
    const vipBookingIds = new Set(
      introsBooked.filter(b => (b as any).is_vip === true).map(b => b.id)
    );
    const byStaff = new Map<string, { runs: number; sales: number; goalWhy: number; friend: number }>();

    for (const run of introsRun) {
      const sa = run.intro_owner || run.sa_name || 'Unknown';
      if (sa === 'Unknown') continue;
      if (run.result === 'No-show') continue;
      // Exclude VIP runs
      if (run.linked_intro_booked_id && vipBookingIds.has(run.linked_intro_booked_id)) continue;
      
      // Apply date filter
      if (range) {
        const runDate = run.run_date || run.created_at?.split('T')[0];
        if (runDate) {
          try {
            const d = parseLocalDate(runDate);
            if (!isWithinInterval(d, { start: range.start, end: range.end })) continue;
          } catch { continue; }
        }
      }
      
      const m = byStaff.get(sa) || { runs: 0, sales: 0, goalWhy: 0, friend: 0 };
      m.runs++;
      if (isMembershipSale(run.result)) m.sales++;
      if ((run as any).goal_why_captured === 'Yes') m.goalWhy++;
      if ((run as any).made_a_friend) m.friend++;
      byStaff.set(sa, m);
    }

    const metrics: SAMetrics[] = [];
    for (const [name, m] of byStaff) {
      if (m.runs < 3) continue;
      metrics.push({
        name,
        closeRate: Math.round((m.sales / m.runs) * 100),
        goalWhyRate: Math.round((m.goalWhy / m.runs) * 100),
        friendRate: Math.round((m.friend / m.runs) * 100),
        totalRuns: m.runs,
        totalSales: m.sales,
      });
    }
    return metrics.sort((a, b) => b.closeRate - a.closeRate);
  }, [introsRun, introsBooked, range]);

  const suggestions = useMemo(() => {
    const tips: { name: string; tip: string; priority: 'high' | 'medium' | 'low' }[] = [];
    
    for (const sa of saMetrics) {
      if (sa.goalWhyRate < 50 && sa.closeRate < 40) {
        tips.push({ name: sa.name, tip: `Goal/Why capture at ${sa.goalWhyRate}% — focus on deeper discovery conversations to improve close rate.`, priority: 'high' });
      } else if (sa.friendRate < 30 && sa.closeRate < 50) {
        tips.push({ name: sa.name, tip: `"Made a Friend" rate is ${sa.friendRate}% — building rapport before pricing may boost conversions.`, priority: 'medium' });
      } else if (sa.closeRate >= 60) {
        tips.push({ name: sa.name, tip: `Strong ${sa.closeRate}% close rate! Consider mentoring newer SAs.`, priority: 'low' });
      }
    }
    return tips;
  }, [saMetrics]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-card border rounded-lg p-2 text-xs shadow">
          <p className="font-bold">{d.name}</p>
          <p>Close Rate: {d.closeRate}%</p>
          <p>Goal/Why: {d.goalWhyRate}%</p>
          <p>Friend: {d.friendRate}%</p>
          <p>{d.totalSales}/{d.totalRuns} intros closed</p>
        </div>
      );
    }
    return null;
  };

  const presets: { key: CoachingPreset; label: string }[] = [
    { key: 'this_week', label: 'This Week' },
    { key: '7_days', label: '7 Days' },
    { key: '30_days', label: '30 Days' },
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <div className="space-y-4">
      {/* Date filter */}
      <div className="flex gap-1 flex-wrap">
        {presets.map(p => (
          <Button
            key={p.key}
            variant={preset === p.key ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7 px-2"
            onClick={() => setPreset(p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Scatter: Close Rate vs Goal/Why */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4" />
            Close Rate vs Goal/Why Capture
          </CardTitle>
        </CardHeader>
        <CardContent>
          {saMetrics.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough data (min 3 runs per SA)</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <ScatterChart margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="goalWhyRate" name="Goal/Why %" unit="%" fontSize={11} />
                <YAxis type="number" dataKey="closeRate" name="Close %" unit="%" fontSize={11} />
                <Tooltip content={<CustomTooltip />} />
                <Scatter data={saMetrics} fill="hsl(27, 100%, 50%)" />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Bar: Close Rate by SA */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Close Rate by SA
          </CardTitle>
        </CardHeader>
        <CardContent>
          {saMetrics.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={saMetrics} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis unit="%" fontSize={11} />
                <Bar dataKey="closeRate" fill="hsl(27, 100%, 50%)" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="closeRate" position="top" fontSize={10} formatter={(v: number) => `${v}%`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Coaching Suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Coaching Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="p-3 rounded-lg border space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{s.name}</span>
                  <Badge
                    className={
                      s.priority === 'high' ? 'bg-destructive text-destructive-foreground text-[10px]' :
                      s.priority === 'medium' ? 'bg-warning text-warning-foreground text-[10px]' :
                      'bg-success text-success-foreground text-[10px]'
                    }
                  >
                    {s.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{s.tip}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
