import { useState, useMemo, useEffect } from 'react';
import { useData } from '@/context/DataContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Users, BarChart3 } from 'lucide-react';
import { isMembershipSale } from '@/lib/sales-detection';
import { parseLocalDate } from '@/lib/utils';
import { isWithinInterval } from 'date-fns';
import FollowUpDigest from './FollowUpDigest';
import OutreachEffectiveness from './OutreachEffectiveness';
// Removed lead measure imports - sections moved to Studio page

interface SAMetrics {
  name: string;
  closeRate: number;
  totalRuns: number;
  totalSales: number;
  objections: Record<string, number>;
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
    const byStaff = new Map<string, { runs: number; sales: number; objections: Record<string, number> }>();

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
      
      const m = byStaff.get(sa) || { runs: 0, sales: 0, objections: {} };
      
      m.runs++;
      if (isMembershipSale(run.result)) {
        m.sales++;
      } else {
        const objection = (run as any).primary_objection;
        if (objection && objection !== 'None/Closed') {
          m.objections[objection] = (m.objections[objection] || 0) + 1;
        }
      }
      byStaff.set(sa, m);
    }

    const metrics: SAMetrics[] = [];
    for (const [name, m] of byStaff) {
      if (m.runs < 3) continue;
      metrics.push({
        name,
        closeRate: Math.round((m.sales / m.runs) * 100),
        totalRuns: m.runs,
        totalSales: m.sales,
        objections: m.objections,
      });
    }
    return metrics.sort((a, b) => b.closeRate - a.closeRate);
  }, [introsRun, introsBooked, range]);

  const suggestions = useMemo(() => {
    const tips: { name: string; tip: string; priority: 'high' | 'medium' | 'low' }[] = [];
    
    for (const sa of saMetrics) {
      if (sa.closeRate < 30) {
        tips.push({ name: sa.name, tip: `Close rate at ${sa.closeRate}% — focus on deeper discovery and objection handling.`, priority: 'high' });
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

      {/* 6D: Objection Distribution */}
      {(() => {
        const allObjections: Record<string, number> = {};
        saMetrics.forEach(sa => {
          Object.entries(sa.objections).forEach(([obj, count]) => {
            allObjections[obj] = (allObjections[obj] || 0) + count;
          });
        });
        const total = Object.values(allObjections).reduce((s, v) => s + v, 0);
        if (total === 0) return null;
        const COLORS = ['hsl(0, 70%, 50%)', 'hsl(30, 80%, 50%)', 'hsl(200, 70%, 50%)', 'hsl(280, 60%, 50%)', 'hsl(160, 60%, 40%)', 'hsl(50, 80%, 45%)'];
        const pieData = Object.entries(allObjections).map(([name, value]) => ({ name, value, pct: Math.round((value / total) * 100) })).sort((a, b) => b.value - a.value);
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Objection Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, pct }) => `${name} ${pct}%`} fontSize={10}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} (${Math.round((value / total) * 100)}%)`, 'Count']} />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-muted-foreground text-center mt-1">{total} non-close intros with objection logged</p>
            </CardContent>
          </Card>
        );
      })()}

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

      {/* Outreach Effectiveness — from Win the Day reflections */}
      <OutreachEffectiveness />

      {/* Follow-Up System Health */}
      <FollowUpDigest preset={preset} />
    </div>
  );
}
