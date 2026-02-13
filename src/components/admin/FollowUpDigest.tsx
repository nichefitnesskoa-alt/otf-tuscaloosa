import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList } from 'recharts';
import { ClipboardCheck, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { subDays, startOfWeek, endOfWeek, format, isWithinInterval, parseISO } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

interface FollowUpDigestProps {
  preset: string;
}

interface FollowUpRow {
  id: string;
  person_name: string;
  person_type: string;
  touch_number: number;
  scheduled_date: string;
  status: string;
  sent_by: string | null;
  sent_at: string | null;
  is_legacy: boolean;
  booking_id: string | null;
  lead_id: string | null;
  created_at: string;
}

interface SAFollowUpStats {
  name: string;
  assigned: number;
  completed: number;
  completionRate: number;
  expired: number;
  converted: number;
  conversionRate: number;
}

export default function FollowUpDigest({ preset }: FollowUpDigestProps) {
  const [followUps, setFollowUps] = useState<FollowUpRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFollowUps = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('follow_up_queue')
        .select('*')
        .order('scheduled_date', { ascending: false })
        .limit(2000);
      setFollowUps((data as FollowUpRow[]) || []);
      setLoading(false);
    };
    fetchFollowUps();
  }, []);

  const range = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (preset) {
      case 'this_week': {
        const start = startOfWeek(today, { weekStartsOn: 1 });
        const end = endOfWeek(today, { weekStartsOn: 1 });
        return { start, end };
      }
      case '7_days': return { start: subDays(today, 6), end: today };
      case '30_days': return { start: subDays(today, 29), end: today };
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
      default: return null;
    }
  }, [preset]);

  const filtered = useMemo(() => {
    if (!range) return followUps;
    return followUps.filter(f => {
      try {
        const d = parseLocalDate(f.scheduled_date);
        return isWithinInterval(d, { start: range.start, end: range.end });
      } catch { return false; }
    });
  }, [followUps, range]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const completed = filtered.filter(f => f.status === 'sent').length;
    const expired = filtered.filter(f => {
      if (f.status !== 'pending') return false;
      try {
        const d = parseLocalDate(f.scheduled_date);
        return d < new Date();
      } catch { return false; }
    }).length;
    const converted = filtered.filter(f => f.status === 'converted').length;
    const dormant = filtered.filter(f => f.status === 'dormant').length;
    const snoozed = filtered.filter(f => f.status === 'snoozed').length;
    const pending = filtered.filter(f => f.status === 'pending').length;
    const completionRate = (completed + expired) > 0 ? Math.round((completed / (completed + expired)) * 100) : 0;
    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;
    const legacyCount = filtered.filter(f => f.is_legacy).length;
    const legacyTriaged = filtered.filter(f => f.is_legacy && f.status !== 'pending').length;

    return { total, completed, expired, converted, dormant, snoozed, pending, completionRate, conversionRate, legacyCount, legacyTriaged };
  }, [filtered]);

  const perSA = useMemo(() => {
    const map = new Map<string, { assigned: number; completed: number; expired: number; converted: number }>();

    for (const f of filtered) {
      const sa = f.sent_by || 'Unassigned';
      const m = map.get(sa) || { assigned: 0, completed: 0, expired: 0, converted: 0 };
      m.assigned++;
      if (f.status === 'sent') m.completed++;
      if (f.status === 'converted') m.converted++;
      if (f.status === 'pending') {
        try {
          const d = parseLocalDate(f.scheduled_date);
          if (d < new Date()) m.expired++;
        } catch {}
      }
      map.set(sa, m);
    }

    const result: SAFollowUpStats[] = [];
    for (const [name, m] of map) {
      if (name === 'Unassigned' && m.assigned === 0) continue;
      result.push({
        name,
        assigned: m.assigned,
        completed: m.completed,
        completionRate: (m.completed + m.expired) > 0 ? Math.round((m.completed / (m.completed + m.expired)) * 100) : 0,
        expired: m.expired,
        converted: m.converted,
        conversionRate: m.assigned > 0 ? Math.round((m.converted / m.assigned) * 100) : 0,
      });
    }
    return result.sort((a, b) => b.completionRate - a.completionRate);
  }, [filtered]);

  const chartData = useMemo(() => {
    return perSA
      .filter(s => s.name !== 'Unassigned')
      .map(s => ({ name: s.name, rate: s.completionRate }));
  }, [perSA]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Loading follow-up data…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Follow-Ups</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{stats.completionRate}%</p>
            <p className="text-xs text-muted-foreground">Completion Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.conversionRate}%</p>
            <p className="text-xs text-muted-foreground">Conversion Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.expired}</p>
            <p className="text-xs text-muted-foreground">Expired (Missed)</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Follow-Up Status Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-20 text-muted-foreground">Completed</span>
            <Progress value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0} className="flex-1 h-2" />
            <span className="w-8 text-right font-medium">{stats.completed}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-20 text-muted-foreground">Pending</span>
            <Progress value={stats.total > 0 ? (stats.pending / stats.total) * 100 : 0} className="flex-1 h-2" />
            <span className="w-8 text-right font-medium">{stats.pending}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-20 text-muted-foreground">Converted</span>
            <Progress value={stats.total > 0 ? (stats.converted / stats.total) * 100 : 0} className="flex-1 h-2" />
            <span className="w-8 text-right font-medium">{stats.converted}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-20 text-muted-foreground">Dormant</span>
            <Progress value={stats.total > 0 ? (stats.dormant / stats.total) * 100 : 0} className="flex-1 h-2" />
            <span className="w-8 text-right font-medium">{stats.dormant}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-20 text-muted-foreground">Snoozed</span>
            <Progress value={stats.total > 0 ? (stats.snoozed / stats.total) * 100 : 0} className="flex-1 h-2" />
            <span className="w-8 text-right font-medium">{stats.snoozed}</span>
          </div>
          {stats.legacyCount > 0 && (
            <div className="mt-2 p-2 rounded bg-muted/50 text-xs flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-warning" />
              Legacy backfill: {stats.legacyTriaged}/{stats.legacyCount} triaged ({stats.legacyCount > 0 ? Math.round((stats.legacyTriaged / stats.legacyCount) * 100) : 0}%)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completion Rate by SA Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Completion Rate by SA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis unit="%" fontSize={11} domain={[0, 100]} />
                <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="rate" position="top" fontSize={10} formatter={(v: number) => `${v}%`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-SA Accountability Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Per-SA Follow-Up Accountability
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">SA</TableHead>
                  <TableHead className="text-xs text-center">Assigned</TableHead>
                  <TableHead className="text-xs text-center">Sent</TableHead>
                  <TableHead className="text-xs text-center">Expired</TableHead>
                  <TableHead className="text-xs text-center">Done %</TableHead>
                  <TableHead className="text-xs text-center">Converted</TableHead>
                  <TableHead className="text-xs text-center">Conv %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perSA.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-4">
                      No follow-up data for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  perSA.map(sa => (
                    <TableRow key={sa.name}>
                      <TableCell className="font-medium text-sm">{sa.name}</TableCell>
                      <TableCell className="text-center text-sm">{sa.assigned}</TableCell>
                      <TableCell className="text-center text-sm text-success">{sa.completed}</TableCell>
                      <TableCell className="text-center text-sm text-destructive">{sa.expired}</TableCell>
                      <TableCell className="text-center text-sm">
                        <Badge variant={sa.completionRate >= 80 ? 'default' : sa.completionRate >= 50 ? 'secondary' : 'destructive'} className="text-[10px]">
                          {sa.completionRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">{sa.converted}</TableCell>
                      <TableCell className="text-center text-sm">
                        <span className={sa.conversionRate > 0 ? 'text-success font-medium' : 'text-muted-foreground'}>
                          {sa.conversionRate}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
