/**
 * Admin → Mindbody Imports report.
 * Lists every person checked off as "imported to Mindbody" in a date range,
 * grouped by SA. Pulls from leads.mindbody_imported_at AND
 * vip_registrations.mindbody_imported_at so both check-off paths stay coherent.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon, ClipboardCopy, Download, Loader2, Users, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getNowCentral, localDateToStartISO, localDateToEndISO, parseLocalDate } from '@/lib/dateUtils';
import { formatPhoneDisplay } from '@/lib/parsing/phone';
import {
  fetchMindbodyImports,
  groupBySa,
  toCsv,
  type MindbodyImportRow,
} from '@/lib/admin/mindbodyImports';

type Preset = 'yesterday' | 'today' | 'this_week' | 'last_7' | 'custom';

function ymd(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function presetRange(preset: Preset, custom: { start: string; end: string }): { startYmd: string; endYmd: string } {
  const now = getNowCentral();
  if (preset === 'today') return { startYmd: ymd(now), endYmd: ymd(now) };
  if (preset === 'yesterday') {
    const y = new Date(now); y.setDate(now.getDate() - 1);
    return { startYmd: ymd(y), endYmd: ymd(y) };
  }
  if (preset === 'this_week') {
    // Monday in CT
    const day = now.getDay(); // 0 Sun .. 6 Sat
    const diff = day === 0 ? 6 : day - 1;
    const mon = new Date(now); mon.setDate(now.getDate() - diff);
    return { startYmd: ymd(mon), endYmd: ymd(now) };
  }
  if (preset === 'last_7') {
    const s = new Date(now); s.setDate(now.getDate() - 6);
    return { startYmd: ymd(s), endYmd: ymd(now) };
  }
  return { startYmd: custom.start, endYmd: custom.end };
}

export function MindbodyImportsPanel() {
  const qc = useQueryClient();
  const [preset, setPreset] = useState<Preset>('yesterday');
  const today = ymd(getNowCentral());
  const [custom, setCustom] = useState<{ start: string; end: string }>({ start: today, end: today });
  const [saFilter, setSaFilter] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { startYmd, endYmd } = useMemo(() => presetRange(preset, custom), [preset, custom]);
  const startISO = useMemo(() => localDateToStartISO(startYmd), [startYmd]);
  const endISO = useMemo(() => {
    // Inclusive end: bump to start of next day
    const d = parseLocalDate(endYmd)!;
    d.setDate(d.getDate() + 1);
    return localDateToStartISO(ymd(d));
  }, [endYmd]);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['mindbody-imports', startISO, endISO],
    queryFn: () => fetchMindbodyImports(startISO, endISO),
  });

  // Realtime: invalidate on any insert/update touching the flag.
  useEffect(() => {
    const channel = supabase
      .channel('mindbody-imports-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        qc.invalidateQueries({ queryKey: ['mindbody-imports'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vip_registrations' }, () => {
        qc.invalidateQueries({ queryKey: ['mindbody-imports'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const sasInRange = useMemo(
    () => Array.from(new Set(rows.map(r => r.importedBy))).sort(),
    [rows],
  );

  const visibleRows = useMemo(
    () => saFilter ? rows.filter(r => r.importedBy === saFilter) : rows,
    [rows, saFilter],
  );

  const grouped = useMemo(() => groupBySa(visibleRows), [visibleRows]);

  const rangeLabel = startYmd === endYmd
    ? format(parseLocalDate(startYmd)!, 'MMM d, yyyy')
    : `${format(parseLocalDate(startYmd)!, 'MMM d')} – ${format(parseLocalDate(endYmd)!, 'MMM d, yyyy')}`;

  const handleCopy = async () => {
    const lines = visibleRows.map(r => {
      const contact = [r.phone ? formatPhoneDisplay(r.phone) || r.phone : null, r.email].filter(Boolean).join(' · ');
      return `${r.name}${contact ? ` · ${contact}` : ''} — ${r.importedBy} (${r.sourceLabel})`;
    });
    const text = `Imported to Mindbody — ${rangeLabel} (${visibleRows.length} total)\n\n${lines.join('\n')}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success('Copied to clipboard');
  };

  const handleDownload = () => {
    const csv = toCsv(visibleRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindbody-imports-${startYmd}_to_${endYmd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Mindbody Imports
          <Badge variant="secondary" className="ml-2">{visibleRows.length} people</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Everyone an SA checked off as imported to Mindbody. Pulls from both sourced leads and VIP rosters.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preset row */}
        <div className="flex flex-wrap items-center gap-2">
          {([
            ['yesterday', 'Yesterday'],
            ['today', 'Today'],
            ['this_week', 'This week'],
            ['last_7', 'Last 7 days'],
            ['custom', 'Custom'],
          ] as [Preset, string][]).map(([k, label]) => (
            <Button
              key={k}
              size="sm"
              variant={preset === k ? 'default' : 'outline'}
              className={cn('h-9', preset === k && 'bg-brand hover:bg-brand text-white')}
              onClick={() => setPreset(k)}
            >
              {label}
            </Button>
          ))}
          {preset === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <DateBtn value={custom.start} onChange={d => setCustom(c => ({ ...c, start: d, end: c.end < d ? d : c.end }))} />
              <span className="text-sm text-muted-foreground">→</span>
              <DateBtn value={custom.end} onChange={d => setCustom(c => ({ ...c, end: d }))} min={custom.start} />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-9 gap-1" onClick={handleCopy} disabled={!visibleRows.length}>
              {copied ? <Check className="w-4 h-4 text-success" /> : <ClipboardCopy className="w-4 h-4" />}
              Copy list
            </Button>
            <Button size="sm" variant="outline" className="h-9 gap-1" onClick={handleDownload} disabled={!visibleRows.length}>
              <Download className="w-4 h-4" /> CSV
            </Button>
          </div>
        </div>

        {/* Active range */}
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{rangeLabel}</span>
        </div>

        {/* SA filter chips */}
        {sasInRange.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={saFilter === null ? 'default' : 'outline'}
              className={cn('h-8 text-xs', saFilter === null && 'bg-brand hover:bg-brand text-white')}
              onClick={() => setSaFilter(null)}
            >
              All ({rows.length})
            </Button>
            {sasInRange.map(sa => {
              const n = rows.filter(r => r.importedBy === sa).length;
              return (
                <Button
                  key={sa}
                  size="sm"
                  variant={saFilter === sa ? 'default' : 'outline'}
                  className={cn('h-8 text-xs', saFilter === sa && 'bg-brand hover:bg-brand text-white')}
                  onClick={() => setSaFilter(sa)}
                >
                  {sa} ({n})
                </Button>
              );
            })}
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="py-10 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground border rounded-md">
            No one was checked off as imported in this range.
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(g => (
              <SaGroupCard key={g.sa} sa={g.sa} rows={g.rows} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SaGroupCard({ sa, rows }: { sa: string; rows: MindbodyImportRow[] }) {
  const fmtTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true,
  });
  return (
    <div className="border rounded-md overflow-hidden">
      <div className="px-4 py-2 bg-muted flex items-center justify-between">
        <div className="font-semibold text-sm">{sa}</div>
        <Badge variant="secondary">{rows.length} imported</Badge>
      </div>
      <ul className="divide-y">
        {rows.map(r => (
          <li key={`${r.kind}-${r.id}`} className="px-4 py-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{r.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {[r.phone ? formatPhoneDisplay(r.phone) || r.phone : null, r.email].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <Badge variant="outline" className="text-[10px]">
                {r.kind === 'vip' ? `VIP${r.vipGroup ? ` · ${r.vipGroup}` : ''}` : 'Lead'}
              </Badge>
              <span className="text-xs text-muted-foreground w-20 text-right">
                {fmtTime.format(new Date(r.importedAt))}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DateBtn({ value, onChange, min }: { value: string; onChange: (ymd: string) => void; min?: string }) {
  const d = parseLocalDate(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1 font-normal">
          <CalendarIcon className="w-4 h-4" />
          {d ? format(d, 'MMM d, yyyy') : 'Pick date'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={d || undefined}
          onSelect={(date) => date && onChange(format(date, 'yyyy-MM-dd'))}
          disabled={min ? { before: parseLocalDate(min)! } : undefined}
          initialFocus
          className={cn('p-3 pointer-events-auto')}
        />
      </PopoverContent>
    </Popover>
  );
}
