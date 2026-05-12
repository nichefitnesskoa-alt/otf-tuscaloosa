import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { PersonListDrillDown, type PersonRow } from '@/components/dashboard/PersonListDrillDown';
import { useSaLeaderboard } from '@/hooks/useSaLeaderboard';
import type { DateRange } from '@/lib/pay-period';
import { isEligibleThreshold } from '@/lib/sa/saStreaks';

interface Props {
  dateRange: DateRange | undefined;
}

type DrillBucket = 'milestones' | 'referrals';

export function WigSaLeaderboard({ dateRange }: Props) {
  const navigate = useNavigate();
  const rangeStart = dateRange ? format(dateRange.start, 'yyyy-MM-dd') : '2020-01-01';
  const rangeEnd = dateRange ? format(dateRange.end, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  const data = useSaLeaderboard(rangeStart, rangeEnd);

  const [drill, setDrill] = useState<{ sa: string | null; bucket: DrillBucket } | null>(null);

  const totals = useMemo(() => {
    const milestones = data.rows.reduce((s, r) => s + r.milestones, 0);
    const referrals = data.rows.reduce((s, r) => s + r.referralAsks, 0);
    return { milestones, referrals };
  }, [data.rows]);

  // Sort by milestones desc, then refs desc
  const sortedRows = useMemo(
    () => [...data.rows].sort((a, b) => b.milestones - a.milestones || b.referralAsks - a.referralAsks),
    [data.rows],
  );

  const rangeLabel = dateRange
    ? `${format(dateRange.start, 'MMM d')} – ${format(dateRange.end, 'MMM d, yyyy')}`
    : 'All time';

  const drillRows: PersonRow[] = useMemo(() => {
    if (!drill) return [];
    const filterBySa = (saName: string | null) => (v: { created_by?: string | null; booked_by?: string | null }) =>
      saName == null ? true : (v.created_by || v.booked_by) === saName;

    if (drill.bucket === 'milestones') {
      return data.milestones
        .filter(m => isEligibleThreshold(m.milestone_type) && filterBySa(drill.sa)(m))
        .map(m => ({
          id: `mile-${m.id}`,
          name: m.member_name || 'Unknown member',
          subtitle: `${m.milestone_type} class · ${format(new Date(m.created_at), 'MMM d')} · ${m.created_by || 'Unknown'}`,
        }));
    }
    return data.referrals
      .filter(filterBySa(drill.sa))
      .map(r => ({
        id: `ref-${r.id}`,
        name: r.member_name || 'Unknown member',
        subtitle: `${r.class_date ? format(parseLocalDate(r.class_date), 'MMM d') : ''} · ${r.booked_by || 'Unknown'}`,
      }));
  }, [drill, data]);

  const drillTitle = drill
    ? `${drill.sa ?? 'Studio'} · ${drill.bucket === 'milestones' ? 'Milestones marked' : 'POS referral asks'}`
    : '';

  return (
    <>
      {/* Header tile row */}
      <div className="grid grid-cols-2 gap-2">
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
      </div>

      {/* SA leaderboard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            SA Leaderboard
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Tap a number to drill into the members. Tap an SA name to open their full page.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {data.loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
              <span className="text-xs text-muted-foreground">Loading…</span>
            </div>
          ) : sortedRows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No SA activity for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">SA</TableHead>
                    <TableHead className="text-xs text-center">Milestones</TableHead>
                    <TableHead className="text-xs text-center">Refs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map(row => (
                    <TableRow
                      key={row.name}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => navigate(`/sas/${encodeURIComponent(row.name)}`)}
                    >
                      <TableCell className="text-sm font-medium whitespace-nowrap">{row.name}</TableCell>
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
                      <TableCell className="text-sm text-center p-0">
                        <button
                          type="button"
                          disabled={row.referralAsks === 0}
                          onClick={e => { e.stopPropagation(); setDrill({ sa: row.name, bucket: 'referrals' }); }}
                          className="w-full min-h-[44px] px-3 cursor-pointer hover:bg-muted/40 hover:underline disabled:cursor-default disabled:hover:bg-transparent disabled:hover:no-underline"
                        >
                          {row.referralAsks}
                        </button>
                      </TableCell>
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
        title={drillTitle}
        scopeBadge="WIG · SA"
        subtitle={rangeLabel}
        rows={drillRows}
        emptyText="No records for this metric."
      />
    </>
  );
}
