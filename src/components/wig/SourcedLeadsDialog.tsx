/**
 * Self-sourced leads explorer dialog (WIG SA Leaderboard → "Sourced Leads" button).
 *
 * - Date range picker (presets + custom) drives the query.
 * - Total tile.
 * - Toggle: grouped by SA / flat list.
 * - Download CSV of current filtered set.
 */
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import {
  type DatePreset,
  type DateRange,
  getDateRangeForPreset,
  getCurrentPayPeriod,
} from '@/lib/pay-period';
import { useSourcedLeadsInRange } from '@/hooks/useSourcedLeadsInRange';
import { downloadSourcedLeadsCsv, type SourcedLeadCsvRow } from '@/lib/sa/sourcedLeadsCsv';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type View = 'grouped' | 'flat';

function fmtCentralDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(new Date(iso));
  } catch { return iso; }
}

export function SourcedLeadsDialog({ open, onOpenChange }: Props) {
  const [preset, setPreset] = useState<DatePreset>('pay_period');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [view, setView] = useState<View>('grouped');
  const [expandedSa, setExpandedSa] = useState<Record<string, boolean>>({});

  const dateRange = useMemo<DateRange>(() => {
    const r = getDateRangeForPreset(preset, customRange);
    return r ?? getCurrentPayPeriod();
  }, [preset, customRange]);

  const startIso = preset === 'all_time' ? null : dateRange.start.toISOString();
  const endIso = preset === 'all_time' ? null : dateRange.end.toISOString();

  const { rows, loading } = useSourcedLeadsInRange(startIso, endIso);

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

        {/* Total tile + view toggle */}
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold tabular-nums text-primary">
              {loading ? '…' : rows.length}
            </span>
            <span className="text-sm text-muted-foreground">
              self-sourced lead{rows.length === 1 ? '' : 's'} in this range
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
              No self-sourced leads in this range.
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
                          <LeadRow key={l.id} l={l} showSa={false} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-border rounded-md divide-y divide-border">
              {rows.map(l => <LeadRow key={l.id} l={l} showSa />)}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LeadRow({ l, showSa }: { l: SourcedLeadCsvRow; showSa: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">
          {l.first_name} {l.last_name}
          {l.booked_intro_id && (
            <span className="ml-2 text-xs bg-success/20 text-success px-1.5 py-0.5 rounded">Booked</span>
          )}
          {l.text_archived_at && (
            <span className="ml-2 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Archived</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {l.phone}{l.source ? ` · ${l.source}` : ''}{showSa && l.sourced_by_sa ? ` · ${l.sourced_by_sa}` : ''}
        </div>
      </div>
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {fmtCentralDate(l.created_at)}
      </div>
    </div>
  );
}
