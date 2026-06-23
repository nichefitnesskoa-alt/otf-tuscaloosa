/**
 * Self-sourced leads explorer dialog (WIG SA Leaderboard → "Sourced Leads").
 *
 * Reads from the SAME hook the WIG tile aggregates (`useSaLeads`) so the
 * dialog total always equals the WIG tile total for the same date range.
 * No separate counting logic.
 *
 * - Defaults to the WIG-selected date range (passed via prop), with the
 *   picker still available to switch.
 * - Status filter: Needs Mindbody import / Already in Mindbody / All.
 * - Total tile + grouped-by-SA / flat-list toggle.
 * - Per-row "Imported to Mindbody" checkbox writes to leads or
 *   vip_registrations depending on the row's source.
 * - Download CSV of current filtered set.
 */
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import {
  type DatePreset,
  type DateRange,
  getDateRangeForPreset,
  getCurrentPayPeriod,
} from '@/lib/pay-period';
import { useSaLeads, type SaLeadPersonRow, reassignSelfSourcedRow } from '@/hooks/useSaLeads';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { useMarkLeadImported } from '@/hooks/useMarkLeadImported';
import { downloadSourcedLeadsCsv, type SourcedLeadCsvRow } from '@/lib/sa/sourcedLeadsCsv';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { isAdmin } from '@/lib/auth/roles';
import { toast } from '@/hooks/use-toast';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Date range currently selected on the WIG page — the dialog opens to
   *  this exact range so its total matches the WIG tile by default. */
  initialRange?: DateRange;
}

type View = 'grouped' | 'flat';
type StatusFilter = 'needs' | 'in_mindbody' | 'all';

function fmtCentralDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(new Date(iso));
  } catch { return iso; }
}

function isInMindbody(r: SourcedLeadCsvRow): boolean {
  // VIP registrants register via the VIP form which writes them into
  // Mindbody automatically — always treat as already imported.
  return (
    !!r.booked_intro_id ||
    !!r.mindbody_imported_at ||
    r.source_type === 'vip_registrant'
  );
}

/** Map a SaLeadPersonRow + sa name → the row shape the dialog renders. */
function toDialogRow(p: SaLeadPersonRow, sa: string): SourcedLeadCsvRow {
  let source_type: SourcedLeadCsvRow['source_type'] = 'lead';
  if (p.id.startsWith('bk-')) source_type = 'booking';
  else if (p.id.startsWith('vip-')) source_type = 'vip_registrant';
  const [first, ...rest] = (p.name || '').split(' ');
  return {
    id: p.id,
    first_name: first || '',
    last_name: rest.join(' '),
    phone: p.phone || '',
    email: p.email ?? null,
    source: p.source,
    sourced_by_sa: sa,
    booked_intro_id: p.booked ? p.booking_id : null,
    text_archived_at: null,
    text_archived_reason: null,
    created_at: p.created_at,
    stage: p.booked ? 'booked' : null,
    mindbody_imported_at: p.mindbody_imported_at,
    mindbody_imported_by: p.mindbody_imported_by,
    source_type,
  };
}

/** Match a date preset against the incoming initialRange so the picker
 *  shows the right chip when the dialog opens. */
function detectPreset(r: DateRange | undefined): DatePreset {
  if (!r) return 'pay_period';
  const start = r.start;
  const end = r.end;
  // Calendar month?
  if (
    start.getDate() === 1 &&
    end.getMonth() === start.getMonth() &&
    end.getFullYear() === start.getFullYear()
  ) {
    return 'this_month';
  }
  return 'custom';
}

