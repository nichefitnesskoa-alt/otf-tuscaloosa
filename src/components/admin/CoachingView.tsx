import { useState, useMemo, useEffect } from 'react';
import { useData } from '@/context/DataContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LabelList, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Target, Users, BarChart3, RefreshCw, ClipboardList, Dumbbell } from 'lucide-react';
import { isMembershipSale } from '@/lib/sales-detection';
import { parseLocalDate } from '@/lib/utils';
import { isWithinInterval } from 'date-fns';
import FollowUpDigest from './FollowUpDigest';
import OutreachEffectiveness from './OutreachEffectiveness';
import { getLeadMeasureColor, Q_COMPLETION_THRESHOLDS, PREP_RATE_THRESHOLDS } from '@/lib/studio-metrics';

interface SAMetrics {
  name: string;
  closeRate: number;
  goalWhyRate: number;
  friendRate: number;
  totalRuns: number;
  totalSales: number;
  secondIntroBookingRate: number;
  secondIntroCloseRate: number;
  objections: Record<string, number>;
  qCompletionRate?: number;
  prepRate?: number;
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
  const [saQPrepRates, setSaQPrepRates] = useState<Record<string, { qRate: number | undefined; prepRate: number | undefined }>>({});

  const range = useMemo(() => getCoachingRange(preset), [preset]);

  // Fetch per-SA Q completion + Prep Rate from DB
  useEffect(() => {
    (async () => {
      // Get all first-intro bookings in range per SA
      const saBookings = new Map<string, string[]>(); // saName -> bookingIds
      introsBooked.forEach(b => {
        if ((b as any).is_vip === true || (b as any).originating_booking_id) return;
        if (range) {
          try {
            const d = parseLocalDate(b.class_date);
            if (!isWithinInterval(d, { start: range.start, end: range.end })) return;
          } catch { return; }
        }
        const sa = (b as any).intro_owner || b.sa_working_shift;
        if (!sa) return;
        const existing = saBookings.get(sa) || [];
        existing.push(b.id);
        saBookings.set(sa, existing);
      });

      if (saBookings.size === 0) { setSaQPrepRates({}); return; }

      // Collect all booking IDs
      const allIds = Array.from(saBookings.values()).flat();
      const [{ data: qs }, { data: preppedRows }] = await Promise.all([
        supabase.from('intro_questionnaires').select('booking_id, status').in('booking_id', allIds.slice(0, 500)),
        supabase.from('intros_booked').select('id, prepped, intro_owner, sa_working_shift').in('id', allIds.slice(0, 500)).eq('prepped', true),
      ]);

      const completedQIds = new Set(
        (qs || []).filter(q => q.status === 'completed' || q.status === 'submitted').map(q => q.booking_id)
      );
      const preppedIds = new Set((preppedRows || []).map(r => r.id));

      const rates: Record<string, { qRate: number | undefined; prepRate: number | undefined }> = {};
      saBookings.forEach((ids, saName) => {
        const total = ids.length;
        if (total === 0) return;
        const qCompleted = ids.filter(id => completedQIds.has(id)).length;
        const prepped = ids.filter(id => preppedIds.has(id)).length;
        rates[saName] = {
          qRate: (qCompleted / total) * 100,
          prepRate: (prepped / total) * 100,
        };
      });
      setSaQPrepRates(rates);
    })();
  }, [introsBooked, range]);

