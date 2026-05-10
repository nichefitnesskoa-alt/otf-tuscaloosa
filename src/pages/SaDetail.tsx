import { useMemo, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, Flame, Loader2 } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { useSaLeaderboard } from '@/hooks/useSaLeaderboard';
import { isEligibleThreshold } from '@/lib/sa/saStreaks';
import { computeCoverage, formatCoveragePct } from '@/lib/sa/coverage';
import { DatePreset, DateRange, getDateRangeForPreset } from '@/lib/pay-period';
import { PersonListDrillDown, type PersonRow } from '@/components/dashboard/PersonListDrillDown';

interface ShiftSummary {
  date: string; // YYYY-MM-DD
  type: string;
  milestones: number;
  referrals: number;
  celebrated: number | null;
  missed: number | null;
  notes: string | null;
}

export default function SaDetail() {
  const { saName: raw } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const saName = decodeURIComponent(raw || '');

  // SA can only view own page; Admin sees anyone; Coach blocked.
  if (user?.role === 'Coach') {
    return <Navigate to="/coach-view" replace />;
  }
  if (user?.role === 'SA' && user?.name !== saName) {
    return <Navigate to={`/sas/${encodeURIComponent(user.name)}`} replace />;
  }

  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const dateRange = useMemo(
    () => getDateRangeForPreset(datePreset, customRange),
    [datePreset, customRange],
  );

  const rangeStart = dateRange ? format(dateRange.start, 'yyyy-MM-dd') : format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const rangeEnd = dateRange ? format(dateRange.end, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  const data = useSaLeaderboard(rangeStart, rangeEnd);

  const myRow = data.rows.find(r => r.name === saName);

  // Build per-shift summary for this SA
  const shiftSummaries: ShiftSummary[] = useMemo(() => {
    const map = new Map<string, ShiftSummary>();
    for (const s of data.shifts) {
      if (s.sa_name !== saName) continue;
      const key = `${s.shift_date}|${s.shift_type}`;
      if (!map.has(key)) {
        map.set(key, { date: s.shift_date, type: s.shift_type, milestones: 0, referrals: 0, celebrated: null, missed: null, notes: null });
      }
    }
    // Attribute milestones to SA's shift on the same Central-time date
    for (const m of data.milestones) {
      if ((m.created_by || '') !== saName) continue;
      if (!isEligibleThreshold(m.milestone_type)) continue;
      const dateKey = format(new Date(m.created_at), 'yyyy-MM-dd');
      for (const [k, v] of map.entries()) {
        if (v.date === dateKey) { v.milestones++; break; }
      }
    }
    for (const r of data.referrals) {
      if ((r.booked_by || '') !== saName || !r.class_date) continue;
      for (const [k, v] of map.entries()) {
        if (v.date === r.class_date) { v.referrals++; break; }
      }
    }
    // Merge coverage reports for this SA
    for (const cr of data.coverageReports) {
      if (cr.sa_name !== saName) continue;
      const key = `${cr.shift_date}|${cr.shift_type}`;
      const existing = map.get(key);
      if (existing) {
        existing.celebrated = cr.milestones_celebrated;
        existing.missed = cr.milestones_missed;
        existing.notes = cr.notes;
      } else {
        map.set(key, {
          date: cr.shift_date, type: cr.shift_type, milestones: 0, referrals: 0,
          celebrated: cr.milestones_celebrated, missed: cr.milestones_missed, notes: cr.notes,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [data, saName]);

  const myCoverage = useMemo(
    () => computeCoverage(data.coverageReports.filter(r => r.sa_name === saName)),
    [data.coverageReports, saName],
  );

  const [drill, setDrill] = useState<'milestones' | 'referrals' | 'shifts' | null>(null);

  const drillRows: PersonRow[] = useMemo(() => {
    if (!drill) return [];
    if (drill === 'milestones') {
      return data.milestones
        .filter(m => (m.created_by || '') === saName && isEligibleThreshold(m.milestone_type))
        .map(m => ({
          id: `mile-${m.id}`,
          name: m.member_name || 'Unknown member',
          subtitle: `${m.milestone_type} class · ${format(new Date(m.created_at), 'MMM d')}`,
        }));
    }
    if (drill === 'referrals') {
      return data.referrals
        .filter(r => (r.booked_by || '') === saName)
        .map(r => ({
          id: `ref-${r.id}`,
          name: r.member_name || 'Unknown member',
          subtitle: r.class_date ? format(parseLocalDate(r.class_date), 'MMM d') : '',
        }));
    }
    return shiftSummaries.map(s => ({
      id: `${s.date}-${s.type}`,
      name: `${s.type} shift`,
      subtitle: `${format(parseLocalDate(s.date), 'EEE MMM d')} · ${s.milestones} milestones · ${s.referrals} refs`,
    }));
  }, [drill, data, saName, shiftSummaries]);

  if (!saName) return <div className="p-4">Loading…</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="min-h-[36px]">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-black">{saName}</h1>
        {(myRow?.streak ?? 0) >= 2 && (
          <Badge variant="outline" className="px-2 py-0.5 text-xs gap-1 border-primary/40 text-primary">
            <Flame className="w-3.5 h-3.5" />
            {myRow!.streak} shift milestone streak
          </Badge>
        )}
      </div>

      <DateRangeFilter
        preset={datePreset}
        customRange={customRange}
        onPresetChange={setDatePreset}
        onCustomRangeChange={setCustomRange}
        dateRange={dateRange || { start: new Date(2020, 0, 1), end: new Date() }}
      />

      {/* Tile row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <button
              type="button"
              onClick={() => setDrill('shifts')}
              disabled={(myRow?.shifts ?? 0) === 0}
              className="w-full min-h-[44px] cursor-pointer hover:bg-muted/40 rounded -m-1 p-1 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <p className="text-2xl font-bold">{myRow?.shifts ?? 0}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Shifts worked</p>
            </button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <button
              type="button"
              onClick={() => setDrill('milestones')}
              disabled={(myRow?.milestones ?? 0) === 0}
              className="w-full min-h-[44px] cursor-pointer hover:bg-muted/40 rounded -m-1 p-1 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <p className="text-2xl font-bold text-primary">{myRow?.milestones ?? 0}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Milestones marked</p>
            </button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div
              className="w-full min-h-[44px] rounded -m-1 p-1"
              title={`${myCoverage.celebrated} celebrated / ${myCoverage.missed} missed across ${myCoverage.reportedShifts} reported shift${myCoverage.reportedShifts === 1 ? '' : 's'}`}
            >
              <p className="text-2xl font-bold text-primary">{formatCoveragePct(myCoverage.pct)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Coverage · {myCoverage.reportedShifts} report{myCoverage.reportedShifts === 1 ? '' : 's'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <button
              type="button"
              onClick={() => setDrill('referrals')}
              disabled={(myRow?.referralAsks ?? 0) === 0}
              className="w-full min-h-[44px] cursor-pointer hover:bg-muted/40 rounded -m-1 p-1 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <p className="text-2xl font-bold text-primary">{myRow?.referralAsks ?? 0}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Refs · {(myRow?.referralAskRate ?? 0).toFixed(2)}/shift
              </p>
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Recent shifts list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent shifts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
              <span className="text-xs text-muted-foreground">Loading…</span>
            </div>
          ) : shiftSummaries.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No shifts in this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Shift</TableHead>
                    <TableHead className="text-xs text-center">Milestones</TableHead>
                    <TableHead className="text-xs text-center">Refs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shiftSummaries.map(s => (
                    <TableRow key={`${s.date}-${s.type}`}>
                      <TableCell className="text-sm">{format(parseLocalDate(s.date), 'EEE MMM d')}</TableCell>
                      <TableCell className="text-sm">{s.type}</TableCell>
                      <TableCell className="text-sm text-center">{s.milestones}</TableCell>
                      <TableCell className="text-sm text-center">{s.referrals}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PersonListDrillDown
        open={!!drill}
        onOpenChange={o => { if (!o) setDrill(null); }}
        title={
          drill === 'milestones'
            ? `${saName} · Milestones marked`
            : drill === 'referrals'
              ? `${saName} · POS referral asks`
              : `${saName} · Shifts worked`
        }
        scopeBadge="SA detail"
        subtitle={dateRange ? `${format(dateRange.start, 'MMM d')} – ${format(dateRange.end, 'MMM d, yyyy')}` : 'All time'}
        rows={drillRows}
        emptyText="No records for this metric."
      />
    </div>
  );
}