export function SourcedLeadsDialog({ open, onOpenChange, initialRange }: Props) {
  const [preset, setPreset] = useState<DatePreset>(() => detectPreset(initialRange));
  const [customRange, setCustomRange] = useState<DateRange | undefined>(initialRange);
  const [view, setView] = useState<View>('grouped');
  const [status, setStatus] = useState<StatusFilter>('needs');
  const [expandedSa, setExpandedSa] = useState<Record<string, boolean>>({});

  // When the dialog opens, sync to the latest WIG range. Don't override the
  // user's choices once the dialog is already open.
  useEffect(() => {
    if (!open || !initialRange) return;
    setPreset(detectPreset(initialRange));
    setCustomRange(initialRange);
  }, [open, initialRange]);

  const dateRange = useMemo<DateRange>(() => {
    const r = getDateRangeForPreset(preset, customRange);
    return r ?? customRange ?? getCurrentPayPeriod();
  }, [preset, customRange]);

  const rangeStart = preset === 'all_time'
    ? '2020-01-01'
    : format(dateRange.start, 'yyyy-MM-dd');
  const rangeEnd = preset === 'all_time'
    ? format(new Date(), 'yyyy-MM-dd')
    : format(dateRange.end, 'yyyy-MM-dd');

  const { rows: saRows, loading } = useSaLeads(rangeStart, rangeEnd);

  // Match the WIG SA Leaderboard scope: only active SAs, and exclude Koa
  // (Admin, not on the SA leaderboard). Same filter as WigSaLeaderboard,
  // so the dialog total equals the WIG tile total.
  const { salesAssociates: activeSas, allActive } = useActiveStaff();
  const activeSet = useMemo(
    () => new Set((activeSas || []).filter(n => n !== 'Koa')),
    [activeSas],
  );
  const { user } = useAuth();
  const admin = isAdmin(user);
  const reassignChoices = useMemo(
    () => (allActive || []).filter(n => n !== 'Koa'),
    [allActive],
  );

  const handleReassign = async (rowId: string, newSa: string) => {
    try {
      await reassignSelfSourcedRow(rowId, newSa);
      toast({ title: 'Reassigned', description: `Credited to ${newSa}.` });
    } catch (e: any) {
      toast({ title: 'Could not reassign', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  // Flatten useSaLeads → one row per person, tagged with their SA.
  // Apply local patches (optimistic Mindbody-import toggles) on top.
  const [localPatches, setLocalPatches] = useState<Map<string, Partial<SourcedLeadCsvRow>>>(new Map());
  // Clear patches whenever the source data refetches (refetch will already
  // contain any persisted writes).
  useEffect(() => { setLocalPatches(new Map()); }, [saRows]);

  const allRows = useMemo<SourcedLeadCsvRow[]>(() => {
    const out: SourcedLeadCsvRow[] = [];
    for (const r of saRows) {
      if (!activeSet.has(r.sa)) continue;
      for (const p of r.people) {
        const base = toDialogRow(p, r.sa);
        const patch = localPatches.get(base.id);
        out.push(patch ? { ...base, ...patch } : base);
      }
    }
    // Newest first.
    return out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [saRows, localPatches]);

  const patchRow = (id: string, patch: Partial<SourcedLeadCsvRow>) => {
    setLocalPatches(prev => {
      const next = new Map(prev);
      next.set(id, { ...(next.get(id) || {}), ...patch });
      return next;
    });
  };

  const { setImported, isPending } = useMarkLeadImported({ patchRow });

  const rows = useMemo(() => {
    if (status === 'all') return allRows;
    if (status === 'needs') return allRows.filter(r => !isInMindbody(r));
    return allRows.filter(isInMindbody);
  }, [allRows, status]);

  const counts = useMemo(() => ({
    needs: allRows.filter(r => !isInMindbody(r)).length,
    in_mindbody: allRows.filter(isInMindbody).length,
    all: allRows.length,
  }), [allRows]);

  const grouped = useMemo(() => {
    const map = new Map<string, SourcedLeadCsvRow[]>();
    for (const r of rows) {
      const sa = r.sourced_by_sa || 'Unknown';
      const arr = map.get(sa) || [];
      arr.push(r);
      map.set(sa, arr);
    }
    return Array.from(map.entries())
      .map(([sa, leads]) => ({ sa, leads }))
      .sort((a, b) => b.leads.length - a.leads.length);
  }, [rows]);

  const handleDownload = () => {
    const label = preset === 'all_time'
      ? 'all-time'
      : `${format(dateRange.start, 'yyyy-MM-dd')}_to_${format(dateRange.end, 'yyyy-MM-dd')}`;
    downloadSourcedLeadsCsv(rows, label);
  };

  const toggleSa = (sa: string) => setExpandedSa(prev => ({ ...prev, [sa]: !prev[sa] }));

  const statusOptions: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'needs', label: 'Needs import', count: counts.needs },
    { value: 'in_mindbody', label: 'In Mindbody', count: counts.in_mindbody },
    { value: 'all', label: 'All', count: counts.all },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Self-Sourced Leads</DialogTitle>
        </DialogHeader>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b">
          <DateRangeFilter
            preset={preset}
            customRange={customRange}
            onPresetChange={setPreset}
            onCustomRangeChange={(r) => { setCustomRange(r); setPreset('custom'); }}
            dateRange={dateRange}
          />
          <Button
            onClick={handleDownload}
            disabled={loading || rows.length === 0}
            className="min-h-[44px]"
          >
            <Download className="w-4 h-4 mr-2" />
            Download CSV
          </Button>
        </div>

        {/* Status filter row */}
        <div className="flex flex-wrap items-center gap-2 pt-3">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Status:</span>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {statusOptions.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={cn(
                  'px-3 min-h-[36px] text-sm cursor-pointer',
                  i > 0 && 'border-l border-border',
                  status === opt.value ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                )}
              >
                {opt.label} <span className="ml-1 tabular-nums opacity-80">({opt.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Total tile + view toggle */}
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold tabular-nums text-primary">
              {loading ? '…' : rows.length}
            </span>
            <span className="text-sm text-muted-foreground">
              {status === 'needs'
                ? `need${rows.length === 1 ? 's' : ''} Mindbody import`
                : status === 'in_mindbody'
                ? `already in Mindbody`
                : `self-sourced record${rows.length === 1 ? '' : 's'} in this range`}
            </span>
          </div>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setView('grouped')}
              className={cn(
                'px-3 min-h-[36px] text-sm cursor-pointer',
                view === 'grouped' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              )}
            >
              By SA
            </button>
            <button
              type="button"
              onClick={() => setView('flat')}
              className={cn(
                'px-3 min-h-[36px] text-sm cursor-pointer border-l border-border',
                view === 'flat' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              )}
            >
              All leads
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              {status === 'needs'
                ? 'Nothing to import — all caught up.'
                : 'No records match this filter.'}
            </p>
          ) : view === 'grouped' ? (
            <div className="space-y-1">
              {grouped.map(({ sa, leads }) => {
                const isOpen = !!expandedSa[sa];
                return (
                  <div key={sa} className="border border-border rounded-md">
                    <button
                      type="button"
                      onClick={() => toggleSa(sa)}
                      className="w-full min-h-[44px] flex items-center justify-between px-3 hover:bg-muted/40 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <span className="font-medium">{sa}</span>
                      </div>
                      <span className="text-base font-semibold tabular-nums">{leads.length}</span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-border divide-y divide-border">
                        {leads.map(l => (
                          <LeadRow
                            key={l.id}
                            l={l}
                            showSa={false}
                            onToggleImported={setImported}
                            isPending={isPending(l.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-border rounded-md divide-y divide-border">
              {rows.map(l => (
                <LeadRow
                  key={l.id}
                  l={l}
                  showSa
                  onToggleImported={setImported}
                  isPending={isPending(l.id)}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LeadRow({
  l,
  showSa,
  onToggleImported,
  isPending,
}: {
  l: SourcedLeadCsvRow;
  showSa: boolean;
  onToggleImported: (id: string, imported: boolean) => void;
  isPending: boolean;
}) {
  const inMindbody = isInMindbody(l);
  // Booked rows AND VIP registrants are implicitly in Mindbody —
  // checkbox shows checked + disabled, no write target.
  const isBooked = !!l.booked_intro_id;
  const isVip = l.source_type === 'vip_registrant';
  const lockedInMindbody = isBooked || isVip;

  return (
    <div className="flex items-center gap-3 px-3 py-2 text-sm">
      <div className="flex-shrink-0">
        <label
          className={cn(
            'flex items-center justify-center min-w-[44px] min-h-[44px] -my-2 -ml-3 pl-3',
            lockedInMindbody ? 'cursor-not-allowed' : 'cursor-pointer',
          )}
          title={
            isBooked
              ? 'Already in Mindbody (booked)'
              : isVip
              ? 'Already in Mindbody (VIP registrant)'
              : inMindbody
              ? 'Mark not yet imported'
              : 'Mark imported to Mindbody'
          }
        >
          <Checkbox
            checked={inMindbody}
            disabled={lockedInMindbody || isPending}
            onCheckedChange={(v) => onToggleImported(l.id, v === true)}
          />
        </label>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">
          {l.first_name} {l.last_name}
          {isBooked && (
            <span className="ml-2 text-xs bg-success/20 text-success px-1.5 py-0.5 rounded">Booked</span>
          )}
          {!isBooked && !isVip && l.mindbody_imported_at && (
            <span className="ml-2 text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded">In Mindbody</span>
          )}
          {isVip && (
            <span className="ml-2 text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded">VIP · In Mindbody</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {[l.phone, l.email].filter(Boolean).join(' · ')}
          {l.source ? ` · ${l.source}` : ''}
          {showSa && l.sourced_by_sa ? ` · ${l.sourced_by_sa}` : ''}
        </div>
        {!isBooked && l.mindbody_imported_at && (
          <div className="text-[11px] text-muted-foreground/80">
            Imported {fmtCentralDate(l.mindbody_imported_at)}
            {l.mindbody_imported_by ? ` by ${l.mindbody_imported_by}` : ''}
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {fmtCentralDate(l.created_at)}
      </div>
    </div>
  );
}