  const saMetrics = useMemo(() => {
    // Build set of VIP booking IDs to exclude
    const vipBookingIds = new Set(
      introsBooked.filter(b => (b as any).is_vip === true).map(b => b.id)
    );
    const byStaff = new Map<string, { runs: number; sales: number; goalWhy: number; friend: number; nonCloseRuns: number; secondBookings: number; secondCloses: number; objections: Record<string, number> }>();

    // Build set of booking IDs that ARE 2nd intros
    const secondIntroBookingIds = new Set(
      introsBooked
        .filter(b => (b as any).originating_booking_id)
        .map(b => b.id)
    );

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
      
      const m = byStaff.get(sa) || { runs: 0, sales: 0, goalWhy: 0, friend: 0, nonCloseRuns: 0, secondBookings: 0, secondCloses: 0, objections: {} };
      
      const isSecondIntroRun = run.linked_intro_booked_id && secondIntroBookingIds.has(run.linked_intro_booked_id);
      
      if (isSecondIntroRun) {
        m.secondBookings++;
        if (isMembershipSale(run.result)) m.secondCloses++;
      } else {
        m.runs++;
        if (isMembershipSale(run.result)) {
          m.sales++;
        } else {
          m.nonCloseRuns++;
          // Track objection
          const objection = (run as any).primary_objection;
          if (objection && objection !== 'None/Closed') {
            m.objections[objection] = (m.objections[objection] || 0) + 1;
          }
        }
      }
      if ((run as any).goal_why_captured === 'Yes') m.goalWhy++;
      if ((run as any).made_a_friend) m.friend++;
      byStaff.set(sa, m);
    }

    const metrics: SAMetrics[] = [];
    for (const [name, m] of byStaff) {
      if (m.runs < 3) continue;
      const rates = saQPrepRates[name];
      metrics.push({
        name,
        closeRate: Math.round((m.sales / m.runs) * 100),
        goalWhyRate: Math.round((m.goalWhy / (m.runs + m.secondBookings)) * 100),
        friendRate: Math.round((m.friend / (m.runs + m.secondBookings)) * 100),
        totalRuns: m.runs,
        totalSales: m.sales,
        secondIntroBookingRate: m.nonCloseRuns > 0 ? Math.round((m.secondBookings / m.nonCloseRuns) * 100) : 0,
        secondIntroCloseRate: m.secondBookings > 0 ? Math.round((m.secondCloses / m.secondBookings) * 100) : 0,
        objections: m.objections,
        qCompletionRate: rates?.qRate,
        prepRate: rates?.prepRate,
      });
    }
    return metrics.sort((a, b) => b.closeRate - a.closeRate);
  }, [introsRun, introsBooked, range, saQPrepRates]);

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
            Close Rate (showed) vs Goal/Why Capture
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
            Close Rate (showed) by SA
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

      {/* 6E: 2nd Intro Conversion Tracking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            2nd Intro Conversion
          </CardTitle>
        </CardHeader>
        <CardContent>
          {saMetrics.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough data</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="font-semibold text-muted-foreground">SA</div>
                <div className="font-semibold text-muted-foreground">2nd Booking Rate</div>
                <div className="font-semibold text-muted-foreground">2nd Close Rate</div>
              </div>
              {saMetrics.map(sa => (
                <div key={sa.name} className="grid grid-cols-3 gap-2 text-center text-xs p-2 rounded bg-muted/30">
                  <span className="font-medium text-left">{sa.name}</span>
                  <span className={sa.secondIntroBookingRate > 50 ? 'text-success font-bold' : ''}>{sa.secondIntroBookingRate}%</span>
                  <span className={sa.secondIntroCloseRate > 40 ? 'text-success font-bold' : ''}>{sa.secondIntroCloseRate}%</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead Measures per SA: Q Completion + Prep Rate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Lead Measures by SA
          </CardTitle>
          <p className="text-xs text-muted-foreground">Q Completion % and Prep Rate % per SA · Target: 70%+</p>
        </CardHeader>
        <CardContent>
          {saMetrics.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough data</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground">
                <div>SA</div>
                <div className="text-center flex items-center justify-center gap-1"><ClipboardList className="w-3 h-3" /> Q Comp.</div>
                <div className="text-center flex items-center justify-center gap-1"><Dumbbell className="w-3 h-3" /> Prep Rate</div>
              </div>
              {saMetrics.map(sa => {
                const qColor = sa.qCompletionRate !== undefined ? getLeadMeasureColor(sa.qCompletionRate, Q_COMPLETION_THRESHOLDS) : null;
                const pColor = sa.prepRate !== undefined ? getLeadMeasureColor(sa.prepRate, PREP_RATE_THRESHOLDS) : null;
                const colorClass = (c: typeof qColor) => c === 'success' ? 'text-success font-bold' : c === 'warning' ? 'text-warning font-bold' : c === 'destructive' ? 'text-destructive font-bold' : 'text-muted-foreground';
                return (
                  <div key={sa.name} className="grid grid-cols-3 gap-2 text-center text-xs p-2 rounded bg-muted/30">
                    <span className="font-medium text-left truncate">{sa.name}</span>
                    <span className={colorClass(qColor)}>
                      {sa.qCompletionRate !== undefined ? `${sa.qCompletionRate.toFixed(0)}%` : '—'}
                    </span>
                    <span className={colorClass(pColor)}>
                      {sa.prepRate !== undefined ? `${sa.prepRate.toFixed(0)}%` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
