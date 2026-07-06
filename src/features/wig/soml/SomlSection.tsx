/**
 * Summer of More Life — self-contained WIG-page section.
 * Visually distinct block, but reuses the exact pace + status helpers as
 * the Leads scoreboard so the two read as siblings, not different apps.
 */
import { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sun, Pencil, Plus, Check, Users, TrendingUp, DollarSign, Calendar, Info, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { useEffectiveAdmin } from '@/hooks/useViewAsAdmin';
import { paceToToday, statusColor, statusClasses, formatPace } from '@/lib/wig/pace';
import { getNowCentral } from '@/lib/dateUtils';
import { useSomlData, notifySomlChanged, type SomlConfig, type PendingReferralRow, type SomlDetailItem } from '@/hooks/useSomlData';
import { NameAutocomplete } from '@/components/shared/NameAutocomplete';

type MetricKey = 'referrals' | 'upgrades' | 'sales' | 'referralLeads';

const METRIC_TO_GOAL_COL: Record<MetricKey, string> = {
  referrals: 'referrals_goal',
  upgrades: 'upgrades_goal',
  sales: 'sales_goal',
  referralLeads: 'referral_leads_goal',
};

interface HeroTileProps {
  label: string;
  icon: React.ReactNode;
  actual: number;
  goal: number;
  pace: number | null;
  isAdmin: boolean;
  onEdit: () => void;
  savedFlash: boolean;
  onDrilldown?: () => void;
}

function PaceBar({ current, target, pace, size = 'sm' }: { current: number; target: number | null; pace: number | null; size?: 'sm' | 'lg' }) {
  const status = statusColor(current, pace);
  const cls = statusClasses(status);
  const pct = target && target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return (
    <div className={cn('w-full rounded-full bg-secondary overflow-hidden', size === 'lg' ? 'h-3' : 'h-1.5')}>
      <div className={cn('h-full rounded-full transition-all', cls.bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function HeroTile({ label, icon, actual, goal, pace, isAdmin, onEdit, savedFlash, onDrilldown }: HeroTileProps) {
  const status = statusColor(actual, pace);
  const cls = statusClasses(status);
  return (
    <Card className={cn('border-2 ring-2 ring-offset-0', cls.ring)}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={cn(cls.text)}>{icon}</span>
            <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
              {label}
            </span>
          </div>
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={onEdit} aria-label={`Edit team goal for ${label}`}>
                  {savedFlash ? <Check className="w-3 h-3 text-success" /> : <Pencil className="w-3 h-3" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit the team-wide goal for {label} this window.</TooltipContent>
            </Tooltip>
          )}
        </div>
        <button
          type="button"
          onClick={onDrilldown}
          disabled={!onDrilldown || actual === 0}
          className={cn(
            'w-full text-left flex items-baseline gap-1.5 rounded-md -mx-1 px-1 py-0.5 transition',
            onDrilldown && actual > 0 && 'hover:bg-secondary/60 cursor-pointer',
          )}
          aria-label={onDrilldown ? `View ${label} details` : undefined}
        >
          <span className="text-4xl font-black tabular-nums leading-none text-foreground">{actual}</span>
          <span className="text-xs text-muted-foreground">of {goal || '—'}</span>
          {onDrilldown && actual > 0 && (
            <span className="ml-auto text-[10px] text-primary underline">View</span>
          )}
        </button>
        <div className="text-[11px] text-muted-foreground">
          Pace: <span className={cn('font-bold', cls.text)}>{formatPace(pace)}</span> today
        </div>
        <PaceBar current={actual} target={goal || null} pace={pace} size="lg" />
      </CardContent>
    </Card>
  );
}

interface EditGoalDialogProps {
  open: boolean; onClose: () => void; metric: MetricKey | null; config: SomlConfig | null; onSaved: () => void;
}
function EditGoalDialog({ open, onClose, metric, config, onSaved }: EditGoalDialogProps) {
  const { user } = useAuth();
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  useMemo(() => {
    if (open && metric && config) {
      const g = metric === 'referrals' ? config.referrals_goal : metric === 'upgrades' ? config.upgrades_goal : config.sales_goal;
      setVal(String(g ?? 0));
    }
  }, [open, metric, config]);
  const save = async () => {
    if (!metric) return;
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0) { toast.error('Enter a number ≥ 0'); return; }
    setSaving(true);
    const patch: any = { updated_by: user?.name || 'unknown' };
    patch[`${metric}_goal`] = n;
    const { error } = await (supabase as any).from('soml_config').update(patch).eq('id', 1);
    setSaving(false);
    if (error) { toast.error('Save failed'); return; }
    toast.success('Goal updated');
    onSaved();
    notifySomlChanged();
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Edit {metric} goal</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">Monthly EOM goal</Label>
          <Input type="number" min={0} value={val} onChange={e => setVal(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditWindowDialogProps {
  open: boolean; onClose: () => void; config: SomlConfig | null; onSaved: () => void;
}
function EditWindowDialog({ open, onClose, config, onSaved }: EditWindowDialogProps) {
  const { user } = useAuth();
  const [start, setStart] = useState(config?.start_date || '');
  const [end, setEnd] = useState(config?.end_date || '');
  useMemo(() => { if (open && config) { setStart(config.start_date); setEnd(config.end_date); } }, [open, config]);
  const save = async () => {
    if (!start || !end || end < start) { toast.error('End date must be on or after start'); return; }
    const { error } = await (supabase as any).from('soml_config').update({
      start_date: start, end_date: end, updated_by: user?.name || 'unknown',
    }).eq('id', 1);
    if (error) { toast.error('Save failed'); return; }
    toast.success('Window updated');
    onSaved();
    notifySomlChanged();
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Edit SOML window</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Start date</Label><Input type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div><Label className="text-xs">End date</Label><Input type="date" value={end} onChange={e => setEnd(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface LogDialogProps {
  open: boolean; onClose: () => void; kind: 'upgrade' | 'referral'; onSaved: () => void;
}
function LogDialog({ open, onClose, kind, onSaved }: LogDialogProps) {
  const { user } = useAuth();
  const [memberName, setMemberName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const reset = () => { setMemberName(''); setNotes(''); };
  const submit = async () => {
    if (!memberName.trim()) { toast.error('Member name is required'); return; }
    if (!user?.name) { toast.error('Login required'); return; }
    setSaving(true);
    const table = kind === 'upgrade' ? 'soml_upgrades' : 'soml_manual_referrals';
    const payload: any = kind === 'upgrade'
      ? { member_name: memberName.trim(), upgraded_by: user.name, notes: notes.trim() || null, created_by: user.name }
      : { member_name: memberName.trim(), referred_by: user.name, notes: notes.trim() || null, created_by: user.name };
    const { error } = await (supabase as any).from(table).insert(payload);
    setSaving(false);
    if (error) { toast.error(`Save failed: ${error.message}`); return; }
    toast.success(kind === 'upgrade' ? 'Upgrade logged' : 'Referral logged');
    reset();
    onSaved();
    notifySomlChanged();
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={o => !o && (reset(), onClose())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{kind === 'upgrade' ? 'Log an upgrade' : 'Log a referral (manual)'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Member name *</Label>
            <NameAutocomplete value={memberName} onChange={setMemberName} placeholder="Who upgraded/referred?" />
          </div>
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Credited to <span className="font-semibold text-foreground">{user?.name || '—'}</span>.
            {kind === 'referral' && ' Manual entries are additive — automatic Member Referral sales are already counted.'}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Log'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
interface SaOverrideDialogProps {
  open: boolean; onClose: () => void;
  sa: string; metric: MetricKey;
  current: number | null; defaultValue: number;
  onSaved: () => void;
}
function SaOverrideDialog({ open, onClose, sa, metric, current, defaultValue, onSaved }: SaOverrideDialogProps) {
  const { user } = useAuth();
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setVal(current == null ? '' : String(current));
  }, [open, current, sa, metric]);

  const save = async (clear: boolean) => {
    setSaving(true);
    const key = `${metric}_goal`;
    let payload: any = { sa_name: sa, updated_by: user?.name || 'unknown' };
    if (clear) {
      payload[key] = null;
    } else {
      const n = parseInt(val, 10);
      if (isNaN(n) || n < 0) { toast.error('Enter a number ≥ 0'); setSaving(false); return; }
      payload[key] = n;
    }
    // Upsert on sa_name
    const { error } = await (supabase as any)
      .from('soml_sa_goals')
      .upsert(payload, { onConflict: 'sa_name' });
    setSaving(false);
    if (error) { toast.error('Save failed: ' + error.message); return; }
    toast.success(clear ? 'Override cleared' : 'Override saved');
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Override {metric} goal — {sa}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">Custom monthly {metric} goal for {sa}</Label>
          <Input type="number" min={0} value={val} onChange={e => setVal(e.target.value)}
            placeholder={`Default: ${defaultValue.toFixed(1)}`} autoFocus />
          <p className="text-[11px] text-muted-foreground">
            Leaves other SAs on the divided default. Clear to fall back to default.
          </p>
        </div>
        <DialogFooter className="gap-2">
          {current != null && (
            <Button variant="ghost" onClick={() => save(true)} disabled={saving}>Clear</Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save(false)} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// Per-SA override row (nullable per metric — null = use divided default)
interface SaOverride { sa_name: string; referrals_goal: number | null; upgrades_goal: number | null; sales_goal: number | null }

export function SomlSection() {
  const { user } = useAuth();
  const isAdmin = useEffectiveAdmin();
  const { salesAssociates: activeSas } = useActiveStaff();
  const { config, totals, rows, pendingReferrals, realizedReferrals, upgradesList, salesList, refetch } = useSomlData();

  const [editMetric, setEditMetric] = useState<MetricKey | null>(null);
  const [editWindowOpen, setEditWindowOpen] = useState(false);
  const [logOpen, setLogOpen] = useState<'upgrade' | 'referral' | null>(null);
  const [savedFlash, setSavedFlash] = useState<MetricKey | null>(null);
  const [overrides, setOverrides] = useState<Record<string, SaOverride>>({});
  const [editCell, setEditCell] = useState<{ sa: string; metric: MetricKey } | null>(null);
  const [pendingDialogSa, setPendingDialogSa] = useState<string | null>(null); // null closed, '' = all, 'name' = one SA
  const [drilldown, setDrilldown] = useState<{ metric: MetricKey; sa: string } | null>(null); // sa '' = all

  const loadOverrides = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('soml_sa_goals')
      .select('sa_name, referrals_goal, upgrades_goal, sales_goal');
    const map: Record<string, SaOverride> = {};
    ((data as SaOverride[]) || []).forEach(r => { map[r.sa_name] = r; });
    setOverrides(map);
  }, []);
  useEffect(() => { loadOverrides(); }, [loadOverrides]);

  const activeCount = useMemo(
    () => (activeSas || []).filter(n => n !== 'Koa').length,
    [activeSas],
  );
  const rosterSas = useMemo(
    () => (activeSas || []).filter(n => n !== 'Koa'),
    [activeSas],
  );

  // Pace anchor: today, capped to SOML window
  const paceAnchor = useMemo(() => {
    const today = getNowCentral();
    if (!config) return today;
    const [sy, sm, sd] = config.start_date.split('-').map(Number);
    const [ey, em, ed] = config.end_date.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    if (today < start) return start;
    if (today > end) return end;
    return today;
  }, [config]);

  const goals = {
    referrals: config?.referrals_goal ?? 0,
    upgrades: config?.upgrades_goal ?? 0,
    sales: config?.sales_goal ?? 0,
  };
  const paces = {
    referrals: paceToToday(goals.referrals || null, paceAnchor),
    upgrades: paceToToday(goals.upgrades || null, paceAnchor),
    sales: paceToToday(goals.sales || null, paceAnchor),
  };
  // Per-metric override tallies — used to redistribute the remaining
  // team goal across non-overridden SAs so the team total stays locked
  // to the monthly goal regardless of individual overrides.
  const overrideStats = useMemo(() => {
    const stats: Record<MetricKey, { sum: number; count: number }> = {
      referrals: { sum: 0, count: 0 },
      upgrades: { sum: 0, count: 0 },
      sales: { sum: 0, count: 0 },
    };
    for (const sa of rosterSas) {
      const ov = overrides[sa];
      if (!ov) continue;
      (['referrals', 'upgrades', 'sales'] as MetricKey[]).forEach(m => {
        const v = ov[`${m}_goal` as const];
        if (v != null) { stats[m].sum += v; stats[m].count += 1; }
      });
    }
    return stats;
  }, [rosterSas, overrides]);

  const remainingPerSa = (metric: MetricKey): number => {
    const nonOverridden = activeCount - overrideStats[metric].count;
    if (nonOverridden <= 0) return 0;
    const remaining = Math.max(0, goals[metric] - overrideStats[metric].sum);
    return remaining / nonOverridden;
  };
  const defaultPerSa = {
    referrals: remainingPerSa('referrals'),
    upgrades: remainingPerSa('upgrades'),
    sales: remainingPerSa('sales'),
  };
  const flatPerSa = {
    referrals: activeCount > 0 ? goals.referrals / activeCount : 0,
    upgrades: activeCount > 0 ? goals.upgrades / activeCount : 0,
    sales: activeCount > 0 ? goals.sales / activeCount : 0,
  };
  const anyOverride = overrideStats.referrals.count + overrideStats.upgrades.count + overrideStats.sales.count > 0;
  // Effective target for a given SA + metric: override wins, else redistributed default
  const effectiveTarget = (sa: string, metric: MetricKey): number => {
    const ov = overrides[sa];
    const key = `${metric}_goal` as const;
    if (ov && ov[key] != null) return ov[key] as number;
    return defaultPerSa[metric];
  };

  const rowMap = useMemo(() => new Map(rows.map(r => [r.sa, r])), [rows]);
  const leaderboardRows = useMemo(() => rosterSas.map(sa => (
    rowMap.get(sa) || { sa, referrals: 0, upgrades: 0, sales: 0, pending: 0 }
  )), [rosterSas, rowMap]);

  const windowLabel = config
    ? `${format(new Date(config.start_date + 'T12:00:00'), 'MMM d')} – ${format(new Date(config.end_date + 'T12:00:00'), 'MMM d, yyyy')}`
    : '—';

  const openEditMetric = (m: MetricKey) => setEditMetric(m);
  const handleSaved = () => {
    if (editMetric) {
      setSavedFlash(editMetric);
      setTimeout(() => setSavedFlash(null), 2000);
    }
    refetch();
  };

  const metricInfo: Record<MetricKey, { blurb: string; header: string }> = {
    referrals: {
      header: 'Referrals',
      blurb: 'Credit to the SA who booked the person you talked to when THAT person refers someone new who buys a membership.',
    },
    upgrades: {
      header: 'Upgrades',
      blurb: 'Credit to the SA who talked a current member into upgrading their membership tier.',
    },
    sales: {
      header: 'Sales',
      blurb: 'Credit to the SA who ran the intro that closed — even if the buyer originally came in as a referral.',
    },
  };

  return (
    <TooltipProvider delayDuration={200}>
    <section className="mt-8 space-y-4 rounded-2xl border-2 border-primary/30 bg-card/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-black uppercase tracking-wide text-foreground">
            Summer of More Life
          </h2>
          <span className="text-xs text-muted-foreground">· {windowLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditWindowOpen(true)}>
                  <Calendar className="w-3.5 h-3.5 mr-1" /> Window
                </Button>
              </TooltipTrigger>
              <TooltipContent>Change the start and end date of this WIG window (admin).</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="secondary" className="h-8" onClick={() => setLogOpen('upgrade')}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Log Upgrade
              </Button>
            </TooltipTrigger>
            <TooltipContent>Log an upgrade for an SA (a current member you talked into a higher tier).</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="secondary" className="h-8" onClick={() => setLogOpen('referral')}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Log Referral
              </Button>
            </TooltipTrigger>
            <TooltipContent>Log a referral for an SA (someone your booked member referred who bought).</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Hero tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <HeroTile
          label="Referrals" icon={<Users className="w-4 h-4" />}
          actual={totals.referrals} goal={goals.referrals} pace={paces.referrals}
          isAdmin={isAdmin} onEdit={() => openEditMetric('referrals')}
          savedFlash={savedFlash === 'referrals'}
          onDrilldown={() => setDrilldown({ metric: 'referrals', sa: '' })}
        />
        <HeroTile
          label="Upgrades" icon={<TrendingUp className="w-4 h-4" />}
          actual={totals.upgrades} goal={goals.upgrades} pace={paces.upgrades}
          isAdmin={isAdmin} onEdit={() => openEditMetric('upgrades')}
          savedFlash={savedFlash === 'upgrades'}
          onDrilldown={() => setDrilldown({ metric: 'upgrades', sa: '' })}
        />
        <HeroTile
          label="Sales" icon={<DollarSign className="w-4 h-4" />}
          actual={totals.sales} goal={goals.sales} pace={paces.sales}
          isAdmin={isAdmin} onEdit={() => openEditMetric('sales')}
          savedFlash={savedFlash === 'sales'}
          onDrilldown={() => setDrilldown({ metric: 'sales', sa: '' })}
        />
      </div>

      {/* Pending referrals indicator — visually distinct from the real Referrals count. */}
      {totals.pending > 0 && (
        <button
          type="button"
          onClick={() => setPendingDialogSa('')}
          className="w-full flex items-center justify-between gap-3 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-left hover:bg-primary/10 transition"
        >
          <div className="flex items-center gap-2 text-foreground/90">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm">
              <span className="font-bold">{totals.pending} pending referral{totals.pending === 1 ? '' : 's'}</span>
              <span className="text-muted-foreground"> · counts when they buy</span>
            </span>
          </div>
          <span className="text-[11px] text-primary underline">View</span>
        </button>
      )}

      {/* What each metric means */}
      <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">How credit works</div>
        {(['referrals', 'upgrades', 'sales'] as MetricKey[]).map(k => (
          <div key={k} className="text-[11px] leading-snug text-foreground/90">
            <span className="font-semibold text-primary">{metricInfo[k].header}:</span>{' '}
            <span className="text-muted-foreground">{metricInfo[k].blurb}</span>
          </div>
        ))}
      </div>

      {/* Per-SA default target row */}
      <div className="text-[11px] text-muted-foreground">
        Default per-SA target: {defaultPerSa.referrals.toFixed(1)} referrals · {defaultPerSa.upgrades.toFixed(1)} upgrades · {defaultPerSa.sales.toFixed(1)} sales
        {activeCount > 0 && <span className="ml-1">({activeCount} SAs)</span>}
        {anyOverride && (
          <span className="ml-1 italic text-primary">
            — auto-adjusted from {flatPerSa.referrals.toFixed(1)}/{flatPerSa.upgrades.toFixed(1)}/{flatPerSa.sales.toFixed(1)} to cover overrides so team totals still hit the goal.
          </span>
        )}
        {isAdmin && <span className="ml-1 italic">— tap a cell to override for one SA.</span>}
      </div>

      {/* SA Leaderboard */}
      <div className="rounded-lg border bg-background overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">SA</TableHead>
              {(['referrals', 'upgrades', 'sales'] as MetricKey[]).map(k => (
                <TableHead key={k} className="text-center w-[30%]">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 cursor-help text-sm font-bold uppercase tracking-wide">
                        {metricInfo[k].header}
                        <Info className="w-3 h-3 text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[260px]">{metricInfo[k].blurb}</TooltipContent>
                  </Tooltip>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboardRows.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No active SAs</TableCell></TableRow>
            )}
            {leaderboardRows.map(r => (
              <TableRow key={r.sa}>
                <TableCell className="font-semibold text-sm truncate py-4">{r.sa}</TableCell>
                {(['referrals', 'upgrades', 'sales'] as MetricKey[]).map(k => {
                  const tgt = effectiveTarget(r.sa, k);
                  const pace = paceToToday(tgt || null, paceAnchor);
                  const isOverride = overrides[r.sa]?.[`${k}_goal`] != null;
                  return (
                    <TableCell key={k} className="text-center align-middle py-4">
                      <div className="flex items-baseline justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => r[k] > 0 && setDrilldown({ metric: k, sa: r.sa })}
                          disabled={r[k] === 0}
                          className={cn(
                            'text-3xl md:text-4xl font-black tabular-nums leading-none text-foreground rounded px-1',
                            r[k] > 0 && 'hover:bg-secondary/60 cursor-pointer',
                          )}
                          aria-label={r[k] > 0 ? `View ${r.sa}'s ${k}` : undefined}
                        >
                          {r[k]}
                        </button>
                        <span className="text-sm text-muted-foreground tabular-nums">/ {tgt.toFixed(1)}</span>
                        {isAdmin && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setEditCell({ sa: r.sa, metric: k })}
                                className={cn(
                                  'p-1 rounded hover:bg-secondary transition',
                                  isOverride && 'text-primary',
                                )}
                                aria-label={`Override ${k} goal for ${r.sa}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[240px]">
                              Override {r.sa}'s {k} goal. Overrides pull the default down for the other SAs so the team total still hits the goal.
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div className="mt-2 px-2"><PaceBar current={r[k]} target={tgt || null} pace={pace} /></div>
                      {k === 'referrals' && r.pending > 0 && (
                        <button
                          type="button"
                          onClick={() => setPendingDialogSa(r.sa)}
                          className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                          title="counts when they buy"
                        >
                          <Clock className="w-3 h-3" />
                          +{r.pending} pending
                        </button>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EditGoalDialog open={editMetric !== null} onClose={() => setEditMetric(null)} metric={editMetric} config={config} onSaved={handleSaved} />
      <EditWindowDialog open={editWindowOpen} onClose={() => setEditWindowOpen(false)} config={config} onSaved={refetch} />
      <LogDialog open={logOpen !== null} onClose={() => setLogOpen(null)} kind={logOpen || 'upgrade'} onSaved={refetch} />
      <SaOverrideDialog
        open={editCell !== null}
        onClose={() => setEditCell(null)}
        sa={editCell?.sa || ''}
        metric={editCell?.metric || 'referrals'}
        current={editCell ? (overrides[editCell.sa]?.[`${editCell.metric}_goal`] ?? null) : null}
        defaultValue={editCell ? defaultPerSa[editCell.metric] : 0}
        onSaved={() => { loadOverrides(); refetch(); }}
      />
      <PendingReferralsDialog
        open={pendingDialogSa !== null}
        onClose={() => setPendingDialogSa(null)}
        saFilter={pendingDialogSa || ''}
        rows={pendingReferrals}
      />
      <SomlDrilldownDialog
        open={drilldown !== null}
        onClose={() => setDrilldown(null)}
        metric={drilldown?.metric || 'referrals'}
        saFilter={drilldown?.sa || ''}
        referrals={realizedReferrals}
        upgrades={upgradesList}
        sales={salesList}
      />
    </section>
    </TooltipProvider>
  );
}

interface SomlDrilldownDialogProps {
  open: boolean;
  onClose: () => void;
  metric: MetricKey;
  saFilter: string; // '' = all
  referrals: SomlDetailItem[];
  upgrades: SomlDetailItem[];
  sales: SomlDetailItem[];
}
function SomlDrilldownDialog({ open, onClose, metric, saFilter, referrals, upgrades, sales }: SomlDrilldownDialogProps) {
  const source = metric === 'referrals' ? referrals : metric === 'upgrades' ? upgrades : sales;
  const filtered = useMemo(() => {
    const rows = saFilter ? source.filter(r => r.sa === saFilter) : source;
    return [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [source, saFilter]);
  const label = metric === 'referrals' ? 'Referrals' : metric === 'upgrades' ? 'Upgrades' : 'Sales';
  const dateLabel = metric === 'sales' ? 'Sold' : metric === 'upgrades' ? 'Upgraded' : 'Bought';

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {saFilter ? `${saFilter}'s ${label.toLowerCase()}` : `All ${label.toLowerCase()}`} · {filtered.length}
          </DialogTitle>
        </DialogHeader>
        <div className="text-[11px] text-muted-foreground mb-2">
          Summer of More Life window · credit shown per SA.
        </div>
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No {label.toLowerCase()} yet in this window.</p>
        ) : (
          <div className="divide-y">
            {filtered.map((r, i) => (
              <div key={`${r.member_name}-${r.date}-${i}`} className="py-2 flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground truncate">
                    {r.member_name || 'Unnamed member'}
                  </div>
                  <div className="text-muted-foreground">
                    Credit: <span className="text-foreground font-medium">{r.sa}</span>
                    {r.source === 'manual' && <span className="ml-1 italic">· logged manually</span>}
                    {r.source === 'legacy' && <span className="ml-1 italic">· legacy</span>}
                  </div>
                </div>
                <div className="text-right shrink-0 text-muted-foreground">
                  {r.date ? `${dateLabel} ${format(new Date(r.date + 'T12:00:00'), 'MMM d')}` : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PendingReferralsDialogProps {
  open: boolean;
  onClose: () => void;
  saFilter: string; // '' = all
  rows: PendingReferralRow[];
}
function PendingReferralsDialog({ open, onClose, saFilter, rows }: PendingReferralsDialogProps) {
  const filtered = useMemo(
    () => saFilter ? rows.filter(r => r.credited_sa === saFilter) : rows,
    [rows, saFilter],
  );
  const buckets = useMemo(() => ({
    pending: filtered.filter(r => r.state === 'pending'),
    realized: filtered.filter(r => r.state === 'realized'),
    not_converted: filtered.filter(r => r.state === 'not_converted'),
  }), [filtered]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const saveReferrer = async (row: PendingReferralRow) => {
    const next = draft.trim();
    if (!next || next === row.referring_member) { setEditingId(null); return; }
    setSaving(true);
    const { error } = await (supabase as any)
      .from('soml_pending_referrals')
      .update({ referring_member: next })
      .eq('id', row.id);
    // Also patch the booking's referring member field so it stays coherent
    if (!error && row.booking_id) {
      await supabase
        .from('intros_booked')
        .update({ referred_by_member_name: next } as any)
        .eq('id', row.booking_id);
    }
    setSaving(false);
    setEditingId(null);
    if (error) {
      toast.error('Could not update referrer');
    } else {
      toast.success('Referrer updated');
      notifySomlChanged();
    }
  };

  const dismissReferral = async (row: PendingReferralRow) => {
    if (!confirm(`Remove ${row.member_name || 'this referral'} from the pending list? This won't count as a referral.`)) return;
    const { error } = await (supabase as any)
      .from('soml_pending_referrals')
      .update({ state: 'not_converted', resolved_outcome: 'Dismissed' })
      .eq('id', row.id);
    if (error) {
      toast.error('Could not dismiss referral');
    } else {
      toast.success('Referral dismissed');
      notifySomlChanged();
    }
  };

  const renderList = (list: PendingReferralRow[], emptyMsg: string) => {
    if (list.length === 0) return <p className="text-xs text-muted-foreground py-2">{emptyMsg}</p>;
    return (
      <div className="divide-y">
        {list.map(r => (
          <div key={r.id} className="py-2 flex items-start justify-between gap-3 text-xs">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground truncate">
                {r.member_name || 'Unnamed intro'}
              </div>
              <div className="text-muted-foreground flex items-center gap-1 flex-wrap">
                <span>Referred by</span>
                {editingId === r.id ? (
                  <>
                    <Input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveReferrer(r);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="h-6 text-xs w-40 py-0"
                      disabled={saving}
                    />
                    <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => saveReferrer(r)} disabled={saving}>
                      <Check className="w-3 h-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="font-medium text-foreground">{r.referring_member || '—'}</span>
                    <button
                      type="button"
                      onClick={() => { setDraft(r.referring_member || ''); setEditingId(r.id); }}
                      className="text-muted-foreground hover:text-primary"
                      aria-label="Edit referrer"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </>
                )}
                <span>· Credit: {r.credited_sa}</span>
                {r.class_date && <span>· Class {format(new Date(r.class_date + 'T12:00:00'), 'MMM d')}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              {r.state === 'realized' && r.realized_at && (
                <span className="text-success">Bought {format(new Date(r.realized_at + 'T12:00:00'), 'MMM d')}</span>
              )}
              {r.state === 'not_converted' && (
                <span className="text-muted-foreground">{r.resolved_outcome || 'Did not convert'}</span>
              )}
              {r.state === 'pending' && (
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-primary">Pending</span>
                  <button
                    type="button"
                    onClick={() => dismissReferral(r)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove from pending"
                    title="Not interested — remove from pending"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {saFilter ? `${saFilter}'s pending referrals` : 'All pending referrals'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-primary mb-1">
              Pending ({buckets.pending.length}) · counts when they buy
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">
              Referrals who already bought show in the Referrals tile. Not-interested / no-show referrals drop off this list automatically.
            </p>
            {renderList(buckets.pending, 'No pending referrals.')}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
