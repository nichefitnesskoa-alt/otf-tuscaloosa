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
import { PersonJourneyCard } from '@/components/person/PersonJourneyCard';
import { useSaLeadsBooked } from '@/hooks/useSaLeadsBooked';
import { useSaSales } from '@/hooks/useSaSales';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import type { DateRange } from '@/lib/pay-period';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { notifyDataChanged } from '@/lib/data/invalidation';
import { getNowCentral } from '@/lib/dateUtils';
import { toast } from 'sonner';

interface Props {
  dateRange: DateRange | undefined;
}

type DrillBucket = 'leads' | 'sales';

const DEFAULT_SA_LEADS_TARGET = 16; // per SA per MONTH
const DEFAULT_SA_SALES_TARGET = 1;  // per SA per week

const VIP_SOURCES = new Set(['VIP Class', 'VIP Class (Friend)']);

export function WigSaLeaderboard({ dateRange }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { salesAssociates: activeSas } = useActiveStaff();
  const rangeStart = dateRange ? format(dateRange.start, 'yyyy-MM-dd') : '2020-01-01';
  const rangeEnd = dateRange ? format(dateRange.end, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  
  const leads = useSaLeadsBooked(rangeStart, rangeEnd);
  const sales = useSaSales(rangeStart, rangeEnd);

  const [drill, setDrill] = useState<{ sa: string | null; bucket: DrillBucket } | null>(null);
  const [journeyBookingId, setJourneyBookingId] = useState<string | null>(null);

  // Per-period targets stored in studio_settings under
  // `sa_leads_booked_target:YYYY-MM` and `sa_sales_target:YYYY-MM`.
  const yyyymm = useMemo(() => (
    dateRange ? format(dateRange.start, 'yyyy-MM') : format(getNowCentral(), 'yyyy-MM')
  ), [dateRange]);
  const leadsTargetKey = `sa_leads_booked_target:${yyyymm}`;
  const salesTargetKey = `sa_sales_target:${yyyymm}`;

  const [leadsTarget, setLeadsTarget] = useState<number>(DEFAULT_SA_LEADS_TARGET);
  const [salesTarget, setSalesTarget] = useState<number>(DEFAULT_SA_SALES_TARGET);
  const [editingLeads, setEditingLeads] = useState(false);
  const [editingSales, setEditingSales] = useState(false);
  const [leadsInput, setLeadsInput] = useState<string>(String(DEFAULT_SA_LEADS_TARGET));
  const [salesInput, setSalesInput] = useState<string>(String(DEFAULT_SA_SALES_TARGET));
  const [leadsSaved, setLeadsSaved] = useState(false);
  const [salesSaved, setSalesSaved] = useState(false);

  const loadTargets = useCallback(async () => {
    const { data: rows } = await supabase
      .from('studio_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [leadsTargetKey, salesTargetKey]);
    const map = new Map(((rows as any[]) || []).map(r => [r.setting_key, r.setting_value]));
    const lt = parseInt(map.get(leadsTargetKey) || '', 10);
    const st = parseInt(map.get(salesTargetKey) || '', 10);
    const finalLt = isNaN(lt) ? DEFAULT_SA_LEADS_TARGET : lt;
    const finalSt = isNaN(st) ? DEFAULT_SA_SALES_TARGET : st;
    setLeadsTarget(finalLt); setLeadsInput(String(finalLt));
    setSalesTarget(finalSt); setSalesInput(String(finalSt));
  }, [leadsTargetKey, salesTargetKey]);

  useEffect(() => { loadTargets(); }, [loadTargets]);

  const saveTarget = async (key: string, value: number, scope: string) => {
    const { error } = await supabase
      .from('studio_settings')
      .upsert(
        {
          setting_key: key,
          setting_value: String(value),
          updated_by: user?.name || 'unknown',
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'setting_key' },
      );
    if (error) { toast.error('Failed to save target'); return false; }
    notifyDataChanged([scope], `${scope}-edit`);
    return true;
  };

  const handleSaveLeads = async () => {
    const v = parseInt(leadsInput, 10);
    if (isNaN(v) || v < 0) return;
    if (await saveTarget(leadsTargetKey, v, 'sa_leads_booked_target')) {
      setLeadsTarget(v); setEditingLeads(false); setLeadsSaved(true);
      setTimeout(() => setLeadsSaved(false), 2000);
      loadTargets();
    }
  };
  const handleSaveSales = async () => {
    const v = parseInt(salesInput, 10);
    if (isNaN(v) || v < 0) return;
    if (await saveTarget(salesTargetKey, v, 'sa_sales_target')) {
      setSalesTarget(v); setEditingSales(false); setSalesSaved(true);
      setTimeout(() => setSalesSaved(false), 2000);
      loadTargets();
    }
  };

  const totals = useMemo(() => {
    return { leads: leads.total, sales: sales.total };
  }, [leads.total, sales.total]);

  // Period-aware target math.
  // - Leads target is MONTHLY per SA. Period goal = round(monthly × days/monthDays).
  // - Sales target is WEEKLY per SA. Period goal = weekly × ceil(days/7).
  // Pro-rata-to-today scales linearly across elapsed days in the selected range.
  const { weeksInPeriod, leadsPeriodGoal, salesPeriodGoal, leadsProRata, salesProRata, isSingleWeek } = useMemo(() => {
    if (!dateRange) {
      return { weeksInPeriod: 1, leadsPeriodGoal: Math.round(leadsTarget / 4), salesPeriodGoal: salesTarget,
               leadsProRata: Math.round(leadsTarget / 4), salesProRata: salesTarget, isSingleWeek: true };
    }
    const msDay = 86400000;
    const days = Math.max(1, Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / msDay) + 1);
    const weeks = Math.max(1, Math.ceil(days / 7));
    // Days in the calendar month of the range start (CST-safe via UTC math on Y/M).
    const startY = dateRange.start.getFullYear();
    const startM = dateRange.start.getMonth();
    const monthDays = new Date(startY, startM + 1, 0).getDate();
    const today = getNowCentral();
    const cappedToday = today < dateRange.start ? dateRange.start : today > dateRange.end ? dateRange.end : today;
    const elapsedDays = Math.max(1, Math.round((cappedToday.getTime() - dateRange.start.getTime()) / msDay) + 1);
    const elapsedWeeks = Math.min(weeks, elapsedDays / 7);
    return {
      weeksInPeriod: weeks,
      leadsPeriodGoal: Math.max(1, Math.round(leadsTarget * days / monthDays)),
      salesPeriodGoal: salesTarget * weeks,
      leadsProRata: leadsTarget * elapsedDays / monthDays,
      salesProRata: salesTarget * elapsedWeeks,
      isSingleWeek: weeks === 1,
    };
  }, [dateRange, leadsTarget, salesTarget]);

  // Team rollup targets = per-SA × active SA count × weeks.
  const activeCount = activeSas?.length || 0;
  const teamLeadsTarget = leadsPeriodGoal * activeCount;
  const teamSalesTarget = salesPeriodGoal * activeCount;

  // Active SA set — used to suppress phantom/inactive names from the leaderboard.
  const activeSet = useMemo(() => new Set(activeSas || []), [activeSas]);

  // Merge leads + sales into per-SA rows. Only include names that are currently
  // active SAs OR appear with non-zero activity (we then filter again for active).
  const sortedRows = useMemo(() => {
    const leadsMap = new Map(leads.rows.map(r => [r.sa, r.count]));
    const salesMap = new Map(sales.rows.map(r => [r.sa, r.count]));
    const allNames = new Set<string>([
      ...activeSet,
      ...leads.rows.map(r => r.sa),
      ...sales.rows.map(r => r.sa),
    ]);
    return Array.from(allNames)
      // Only show people who are currently active SAs. Inactive/legacy/phantom
      // names that somehow slipped through never appear on the leaderboard.
      .filter(name => activeSet.has(name))
      .map(name => ({
        name,
        leadsBooked: leadsMap.get(name) ?? 0,
        sales: salesMap.get(name) ?? 0,
      }))
      .sort((a, b) =>
        b.sales - a.sales ||
        b.leadsBooked - a.leadsBooked ||
        a.name.localeCompare(b.name),
      );
  }, [leads.rows, sales.rows, activeSet]);

  const rangeLabel = dateRange
    ? `${format(dateRange.start, 'MMM d')} – ${format(dateRange.end, 'MMM d, yyyy')}`
    : 'All time';

  // VIP-creator + lead-source breakdown for a given SA (or studio-wide if null).
  const leadsBreakdownSubtitle = useMemo(() => {
    if (!drill || drill.bucket !== 'leads') return undefined;
    const saRows = drill.sa ? leads.rows.filter(r => r.sa === drill.sa) : leads.rows;
    const counts = new Map<string, number>();
    for (const r of saRows) {
      for (const b of r.bookings) {
        const src = b.lead_source || 'Unknown';
        // VIP-class bookings: label with which SA set the VIP up.
        // The credit SA == sa_setup_name by helper definition, so for a
        // single-SA drilldown all VIP rows are "set up by drill.sa".
        const label = VIP_SOURCES.has(src)
          ? `${src} (set up by ${r.sa})`
          : src;
        counts.set(label, (counts.get(label) || 0) + 1);
      }
    }
    if (counts.size === 0) return undefined;
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
  }, [drill, leads.rows]);

  const drillRows: PersonRow[] = useMemo(() => {
    if (!drill) return [];
    if (drill.bucket === 'sales') {
      const saRows = drill.sa ? sales.rows.filter(r => r.sa === drill.sa) : sales.rows;
      return saRows.flatMap(r => r.runs.map(({ run, member, closeYMD }) => ({
        id: `sale-${run.id}`,
        name: member || 'Unknown member',
        subtitle: `${run.result_canon || 'SALE'} · closed ${format(parseLocalDate(closeYMD) || new Date(closeYMD), 'MMM d')} · ${r.sa}`,
        rightLabel: run.result_canon || undefined,
        rightTone: 'success' as const,
        outcomeEdit: run.linked_intro_booked_id
          ? { bookingId: run.linked_intro_booked_id }
          : undefined,
        onClick: run.linked_intro_booked_id
          ? () => setJourneyBookingId(run.linked_intro_booked_id!)
          : undefined,
      })));
    }
    // leads — group visually by sorting by lead_source so they cluster.
    const saRows = drill.sa
      ? leads.rows.filter(r => r.sa === drill.sa)
      : leads.rows;
    const flat = saRows.flatMap(r =>
      r.bookings.map(b => {
        const src = b.lead_source || 'Unknown';
        const sourceLabel = VIP_SOURCES.has(src)
          ? `${src} (set up by ${r.sa})`
          : src;
        return {
          id: `lead-${b.id}`,
          name: b.member_name || 'Unknown member',
          subtitle: `${sourceLabel} · ${format(new Date(b.created_at), 'MMM d')} · ${r.sa}`,
          rightLabel: src,
          rightTone: (VIP_SOURCES.has(src) ? 'primary' : 'muted') as 'primary' | 'muted',
          onClick: () => setJourneyBookingId(b.id),
          _src: sourceLabel,
        };
      }),
    );
    return flat.sort((a, b) => a._src.localeCompare(b._src)).map(({ _src, ...row }) => row);
  }, [drill, leads.rows, sales.rows]);

  const drillTitle = drill
    ? `${drill.sa ?? 'Studio'} · ${drill.bucket === 'sales' ? 'Sales' : 'Leads booked'}`
    : '';

  return (
    <>
      {/* Header tile row — 2 tiles (leads + sales) */}
      <div className="grid grid-cols-2 gap-2">
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
              <p className="text-[10px] text-muted-foreground">team goal {teamLeadsTarget} ({rangeLabel})</p>
            </button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <button
              type="button"
              onClick={() => setDrill({ sa: null, bucket: 'sales' })}
              disabled={totals.sales === 0}
              className="w-full min-h-[44px] cursor-pointer hover:bg-muted/40 rounded -m-1 p-1 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <p className="text-2xl font-bold text-primary">{totals.sales}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Sales</p>
              <p className="text-[10px] text-muted-foreground">team goal {teamSalesTarget}{isSingleWeek ? '/wk' : ` (${rangeLabel})`}</p>
            </button>
          </CardContent>
        </Card>
      </div>


      {/* Per-SA target editors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
          <div className="text-xs">
            <span className="font-medium">Per-SA leads target: </span>
            <span className="text-primary font-semibold">{leadsTarget}</span>
            <span className="text-muted-foreground"> / SA / month</span>
          </div>
          {editingLeads ? (
            <div className="flex items-center gap-1">
              <Input type="number" value={leadsInput} onChange={e => setLeadsInput(e.target.value)} className="h-7 w-16 text-xs" min={0} />
              <Button size="sm" className="h-7 px-2" onClick={handleSaveLeads}>Save</Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditingLeads(false); setLeadsInput(String(leadsTarget)); }}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingLeads(true)}>
              {leadsSaved ? <><Check className="w-3 h-3 mr-1" />Saved</> : <><Pencil className="w-3 h-3 mr-1" />Edit target</>}
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
          <div className="text-xs">
            <span className="font-medium">Per-SA sales target: </span>
            <span className="text-primary font-semibold">{salesTarget}</span>
            <span className="text-muted-foreground"> / SA / week</span>
          </div>
          {editingSales ? (
            <div className="flex items-center gap-1">
              <Input type="number" value={salesInput} onChange={e => setSalesInput(e.target.value)} className="h-7 w-16 text-xs" min={0} />
              <Button size="sm" className="h-7 px-2" onClick={handleSaveSales}>Save</Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditingSales(false); setSalesInput(String(salesTarget)); }}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingSales(true)}>
              {salesSaved ? <><Check className="w-3 h-3 mr-1" />Saved</> : <><Pencil className="w-3 h-3 mr-1" />Edit target</>}
            </Button>
          )}
        </div>
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
          {(leads.loading || sales.loading) ? (
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
                    <TableHead className="text-xs text-center">
                      Leads booked
                      <div className="text-[9px] font-normal text-muted-foreground">
                        goal {leadsPeriodGoal} ({leadsTarget}/mo prorated)
                      </div>
                    </TableHead>
                    <TableHead className="text-xs text-center">
                      Sales
                      <div className="text-[9px] font-normal text-muted-foreground">
                        goal {salesPeriodGoal}{isSingleWeek ? '' : ` (${salesTarget}/wk × ${weeksInPeriod}wk)`}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map(row => {
                    const leadsOnPace = row.leadsBooked >= leadsProRata;
                    const salesOnPace = row.sales >= salesProRata;
                    const leadsHit = row.leadsBooked >= leadsPeriodGoal;
                    const salesHit = row.sales >= salesPeriodGoal;
                    return (
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
                          <div className={leadsHit ? 'text-success font-semibold' : leadsOnPace ? 'text-foreground font-medium' : 'text-warning'}>
                            {row.leadsBooked} <span className="text-muted-foreground font-normal">of {leadsPeriodGoal}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {leadsHit ? 'goal hit ✓' : leadsOnPace ? 'on pace ✓' : 'behind pace'}
                          </div>
                        </button>
                      </TableCell>
                      <TableCell className="text-sm text-center p-0">
                        <button
                          type="button"
                          disabled={row.sales === 0}
                          onClick={e => { e.stopPropagation(); setDrill({ sa: row.name, bucket: 'sales' }); }}
                          className="w-full min-h-[44px] px-3 cursor-pointer hover:bg-muted/40 hover:underline disabled:cursor-default disabled:hover:bg-transparent disabled:hover:no-underline"
                        >
                          <div className={salesHit ? 'text-success font-semibold' : salesOnPace ? 'text-foreground font-medium' : 'text-warning'}>
                            {row.sales} <span className="text-muted-foreground font-normal">of {salesPeriodGoal}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {salesHit ? 'goal hit ✓' : salesOnPace ? 'on pace ✓' : 'behind pace'}
                          </div>
                        </button>
                      </TableCell>
                    </TableRow>
                  );})}
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
        subtitle={drill?.bucket === 'leads' && leadsBreakdownSubtitle
          ? `${rangeLabel} · ${leadsBreakdownSubtitle}`
          : rangeLabel}
        rows={drillRows}
        emptyText="No records for this metric."
      />
      {journeyBookingId && (
        <PersonJourneyCard
          open={!!journeyBookingId}
          onOpenChange={o => { if (!o) setJourneyBookingId(null); }}
          identifier={{ bookingId: journeyBookingId }}
          scopeBadge="WIG drilldown"
        />
      )}
    </>
  );
}
