import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Users, Pencil, Check, Trophy, Download, Plus, AlertCircle } from 'lucide-react';
import { SourcedLeadsDialog } from '@/components/wig/SourcedLeadsDialog';
import { SelfSourcedLeadDialog } from '@/components/leads/SelfSourcedLeadDialog';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { PersonListDrillDown, type PersonRow } from '@/components/dashboard/PersonListDrillDown';
import { PersonJourneyCard } from '@/components/person/PersonJourneyCard';
import { useSaAllBooked } from '@/hooks/useSaAllBooked';
import { useSaLeads, removeSelfSourcedRow, reassignSelfSourcedRow } from '@/hooks/useSaLeads';
import { useSaSales } from '@/hooks/useSaSales';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import type { DateRange } from '@/lib/pay-period';
import { useAuth } from '@/context/AuthContext';
import { isAdmin as isAdminCheck } from '@/lib/auth/roles';
import { getNowCentral } from '@/lib/dateUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { paceToToday, statusColor, statusClasses, formatPace } from '@/lib/wig/pace';
import {
  loadMonthlyTargets,
  saveMonthlyTarget,
  loadPerSaOverrides,
  savePerSaOverride,
  type MonthlyTargets,
  type TargetKind,
} from '@/lib/wig/targets';
import { useTrailingConversion, deriveBookedTargetFromSales } from '@/lib/wig/derivedBookedTarget';
import { useSomlEffectiveTargets } from '@/lib/soml/effectiveTargets';

interface Props {
  dateRange: DateRange | undefined;
}

type DrillBucket = 'leads' | 'sales' | 'sourced';

const VIP_SOURCES = new Set(['VIP Class', 'VIP Class (Friend)']);

