import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Users, Pencil, Check } from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { PersonListDrillDown, type PersonRow } from '@/components/dashboard/PersonListDrillDown';
import { useSaLeaderboard } from '@/hooks/useSaLeaderboard';
import { useSaLeadsBooked } from '@/hooks/useSaLeadsBooked';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import type { DateRange } from '@/lib/pay-period';
import { isEligibleThreshold } from '@/lib/sa/saStreaks';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { notifyDataChanged } from '@/lib/data/invalidation';
import { getNowCentral } from '@/lib/dateUtils';
import { toast } from 'sonner';

interface Props {
  dateRange: DateRange | undefined;
}

type DrillBucket = 'milestones' | 'referrals' | 'leads';

const DEFAULT_SA_LEADS_TARGET = 4; // per SA per week

export function WigSaLeaderboard({ dateRange }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { salesAssociates: activeSas } = useActiveStaff();
  const rangeStart = dateRange ? format(dateRange.start, 'yyyy-MM-dd') : '2020-01-01';
  const rangeEnd = dateRange ? format(dateRange.end, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  const data = useSaLeaderboard(rangeStart, rangeEnd);
  const leads = useSaLeadsBooked(rangeStart, rangeEnd);

  const [drill, setDrill] = useState<{ sa: string | null; bucket: DrillBucket } | null>(null);

  // Per-period SA leads-booked target (per SA per week). Stored in
  // studio_settings under key `sa_leads_booked_target:YYYY-MM`.
  const targetMonthKey = useMemo(() => {
    const ym = dateRange ? format(dateRange.start, 'yyyy-MM') : format(getNowCentral(), 'yyyy-MM');
    return `sa_leads_booked_target:${ym}`;
  }, [dateRange]);

  const [leadsTarget, setLeadsTarget] = useState<number>(DEFAULT_SA_LEADS_TARGET);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState<string>(String(DEFAULT_SA_LEADS_TARGET));
  const [targetSaved, setTargetSaved] = useState(false);

  const loadTarget = useCallback(async () => {
    const { data: row } = await supabase
      .from('studio_settings')
      .select('setting_value')
      .eq('setting_key', targetMonthKey)
      .maybeSingle();
    let val: number | null = null;
    if (row) {
      const n = parseInt((row as any).setting_value, 10);
      if (!isNaN(n)) val = n;
    }
    const final = val ?? DEFAULT_SA_LEADS_TARGET;
    setLeadsTarget(final);
    setTargetInput(String(final));
  }, [targetMonthKey]);

  useEffect(() => { loadTarget(); }, [loadTarget]);

  const handleSaveTarget = async () => {
    const val = parseInt(targetInput, 10);
    if (isNaN(val) || val < 0) return;
    const { error } = await supabase
      .from('studio_settings')
      .upsert(
        {
          setting_key: targetMonthKey,
          setting_value: String(val),
          updated_by: user?.name || 'unknown',
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'setting_key' },
      );
    if (!error) {
      setLeadsTarget(val);
      setEditingTarget(false);
      setTargetSaved(true);
      setTimeout(() => setTargetSaved(false), 2000);
      notifyDataChanged(['sa_leads_booked_target'], 'sa-leads-target-edit');
      loadTarget();
    } else {
      toast.error('Failed to save target');
    }
  };

  const totals = useMemo(() => {
    const milestones = data.rows.reduce((s, r) => s + r.milestones, 0);
    const referrals = data.rows.reduce((s, r) => s + r.referralAsks, 0);
    return { milestones, referrals, leads: leads.total };
  }, [data.rows, leads.total]);

  // Team rollup target = per-SA target × active SA count. Never hardcoded.
  const teamLeadsTarget = leadsTarget * (activeSas?.length || 0);

  // Merge leads data into SA rows. Show every SA who appears in either source.
  const sortedRows = useMemo(() => {
    const leadsMap = new Map(leads.rows.map(r => [r.sa, r.count]));
    const allNames = new Set<string>([
      ...data.rows.map(r => r.name),
      ...leads.rows.map(r => r.sa),
    ]);
    return Array.from(allNames).map(name => {
      const base = data.rows.find(r => r.name === name);
      return {
        name,
        milestones: base?.milestones ?? 0,
        referralAsks: base?.referralAsks ?? 0,
        leadsBooked: leadsMap.get(name) ?? 0,
      };
    }).sort((a, b) =>
      b.leadsBooked - a.leadsBooked ||
      b.milestones - a.milestones ||
      b.referralAsks - a.referralAsks,
    );
  }, [data.rows, leads.rows]);

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
    if (drill.bucket === 'referrals') {
      return data.referrals
        .filter(filterBySa(drill.sa))
        .map(r => ({
          id: `ref-${r.id}`,
          name: r.member_name || 'Unknown member',
          subtitle: `${r.class_date ? format(parseLocalDate(r.class_date), 'MMM d') : ''} · ${r.booked_by || 'Unknown'}`,
        }));
    }
    // leads
    const saRows = drill.sa
      ? leads.rows.filter(r => r.sa === drill.sa)
      : leads.rows;
    return saRows.flatMap(r =>
      r.bookings.map(b => ({
        id: `lead-${b.id}`,
        name: b.member_name || 'Unknown member',
        subtitle: `${b.lead_source || 'Unknown source'} · ${format(new Date(b.created_at), 'MMM d')} · ${r.sa}`,
      })),
    );
  }, [drill, data, leads.rows]);

  const drillTitle = drill
    ? `${drill.sa ?? 'Studio'} · ${
        drill.bucket === 'milestones' ? 'Milestones marked'
        : drill.bucket === 'referrals' ? 'POS referral asks'
        : 'Leads booked'
      }`
    : '';

  return (
    <>
      {/* Header tile row */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <button
              type="button"
              onClick={() => setDrill({ sa: null, bucket: 'leads' })}
              disabled={totals.leads === 0}
              className="w-full min-h-[44px] cursor-pointer hover:bg-muted/40 rounded -m-1 p-1 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <p className="text-2xl font-bold text-primary">{totals.leads}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Leads booked</p>
              <p className="text-[10px] text-muted-foreground">team target {teamLeadsTarget}/wk</p>
            </button>
          </CardContent>
        </Card>
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

      {/* Per-SA leads target editor */}
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
        <div className="text-xs">
          <span className="font-medium">Per-SA leads-booked target: </span>
          <span className="text-primary font-semibold">{leadsTarget}</span>
          <span className="text-muted-foreground"> / SA / week</span>
        </div>
        {editingTarget ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={targetInput}
              onChange={e => setTargetInput(e.target.value)}
              className="h-7 w-16 text-xs"
              min={0}
            />
            <Button size="sm" className="h-7 px-2" onClick={handleSaveTarget}>Save</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditingTarget(false); setTargetInput(String(leadsTarget)); }}>Cancel</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingTarget(true)}>
            {targetSaved ? <><Check className="w-3 h-3 mr-1" />Saved</> : <><Pencil className="w-3 h-3 mr-1" />Edit target</>}
          </Button>
        )}
      </div>

      {/* SA leaderboard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            SA Leaderboard
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Tap a number to drill in. Tap an SA name to open their page.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {(data.loading || leads.loading) ? (
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
                    <TableHead className="text-xs text-center">Leads</TableHead>
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
                          disabled={row.leadsBooked === 0}
                          onClick={e => { e.stopPropagation(); setDrill({ sa: row.name, bucket: 'leads' }); }}
                          className="w-full min-h-[44px] px-3 cursor-pointer hover:bg-muted/40 hover:underline disabled:cursor-default disabled:hover:bg-transparent disabled:hover:no-underline"
                        >
                          <span className={row.leadsBooked >= leadsTarget ? 'text-success font-semibold' : ''}>
                            {row.leadsBooked}
                          </span>
                          <span className="text-[10px] text-muted-foreground"> /{leadsTarget}wk</span>
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
