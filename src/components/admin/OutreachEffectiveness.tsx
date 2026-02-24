/**
 * Outreach Effectiveness — Coaching insights from Win the Day reflections.
 * Shows questionnaire reach rate, confirmation rate, and follow-up response rate.
 */
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Phone, Users } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

type DatePreset = '7_days' | '30_days' | 'this_month' | 'last_month' | 'all';

interface ReflectionRow {
  sa_name: string;
  reflection_date: string;
  reflection_type: string;
  result: string;
  booking_id: string | null;
}

interface FollowupLogRow {
  sa_name: string;
  log_date: string;
  contacted_count: number;
  responded_count: number;
}

function getDateRange(preset: DatePreset): { start: string; end: string } | null {
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  switch (preset) {
    case '7_days': return { start: format(subDays(now, 6), 'yyyy-MM-dd'), end: today };
    case '30_days': return { start: format(subDays(now, 29), 'yyyy-MM-dd'), end: today };
    case 'this_month': return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
    case 'last_month': {
      const lm = subMonths(now, 1);
      return { start: format(startOfMonth(lm), 'yyyy-MM-dd'), end: format(endOfMonth(lm), 'yyyy-MM-dd') };
    }
    case 'all': return null;
  }
}

export default function OutreachEffectiveness() {
  const [preset, setPreset] = useState<DatePreset>('30_days');
  const [saFilter, setSaFilter] = useState<string>('all');
  const [reflections, setReflections] = useState<ReflectionRow[]>([]);
  const [followupLogs, setFollowupLogs] = useState<FollowupLogRow[]>([]);
  const [saNames, setSaNames] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const range = getDateRange(preset);
      let rQuery = supabase.from('win_the_day_reflections').select('sa_name, reflection_date, reflection_type, result, booking_id');
      let fQuery = supabase.from('followup_daily_log').select('sa_name, log_date, contacted_count, responded_count');

      if (range) {
        rQuery = rQuery.gte('reflection_date', range.start).lte('reflection_date', range.end);
        fQuery = fQuery.gte('log_date', range.start).lte('log_date', range.end);
      }

      const [{ data: rData }, { data: fData }] = await Promise.all([rQuery, fQuery]);
      setReflections((rData || []) as any);
      setFollowupLogs((fData || []) as any);

      // Gather SA names
      const names = new Set<string>();
      (rData || []).forEach((r: any) => names.add(r.sa_name));
      (fData || []).forEach((f: any) => names.add(f.sa_name));
      setSaNames(Array.from(names).sort());
    })();
  }, [preset]);

  const filtered = useMemo(() => {
    const r = saFilter === 'all' ? reflections : reflections.filter(x => x.sa_name === saFilter);
    const f = saFilter === 'all' ? followupLogs : followupLogs.filter(x => x.sa_name === saFilter);
    return { reflections: r, followupLogs: f };
  }, [reflections, followupLogs, saFilter]);

  // Questionnaire reach rate
  const qStats = useMemo(() => {
    const qRows = filtered.reflections.filter(r => r.reflection_type === 'questionnaire_outreach');
    const total = qRows.length;
    if (total === 0) return null;
    const answered = qRows.filter(r => r.result === 'answered').length;
    const waiting = qRows.filter(r => r.result === 'sent_waiting').length;
    const unreachable = qRows.filter(r => r.result === 'unreachable').length;
    return {
      total,
      answeredPct: Math.round((answered / total) * 100),
      waitingPct: Math.round((waiting / total) * 100),
      unreachablePct: Math.round((unreachable / total) * 100),
    };
  }, [filtered.reflections]);

  // Confirmation rate
  const confirmStats = useMemo(() => {
    const cRows = filtered.reflections.filter(r => r.reflection_type === 'booking_confirmation');
    const total = cRows.length;
    if (total === 0) return null;
    const confirmed = cRows.filter(r => r.result === 'confirmed').length;
    const noResponse = cRows.filter(r => r.result === 'sent_no_response').length;
    const unreachable = cRows.filter(r => r.result === 'unreachable').length;
    return {
      total,
      confirmedPct: Math.round((confirmed / total) * 100),
      noResponsePct: Math.round((noResponse / total) * 100),
      unreachablePct: Math.round((unreachable / total) * 100),
    };
  }, [filtered.reflections]);

  // Follow-up response rate
  const fuStats = useMemo(() => {
    const logs = filtered.followupLogs;
    if (logs.length === 0) return null;
    const totalContacted = logs.reduce((s, l) => s + l.contacted_count, 0);
    const totalResponded = logs.reduce((s, l) => s + l.responded_count, 0);
    return {
      totalContacted,
      totalResponded,
      responsePct: totalContacted > 0 ? Math.round((totalResponded / totalContacted) * 100) : 0,
      days: logs.length,
    };
  }, [filtered.followupLogs]);

  const presets: { key: DatePreset; label: string }[] = [
    { key: '7_days', label: '7 Days' },
    { key: '30_days', label: '30 Days' },
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Outreach Effectiveness
        </CardTitle>
        <p className="text-xs text-muted-foreground">SA reflection data from Win the Day checklist</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
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
          <Select value={saFilter} onValueChange={setSaFilter}>
            <SelectTrigger className="w-[140px] h-7 text-xs">
              <SelectValue placeholder="All SAs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SAs</SelectItem>
              {saNames.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Questionnaire Reach Rate */}
        <div className="space-y-1.5">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" />
            Questionnaire Reach Rate
          </h4>
          {qStats ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-2">
                <div className="text-lg font-bold text-emerald-600">{qStats.answeredPct}%</div>
                <div className="text-[10px] text-muted-foreground">Sent & Answered</div>
              </div>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-2">
                <div className="text-lg font-bold text-amber-600">{qStats.waitingPct}%</div>
                <div className="text-[10px] text-muted-foreground">Sent, Waiting</div>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-2">
                <div className="text-lg font-bold text-red-600">{qStats.unreachablePct}%</div>
                <div className="text-[10px] text-muted-foreground">Unreachable</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No questionnaire reflection data yet</p>
          )}
          {qStats && <p className="text-[10px] text-muted-foreground">{qStats.total} total outreach attempts</p>}
        </div>

        {/* Confirmation Rate */}
        <div className="space-y-1.5">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Confirmation Rate
          </h4>
          {confirmStats ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-2">
                <div className="text-lg font-bold text-emerald-600">{confirmStats.confirmedPct}%</div>
                <div className="text-[10px] text-muted-foreground">Confirmed</div>
              </div>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-2">
                <div className="text-lg font-bold text-amber-600">{confirmStats.noResponsePct}%</div>
                <div className="text-[10px] text-muted-foreground">No Response</div>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-2">
                <div className="text-lg font-bold text-red-600">{confirmStats.unreachablePct}%</div>
                <div className="text-[10px] text-muted-foreground">Unreachable</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No confirmation reflection data yet</p>
          )}
          {confirmStats && <p className="text-[10px] text-muted-foreground">{confirmStats.total} total confirmation attempts</p>}
        </div>

        {/* Follow-Up Response Rate */}
        <div className="space-y-1.5">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Follow-Up Response Rate
          </h4>
          {fuStats ? (
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-primary/10 p-3 text-center flex-1">
                <div className="text-2xl font-bold text-primary">{fuStats.responsePct}%</div>
                <div className="text-[10px] text-muted-foreground">Response Rate</div>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>{fuStats.totalContacted} contacted</p>
                <p>{fuStats.totalResponded} responded</p>
                <p>{fuStats.days} days logged</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No follow-up log data yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