/** Tiny inline R/Y/G bar — used in hero (loud) and in mini cells (quiet). */
function PaceBar({
  current,
  target,
  pace,
  size = 'sm',
}: {
  current: number;
  target: number | null;
  pace: number | null;
  size?: 'sm' | 'lg';
}) {
  const status = statusColor(current, pace);
  const cls = statusClasses(status);
  const pct = target && target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return (
    <div
      className={cn(
        'w-full rounded-full bg-secondary overflow-hidden',
        size === 'lg' ? 'h-3' : 'h-1.5',
      )}
    >
      <div
        className={cn('h-full rounded-full transition-all', cls.bar)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function WigSaLeaderboard({ dateRange }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = isAdminCheck(user);
  const { salesAssociates: activeSas, allActive } = useActiveStaff();
  const reassignChoices = useMemo(
    () => (allActive || []).filter(n => n && n !== 'Koa'),
    [allActive],
  );
  const rangeStart = dateRange ? format(dateRange.start, 'yyyy-MM-dd') : '2020-01-01';
  const rangeEnd = dateRange ? format(dateRange.end, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

  const booked = useSaAllBooked(rangeStart, rangeEnd);
  const sourcedLeads = useSaLeads(rangeStart, rangeEnd);
  const sales = useSaSales(rangeStart, rangeEnd);

  const [drill, setDrill] = useState<{ sa: string | null; bucket: DrillBucket } | null>(null);
  const [journeyBookingId, setJourneyBookingId] = useState<string | null>(null);
  const [sourcedLeadsOpen, setSourcedLeadsOpen] = useState(false);
  const [addLeadOpen, setAddLeadOpen] = useState(false);

  const yyyymm = useMemo(() => (
    dateRange ? format(dateRange.start, 'yyyy-MM') : format(getNowCentral(), 'yyyy-MM')
  ), [dateRange]);

  const [targets, setTargets] = useState<MonthlyTargets>({
    saSgl: null, saBooked: null, saSales: null, coachClose: null, studioLeads: null, netGain: null,
  });

  const [perSaOverrides, setPerSaOverrides] = useState<Record<string, number>>({});

  const refreshTargets = useCallback(async () => {
    const [t, overrides] = await Promise.all([
      loadMonthlyTargets(yyyymm),
      loadPerSaOverrides(yyyymm),
    ]);
    setTargets(t);
    setPerSaOverrides(overrides);
  }, [yyyymm]);
  useEffect(() => { refreshTargets(); }, [refreshTargets]);

  // Editor state — one slim editor per target.
  const [editing, setEditing] = useState<TargetKind | null>(null);
  const [inputVal, setInputVal] = useState<string>('');
  const [savedFlash, setSavedFlash] = useState<TargetKind | null>(null);

  // Per-SA override editor (individual lead goals — for vacations, new hires, etc.)
  const [editingSa, setEditingSa] = useState<string | null>(null);
  const [saInputVal, setSaInputVal] = useState<string>('');
  const [saSavedFlash, setSaSavedFlash] = useState<string | null>(null);

  const openEdit = (k: TargetKind, current: number | null) => {
    setEditing(k);
    setInputVal(current == null ? '' : String(current));
  };
  const saveEdit = async () => {
    if (!editing) return;
    const v = parseInt(inputVal, 10);
    if (isNaN(v) || v < 0) { toast.error('Enter a number ≥ 0'); return; }
    const { error } = await saveMonthlyTarget(editing, yyyymm, v, user?.name || 'unknown');
    if (error) { toast.error('Save failed'); return; }
    setSavedFlash(editing);
    setEditing(null);
    setTimeout(() => setSavedFlash(null), 2000);
    refreshTargets();
  };

  const openSaEdit = (sa: string, current: number | null) => {
    setEditingSa(sa);
    setSaInputVal(current == null ? '' : String(current));
  };
  const saveSaEdit = async () => {
    if (!editingSa) return;
    const trimmed = saInputVal.trim();
    let val: number | null = null;
    if (trimmed !== '') {
      const v = parseInt(trimmed, 10);
      if (isNaN(v) || v < 0) { toast.error('Enter a number ≥ 0 (or blank to clear)'); return; }
      val = v;
    }
    const { error } = await savePerSaOverride(yyyymm, editingSa, val, user?.name || 'unknown');
    if (error) { toast.error('Save failed'); return; }
    setSaSavedFlash(editingSa);
    setEditingSa(null);
    setTimeout(() => setSaSavedFlash(null), 2000);
    refreshTargets();
  };

  // ── Per-SA pace (uses CST today, scoped to target's calendar month) ──
  const today = getNowCentral();
  // The pace anchors to "today in CST" inside the calendar month the user
  // is looking at. When viewing a past month, we cap to the last day of
  // that month so pace = full monthly target (period closed).
  const paceAnchor = useMemo(() => {
    if (!dateRange) return today;
    const startY = dateRange.start.getFullYear();
    const startM = dateRange.start.getMonth();
    const lastDay = new Date(startY, startM + 1, 0);
    if (today < dateRange.start) return dateRange.start;
    if (today > lastDay) return lastDay;
    return today;
  }, [dateRange, today]);

  // Booked Intros target is DERIVED from the SOML effective per-SA sales goal
  // ÷ trailing 60d conversion. Same helper + same SOML source as the shift
  // header — one source of truth. Never the flat sa_sales_target setting.
  const { data: trailing } = useTrailingConversion();
  const somlTargets = useSomlEffectiveTargets();

  // Per-SA effective SOML sales goal (used for the derived Booked target).
  // Default = team goal ÷ active SAs when no per-SA override exists.
  const activeCountForSoml = Math.max(1, (activeSas || []).filter(n => n !== 'Koa').length);
  const perSaSalesDefault = somlTargets.config
    ? (somlTargets.teamGoal('sales') || 0) / activeCountForSoml
    : null;
  const derivedSaBookedTarget = useMemo(
    () => deriveBookedTargetFromSales(perSaSalesDefault, trailing),
    [perSaSalesDefault, trailing],
  );

  const perSaPace = {
    sgl: paceToToday(targets.saSgl, paceAnchor),
    booked: paceToToday(derivedSaBookedTarget, paceAnchor),
    sales: paceToToday(perSaSalesDefault, paceAnchor),
  };

  // Active SA count (Koa = Admin, not on the SA leaderboard).
  const rosterSas = useMemo(
    () => (activeSas || []).filter(n => n !== 'Koa'),
    [activeSas],
  );
  const activeCount = rosterSas.length;

  // Team SGL goal is LOCKED to (global per-SA target × active count).
  // Individual overrides no longer lower the team goal — instead they
  // redistribute the remaining shortfall across non-overridden SAs
  // so the team total still hits the monthly goal.
  const teamSglTarget = useMemo(() => {
    if (targets.saSgl == null) return null;
    return targets.saSgl * activeCount;
  }, [targets.saSgl, activeCount]);

  const overrideStats = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (const sa of rosterSas) {
      if (Object.prototype.hasOwnProperty.call(perSaOverrides, sa)) {
        sum += perSaOverrides[sa] || 0;
        count += 1;
      }
    }
    return { sum, count };
  }, [rosterSas, perSaOverrides]);

  const redistributedPerSa = useMemo(() => {
    if (teamSglTarget == null) return null;
    const nonOverridden = activeCount - overrideStats.count;
    if (nonOverridden <= 0) return 0;
    const remaining = Math.max(0, teamSglTarget - overrideStats.sum);
    return remaining / nonOverridden;
  }, [teamSglTarget, overrideStats, activeCount]);

  // Effective per-SA SGL target: override wins, else the redistributed default.
  const effectiveSaSglTarget = useCallback(
    (sa: string): number | null => {
      if (Object.prototype.hasOwnProperty.call(perSaOverrides, sa)) return perSaOverrides[sa];
      return redistributedPerSa ?? targets.saSgl;
    },
    [perSaOverrides, redistributedPerSa, targets.saSgl],
  );

  const teamTargets = {
    sgl: teamSglTarget,
    booked: derivedSaBookedTarget != null ? derivedSaBookedTarget * activeCount : null,
    sales: targets.saSales != null ? targets.saSales * activeCount : null,
  };
  const teamPace = {
    sgl: paceToToday(teamTargets.sgl, paceAnchor),
    booked: paceToToday(teamTargets.booked, paceAnchor),
    sales: paceToToday(teamTargets.sales, paceAnchor),
  };

  // Active SA set — used to suppress phantom/inactive names from the leaderboard.
  const activeSet = useMemo(() => new Set(activeSas || []), [activeSas]);

  const sortedRows = useMemo(() => {
    const bookedMap = new Map<string, number>(booked.rows.map(r => [r.sa, r.count] as const));
    const sourcedMap = new Map<string, number>(sourcedLeads.rows.map(r => [r.sa, r.count] as const));
    const salesMap = new Map<string, number>(sales.rows.map(r => [r.sa, r.count] as const));
    const allNames = new Set<string>([
      ...activeSet,
      ...booked.rows.map(r => r.sa),
      ...sourcedLeads.rows.map(r => r.sa),
      ...sales.rows.map(r => r.sa),
    ]);
    return Array.from(allNames)
      .filter(name => activeSet.has(name) && name !== 'Koa')
      .map(name => ({
        name,
        sgl: sourcedMap.get(name) ?? 0,
        booked: bookedMap.get(name) ?? 0,
        sales: salesMap.get(name) ?? 0,
      }))
      // Sort by SGL desc — the lead measure SAs control.
      .sort((a, b) =>
        b.sgl - a.sgl ||
        b.booked - a.booked ||
        b.sales - a.sales ||
        a.name.localeCompare(b.name),
      );
  }, [booked.rows, sourcedLeads.rows, sales.rows, activeSet]);

  const totals = useMemo(() => ({
    sgl: sortedRows.reduce((s, r) => s + r.sgl, 0),
    booked: sortedRows.reduce((s, r) => s + r.booked, 0),
    sales: sortedRows.reduce((s, r) => s + r.sales, 0),
  }), [sortedRows]);

  const rangeLabel = dateRange
    ? `${format(dateRange.start, 'MMM d')} – ${format(dateRange.end, 'MMM d, yyyy')}`
    : 'All time';
  const monthLabel = format(paceAnchor, 'MMMM');

  // ── Drilldown plumbing (unchanged) ──
  const leadsBreakdownSubtitle = useMemo(() => {
    if (!drill || drill.bucket !== 'leads') return undefined;
    const saRows = drill.sa ? booked.rows.filter(r => r.sa === drill.sa) : booked.rows;
    const counts = new Map<string, number>();
    for (const r of saRows) {
      for (const b of r.bookings) {
        const src = b.lead_source || 'Unknown';
        const label = VIP_SOURCES.has(src) ? `${src} (set up by ${r.sa})` : src;
        counts.set(label, (counts.get(label) || 0) + 1);
      }
    }
    if (counts.size === 0) return undefined;
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
  }, [drill, booked.rows]);

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
        outcomeEdit: run.linked_intro_booked_id ? { bookingId: run.linked_intro_booked_id } : undefined,
        onClick: run.linked_intro_booked_id ? () => setJourneyBookingId(run.linked_intro_booked_id!) : undefined,
      })));
    }
    if (drill.bucket === 'sourced') {
      const saRows = drill.sa ? sourcedLeads.rows.filter(r => r.sa === drill.sa) : sourcedLeads.rows;
      return saRows.flatMap(r => r.people.map(p => ({
        id: p.id,
        name: p.name,
        subtitle: `${p.source || 'Unknown source'} · ${format(new Date(p.created_at), 'MMM d')} · ${r.sa}${p.booked ? ' · booked ✓' : ' · not booked yet'}`,
        rightLabel: p.booked ? 'Booked' : 'Lead',
        rightTone: (p.booked ? 'success' : 'primary') as 'success' | 'primary',
        onClick: p.booking_id ? () => setJourneyBookingId(p.booking_id!) : undefined,
        onRemove: isAdmin ? () => removeSelfSourcedRow(p.id).then(() => sourcedLeads.refetch()) : undefined,
        removeConfirm: `Remove ${p.name} from ${r.sa}'s self-generated count?\n\nThis won't delete the booking or the lead — it just excludes it from this metric.`,
        onReassign: isAdmin && !p.id.startsWith('vip-')
          ? (newSa: string) => reassignSelfSourcedRow(p.id, newSa).then(() => sourcedLeads.refetch())
          : undefined,
        reassignChoices: isAdmin ? reassignChoices : undefined,
        currentSa: r.sa,
      })));
    }
    const saRows = drill.sa ? booked.rows.filter(r => r.sa === drill.sa) : booked.rows;
    const flat = saRows.flatMap(r =>
      r.bookings.map(b => {
        const src = b.lead_source || 'Unknown';
        const sourceLabel = VIP_SOURCES.has(src) ? `${src} (set up by ${r.sa})` : src;
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
  }, [drill, booked.rows, sourcedLeads.rows, sales.rows, isAdmin, reassignChoices]);

  const drillTitle = drill
    ? `${drill.sa ?? 'Studio'} · ${drill.bucket === 'sales' ? 'Sales' : drill.bucket === 'sourced' ? 'Self generated leads' : 'Booked intros'}`
    : '';

  // ── HERO: team self-generated leads vs team SGL target ──
  const heroStatus = statusColor(totals.sgl, teamPace.sgl);
  const heroCls = statusClasses(heroStatus);
  const heroTargetUnset = targets.saSgl == null;

  return (
    <>
      {/* ===== HERO — Team Self-Generated Leads ===== */}
      <Card className={cn('border-2 ring-2 ring-offset-0', heroCls.ring)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className={cn('w-4 h-4', heroCls.text)} />
            <span className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
              Team self-generated leads · {monthLabel}
            </span>
          </div>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-7xl font-black tabular-nums leading-none text-foreground">
              {totals.sgl}
            </span>
            <span className="text-xl text-foreground">
              of {teamPace.sgl != null ? Math.round(teamPace.sgl) : <em className="not-italic text-warning">CONFIRM THIS VALUE</em>} today
            </span>
          </div>
          <PaceBar current={totals.sgl} target={teamTargets.sgl} pace={teamPace.sgl} size="lg" />
          <div className="mt-2 flex items-center justify-between gap-3 flex-wrap text-base text-foreground">
            <span>
              Pace today: <span className={cn('font-bold', heroCls.text)}>{formatPace(teamPace.sgl)}</span>
              {' · '}
              {heroStatus === 'green' && 'at or ahead of pace ✓'}
              {heroStatus === 'yellow' && 'a little behind today'}
              {heroStatus === 'red' && 'behind today — close the gap'}
              {heroStatus === 'unset' && 'set per-SA SGL target to start'}
            </span>
            <span className="text-sm text-foreground">
              Month goal: <span className="font-bold">{teamTargets.sgl ?? '—'}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              Per-SA: <span className="font-bold">{targets.saSgl ?? '—'}</span>
              <span className="mx-1">×</span>
              {activeCount} SAs
              {overrideStats.count > 0 && redistributedPerSa != null && (
                <span className="ml-2 text-primary italic">
                  ({overrideStats.count} overridden → others {redistributedPerSa.toFixed(1)} each)
                </span>
              )}
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 ml-2 text-xs"
                  onClick={() => openEdit('saSgl', targets.saSgl)}
                >
                  {savedFlash === 'saSgl' ? <><Check className="w-3 h-3 mr-1" />Saved</> : <><Pencil className="w-3 h-3 mr-1" />Edit</>}
                </Button>
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Per-SA SGL target editor (Booked/Sales targets live on Studio tab) */}
      {isAdmin && (
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
          <span className="text-muted-foreground">Per-SA leads target ({monthLabel})</span>
          {editing === 'saSgl' ? (
            <div className="flex items-center gap-1">
              <Input
                type="number" min={0}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null); }}
                className="h-8 w-20 text-sm"
                autoFocus
              />
              <Button size="sm" className="h-8 px-2" onClick={saveEdit}>Save</Button>
            </div>
          ) : (
            <button
              type="button"
              className="flex items-center gap-1 font-semibold text-foreground hover:text-primary"
              onClick={() => openEdit('saSgl', targets.saSgl)}
            >
              {targets.saSgl == null ? <span className="text-warning">set</span> : targets.saSgl}
              {savedFlash === 'saSgl' ? <Check className="w-3.5 h-3.5 text-success" /> : <Pencil className="w-3.5 h-3.5 opacity-50" />}
            </button>
          )}
        </div>
      )}

      {/* ===== OrangeBook import reminder ===== */}
      {(() => {
        let needsImport = 0;
        for (const r of sourcedLeads.rows) {
          if (!activeSet.has(r.sa) || r.sa === 'Koa') continue;
          for (const p of r.people) {
            const isVipRegistrant = p.id.startsWith('vip-');
            const inMindbody = !!p.booked || !!p.mindbody_imported_at || isVipRegistrant;
            if (!inMindbody) needsImport += 1;
          }
        }
        if (needsImport === 0) return null;
        return (
          <button
            type="button"
            onClick={() => setSourcedLeadsOpen(true)}
            className="w-full flex items-center justify-between gap-3 rounded-lg border-2 border-primary bg-primary/10 hover:bg-primary/15 px-4 py-3 text-left transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <AlertCircle className="w-5 h-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-primary">
                  {needsImport} sourced {needsImport === 1 ? 'lead' : 'leads'} still {needsImport === 1 ? 'needs' : 'need'} to be imported into OrangeBook
                </p>
                <p className="text-xs text-muted-foreground">
                  Tap to review and check them off. This banner clears once the list is empty.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-primary shrink-0">Open list →</span>
          </button>
        );
      })()}

      {/* ===== SA Leaderboard ===== */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                SA Leaderboard
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Self-generated leads — the one number SAs control. Tap an SA to open their page; tap a number to see who.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                onClick={() => setAddLeadOpen(true)}
                className="min-h-[44px] cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Lead
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSourcedLeadsOpen(true)}
                className="min-h-[44px] cursor-pointer"
              >
                <Download className="w-4 h-4 mr-2" />
                Sourced Leads
              </Button>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
            <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="text-foreground">
              <span className="font-semibold">All leads go in OrangeBook, not Mindbody.</span>{' '}
              Add every self-generated lead here, then check it off in <span className="font-medium">Sourced Leads</span> once it's entered in OrangeBook.
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(booked.loading || sales.loading || sourcedLeads.loading) ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Loading…</span>
            </div>
          ) : sortedRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No SA activity for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-sm w-10">#</TableHead>
                    <TableHead className="text-sm">SA</TableHead>
                    <TableHead className="text-sm text-center">
                      Leads
                      <div className="text-xs font-normal text-muted-foreground mt-0.5">
                        individual monthly goal (tap {isAdmin ? 'pencil' : 'admin'} to adjust for vacation, etc.)
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((row, idx) => {
                    const saTarget = effectiveSaSglTarget(row.name);
                    const saPace = paceToToday(saTarget, paceAnchor);
                    const hasOverride = Object.prototype.hasOwnProperty.call(perSaOverrides, row.name);
                    const isEditingThis = editingSa === row.name;
                    return (
                      <TableRow
                        key={row.name}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => navigate(`/sas/${encodeURIComponent(row.name)}`)}
                      >
                        <TableCell className="text-sm text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                        <TableCell className="text-base font-medium whitespace-nowrap">{row.name}</TableCell>
                        <TableCell className="text-base text-center p-0">
                          <button
                            type="button"
                            disabled={row.sgl === 0}
                            onClick={e => { e.stopPropagation(); setDrill({ sa: row.name, bucket: 'sourced' }); }}
                            className="w-full min-h-[48px] px-3 cursor-pointer hover:bg-muted/40 disabled:cursor-default disabled:hover:bg-transparent"
                          >
                            <div className="text-4xl font-black tabular-nums text-foreground">
                              {row.sgl}
                              <span className="ml-1 text-sm font-normal text-foreground">/ {formatPace(saPace)}</span>
                            </div>
                            <div className="mt-1 px-2">
                              <PaceBar current={row.sgl} target={saTarget} pace={saPace} />
                            </div>
                          </button>
                          <div className="flex items-center justify-center gap-1.5 pb-2 pt-1 text-xs text-muted-foreground" onClick={e => e.stopPropagation()}>
                            {isEditingThis ? (
                              <>
                                <Input
                                  type="number" min={0}
                                  value={saInputVal}
                                  onChange={e => setSaInputVal(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveSaEdit(); if (e.key === 'Escape') setEditingSa(null); }}
                                  className="h-7 w-20 text-xs"
                                  placeholder={targets.saSgl == null ? '—' : String(targets.saSgl)}
                                  autoFocus
                                />
                                <Button size="sm" className="h-7 px-2 text-xs" onClick={saveSaEdit}>Save</Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingSa(null)}>Cancel</Button>
                              </>
                            ) : (
                              <>
                                <span>
                                  goal: <span className={cn('font-semibold', hasOverride ? 'text-primary' : 'text-foreground')}>{saTarget ?? '—'}</span>
                                  {hasOverride && <span className="ml-1 text-[10px] uppercase tracking-wide text-primary">custom</span>}
                                </span>
                                {isAdmin && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-1.5"
                                    onClick={() => openSaEdit(row.name, saTarget)}
                                  >
                                    {saSavedFlash === row.name ? <Check className="w-3 h-3 text-success" /> : <Pencil className="w-3 h-3 opacity-60" />}
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="border-t-2 border-border bg-muted/30 font-bold">
                    <TableCell />
                    <TableCell className="text-base font-bold">Team</TableCell>
                    <TableCell className="text-3xl text-center font-black tabular-nums text-foreground">
                      {totals.sgl} <span className="text-foreground font-normal text-base">/ {teamPace.sgl != null ? Math.round(teamPace.sgl) : '—'} today</span>
                    </TableCell>
                  </TableRow>
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
      <SourcedLeadsDialog
        open={sourcedLeadsOpen}
        onOpenChange={setSourcedLeadsOpen}
        initialRange={dateRange}
        saRowsOverride={sourcedLeads.rows}
        loadingOverride={sourcedLeads.loading}
        rangeStartOverride={rangeStart}
        rangeEndOverride={rangeEnd}
      />
      <SelfSourcedLeadDialog open={addLeadOpen} onOpenChange={setAddLeadOpen} onLeadAdded={() => sourcedLeads.refetch()} />
    </>
  );
}
