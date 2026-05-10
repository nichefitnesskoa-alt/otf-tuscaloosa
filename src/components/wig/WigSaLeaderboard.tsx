import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, Flame, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { PersonListDrillDown, type PersonRow } from '@/components/dashboard/PersonListDrillDown';
import { useSaLeaderboard } from '@/hooks/useSaLeaderboard';
import type { DateRange } from '@/lib/pay-period';
import { isEligibleThreshold } from '@/lib/sa/saStreaks';
import { computeCoverage, formatCoveragePct } from '@/lib/sa/coverage';
import { cn } from '@/lib/utils';

interface Props {
  dateRange: DateRange | undefined;
}

type DrillBucket = 'milestones' | 'referrals' | 'shifts';

export function WigSaLeaderboard({ dateRange }: Props) {
  const navigate = useNavigate();
  const rangeStart = dateRange ? format(dateRange.start, 'yyyy-MM-dd') : '2020-01-01';
  const rangeEnd = dateRange ? format(dateRange.end, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  const data = useSaLeaderboard(rangeStart, rangeEnd);

  const [drill, setDrill] = useState<{ sa: string | null; bucket: DrillBucket } | null>(null);

  const totals = useMemo(() => {
    const milestones = data.rows.reduce((s, r) => s + r.milestones, 0);
    const referrals = data.rows.reduce((s, r) => s + r.referralAsks, 0);
    const shifts = data.rows.reduce((s, r) => s + r.shifts, 0);
    return { milestones, referrals, shifts };
  }, [data.rows]);

  // Per-SA coverage map (canonical helper — same numbers as detail page)
  const coverageBySa = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeCoverage>>();
    const grouped = new Map<string, typeof data.coverageReports>();
    for (const r of data.coverageReports) {
      const arr = grouped.get(r.sa_name) || [];
      arr.push(r);
      grouped.set(r.sa_name, arr);
    }
    for (const [name, reports] of grouped) map.set(name, computeCoverage(reports));
    return map;
  }, [data.coverageReports]);

  const rangeLabel = dateRange
    ? `${format(dateRange.start, 'MMM d')} – ${format(dateRange.end, 'MMM d, yyyy')}`
    : 'All time';

  // Build drill rows
  const drillRows: PersonRow[] = useMemo(() => {
    if (!drill) return [];
    const filterBySa = (saName: string | null) => (v: { created_by?: string | null; booked_by?: string | null; sa_name?: string }) =>
      saName == null
        ? true
        : (v.created_by || v.booked_by || v.sa_name) === saName;

    if (drill.bucket === 'milestones') {
      return data.milestones
        .filter(m => isEligibleThreshold(m.milestone_type) && filterBySa(drill.sa)(m))
        .map(m => ({
          id: `mile-${m.id}`,
          name: m.member_name || 'Unknown member',
          subtitle: `${m.milestone_type} class · ${format(new Date(m.created_at), 'MMM d')} · ${m.created_by || 'Unknown'}`,
        }));
    }
    if (drill.bucket === 'referrals') {
      return data.referrals
        .filter(filterBySa(drill.sa))
        .map(r => ({
          id: `ref-${r.id}`,
          name: r.member_name || 'Unknown member',
          subtitle: `${r.class_date ? format(parseLocalDate(r.class_date), 'MMM d') : ''} · ${r.booked_by || 'Unknown'}`,
        }));
    }
    // shifts
    const seen = new Set<string>();
    const rows: PersonRow[] = [];
    for (const s of data.shifts) {
      if (drill.sa && s.sa_name !== drill.sa) continue;
      const key = `${s.sa_name}|${s.shift_date}|${s.shift_type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        id: key,
        name: `${s.sa_name} · ${s.shift_type}`,
        subtitle: format(parseLocalDate(s.shift_date), 'EEE MMM d'),
      });
    }
    return rows.sort((a, b) => (a.subtitle || '') < (b.subtitle || '') ? 1 : -1);
  }, [drill, data]);

  const drillTitle = drill
    ? `${drill.sa ?? 'Studio'} · ${drill.bucket === 'milestones' ? 'Milestones marked' : drill.bucket === 'referrals' ? 'POS referral asks' : 'Shifts worked'}`
    : '';

  return (
    <>
      {/* Header tile row */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <button
              type="button"
              onClick={() => setDrill({ sa: null, bucket: 'milestones' })}
              disabled={totals.milestones === 0}
              className="w-full min-h-[44px] cursor-pointer hover:bg-muted/40 rounded -m-1 p-1 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <p className="text-2xl font-bold text-primary">{totals.milestones}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Milestones marked</p>
            </button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <button
              type="button"
              onClick={() => setDrill({ sa: null, bucket: 'referrals' })}
              disabled={totals.referrals === 0}
              className="w-full min-h-[44px] cursor-pointer hover:bg-muted/40 rounded -m-1 p-1 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <p className="text-2xl font-bold text-primary">{totals.referrals}</p>
              <p className="text-[10px] text-muted-foreground mt-1">POS referral asks</p>
            </button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <button
              type="button"
              onClick={() => setDrill({ sa: null, bucket: 'shifts' })}
              disabled={totals.shifts === 0}
              className="w-full min-h-[44px] cursor-pointer hover:bg-muted/40 rounded -m-1 p-1 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <p className="text-2xl font-bold text-primary">{totals.shifts}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Shifts worked</p>
            </button>
          </CardContent>
        </Card>
      </div>

      {/* SA leaderboard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            SA Leaderboard
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Tap a number to drill in. Tap an SA name to open their full page. Sorted by referral asks per shift.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {data.loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
              <span className="text-xs text-muted-foreground">Loading…</span>
            </div>
          ) : data.rows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No SA activity for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">SA</TableHead>
                    <TableHead className="text-xs text-center">Shifts</TableHead>
                    <TableHead className="text-xs text-center">Milestones</TableHead>
                    <TableHead className="text-xs text-center" title="Honor-system coverage: celebrated / (celebrated + missed)">Coverage</TableHead>
                    <TableHead className="text-xs text-center">Refs (rate)</TableHead>
                    <TableHead className="text-xs text-center w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map(row => {
                    const cov = coverageBySa.get(row.name);
                    return (
                    <TableRow
                      key={row.name}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => navigate(`/sas/${encodeURIComponent(row.name)}`)}
                    >
                      <TableCell className="text-sm font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {row.name}
                          {row.streak >= 2 && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px] gap-1 border-primary/40 text-primary">
                              <Flame className="w-3 h-3" />
                              {row.streak}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-center p-0">
                        <button
                          type="button"
                          disabled={row.shifts === 0}
                          onClick={e => { e.stopPropagation(); setDrill({ sa: row.name, bucket: 'shifts' }); }}
                          className="w-full min-h-[44px] px-3 cursor-pointer hover:bg-muted/40 hover:underline disabled:cursor-default disabled:hover:bg-transparent disabled:hover:no-underline"
                        >
                          {row.shifts}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm text-center p-0">
                        <button
                          type="button"
                          disabled={row.milestones === 0}
                          onClick={e => { e.stopPropagation(); setDrill({ sa: row.name, bucket: 'milestones' }); }}
                          className="w-full min-h-[44px] px-3 cursor-pointer hover:bg-muted/40 hover:underline disabled:cursor-default disabled:hover:bg-transparent disabled:hover:no-underline"
                        >
                          {row.milestones}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm text-center tabular-nums">
                        {cov ? (
                          <span title={`${cov.celebrated} celebrated / ${cov.missed} missed · ${cov.reportedShifts} report${cov.reportedShifts === 1 ? '' : 's'}`}>
                            {formatCoveragePct(cov.pct)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-center p-0">
                        <button
                          type="button"
                          disabled={row.referralAsks === 0}
                          onClick={e => { e.stopPropagation(); setDrill({ sa: row.name, bucket: 'referrals' }); }}
                          className={cn(
                            "w-full min-h-[44px] px-3 cursor-pointer hover:bg-muted/40 hover:underline disabled:cursor-default disabled:hover:bg-transparent disabled:hover:no-underline",
                          )}
                        >
                          <span className="font-medium">{row.referralAsks}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({row.referralAskRate.toFixed(2)}/sh)
                          </span>
                        </button>
                      </TableCell>
                      <TableCell className="text-center">
                        <ChevronRight className="w-4 h-4 text-muted-foreground inline" />
                      </TableCell>
                    </TableRow>
                  );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PersonListDrillDown
        open={!!drill}
        onOpenChange={o => { if (!o) setDrill(null); }}
        title={drillTitle}
        scopeBadge="WIG · SA"
        subtitle={rangeLabel}
        rows={drillRows}
        emptyText="No records for this metric."
      />
    </>
  );
}
