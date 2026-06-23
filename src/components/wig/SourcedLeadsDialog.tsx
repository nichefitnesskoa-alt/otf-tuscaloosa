/**
 * Self-sourced leads explorer dialog (WIG SA Leaderboard → "Sourced Leads" button).
 *
 * - Date range picker (presets + custom) drives the query.
 * - Status filter: Needs Mindbody import / Already in Mindbody / All.
 * - Total tile + grouped-by-SA / flat-list toggle.
 * - Per-lead "Imported to Mindbody" checkbox (writes leads.mindbody_imported_at).
 * - Download CSV of current filtered set.
 *
 * The row set is the UNION of `leads` rows with sourced_by_sa AND
 * `intros_booked` rows with booked_by — see useSourcedLeadsInRange.
 */
import { useMemo, useState } from 'react';
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
import { useSourcedLeadsInRange } from '@/hooks/useSourcedLeadsInRange';
import { useMarkLeadImported } from '@/hooks/useMarkLeadImported';
import { downloadSourcedLeadsCsv, type SourcedLeadCsvRow } from '@/lib/sa/sourcedLeadsCsv';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
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

/** A row is "in Mindbody" if it's booked (auto-imported via Mindbody booking) OR
 *  manually marked imported by an SA. */
function isInMindbody(r: SourcedLeadCsvRow): boolean {
  return !!r.booked_intro_id || !!r.mindbody_imported_at;
}

export function SourcedLeadsDialog({ open, onOpenChange }: Props) {
  const [preset, setPreset] = useState<DatePreset>('pay_period');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [view, setView] = useState<View>('grouped');
  const [status, setStatus] = useState<StatusFilter>('needs');
  const [expandedSa, setExpandedSa] = useState<Record<string, boolean>>({});

  const dateRange = useMemo<DateRange>(() => {
    const r = getDateRangeForPreset(preset, customRange);
    return r ?? getCurrentPayPeriod();
  }, [preset, customRange]);

  const startIso = preset === 'all_time' ? null : dateRange.start.toISOString();
  const endIso = preset === 'all_time' ? null : dateRange.end.toISOString();

  const { rows: allRows, loading, patchRow } = useSourcedLeadsInRange(startIso, endIso);
  const { setImported, isPending } = useMarkLeadImported({ patchRow });

  // Apply status filter
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
    const label = preset === 'all_time' ? 'all-time' : `${format(dateRange.start, 'yyyy-MM-dd')}_to_${format(dateRange.end, 'yyyy-MM-dd')}`;
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
  // Booked rows (real or synthetic-from-bookings) are implicitly in Mindbody —
  // checkbox shows checked + disabled, no write target.
  const isBooked = !!l.booked_intro_id;

  return (
    <div className="flex items-center gap-3 px-3 py-2 text-sm">
      <div className="flex-shrink-0">
        <label
          className={cn(
            'flex items-center justify-center min-w-[44px] min-h-[44px] -my-2 -ml-3 pl-3',
            isBooked ? 'cursor-not-allowed' : 'cursor-pointer',
          )}
          title={
            isBooked
              ? 'Already in Mindbody (booked)'
              : inMindbody
              ? 'Mark not yet imported'
              : 'Mark imported to Mindbody'
          }
        >
          <Checkbox
            checked={inMindbody}
            disabled={isBooked || isPending}
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
          {!isBooked && l.mindbody_imported_at && (
            <span className="ml-2 text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded">In Mindbody</span>
          )}
          {l.text_archived_at && (
            <span className="ml-2 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Archived</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {l.phone}{l.source ? ` · ${l.source}` : ''}{showSa && l.sourced_by_sa ? ` · ${l.sourced_by_sa}` : ''}
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
