import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { getDateRangeForPreset, DatePreset, DateRange } from '@/lib/pay-period';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, AlertTriangle } from 'lucide-react';
import { format, isWithinInterval } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

interface RunRow {
  id: string;
  member_name: string;
  result: string;
  primary_objection: string | null;
  run_date: string | null;
  intro_owner: string | null;
  lead_source: string | null;
  sa_name: string | null;
}

export default function ObjectionReport() {
  const [datePreset, setDatePreset] = useState<DatePreset>('pay_period');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [objectionFilter, setObjectionFilter] = useState('all');

  const dateRange = useMemo(() => getDateRangeForPreset(datePreset, customRange), [datePreset, customRange]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('intros_run')
        .select('id, member_name, result, primary_objection, run_date, intro_owner, lead_source, sa_name')
        .eq('is_vip', false)
        .not('result', 'eq', 'No-show')
        .order('run_date', { ascending: false });
      setRuns((data as RunRow[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const filteredRuns = useMemo(() => {
    return runs.filter(r => {
      // Must have an objection
      if (!r.primary_objection) return false;
      // Must not be a sale (sales don't have meaningful objections)
      const result = (r.result || '').toLowerCase();
      if (result.includes('premier') || result.includes('elite') || result.includes('basic')) return false;
      // Date range filter
      if (dateRange && r.run_date) {
        try {
          if (!isWithinInterval(parseLocalDate(r.run_date), { start: dateRange.start, end: dateRange.end })) return false;
        } catch { return false; }
      }
      // Objection type filter
      if (objectionFilter !== 'all' && r.primary_objection !== objectionFilter) return false;
      return true;
    });
  }, [runs, dateRange, objectionFilter]);

  // Objection frequency counts
  const objectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    filteredRuns.forEach(r => {
      const obj = r.primary_objection!;
      counts.set(obj, (counts.get(obj) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredRuns]);

  const maxCount = objectionCounts.length > 0 ? objectionCounts[0][1] : 1;

  // All unique objections for filter dropdown
  const allObjections = useMemo(() => {
    const set = new Set<string>();
    runs.forEach(r => { if (r.primary_objection) set.add(r.primary_objection); });
    return [...set].sort();
  }, [runs]);

  return (
    <div className="space-y-4">
      <DateRangeFilter
        preset={datePreset}
        customRange={customRange}
        onPresetChange={setDatePreset}
        onCustomRangeChange={setCustomRange}
        dateRange={dateRange || { start: new Date(), end: new Date() }}
      />

      {/* Summary Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Objection Frequency
            <Badge variant="outline" className="ml-auto">{filteredRuns.length} total</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
          ) : objectionCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No objection data for this period.</p>
          ) : (
            <div className="space-y-2">
              {objectionCounts.map(([name, count]) => (
                <div key={name} className="flex items-center gap-2 text-xs">
                  <span className="w-32 shrink-0 font-medium truncate">{name}</span>
                  <div className="flex-1 bg-muted rounded-full h-2.5">
                    <div
                      className="bg-warning h-2.5 rounded-full transition-all"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-semibold">{count}</span>
                  <span className="w-10 text-right text-muted-foreground">
                    {((count / filteredRuns.length) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Objection Detail
            </CardTitle>
            <Select value={objectionFilter} onValueChange={setObjectionFilter}>
              <SelectTrigger className="w-40 h-7 text-xs">
                <SelectValue placeholder="All objections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Objections</SelectItem>
                {allObjections.map(o => (
                  <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
          ) : filteredRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No results.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Objection</TableHead>
                  <TableHead className="text-xs">Result</TableHead>
                  <TableHead className="text-xs">SA</TableHead>
                  <TableHead className="text-xs">Lead Source</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRuns.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-medium">{r.member_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{r.primary_objection}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.result}</TableCell>
                    <TableCell className="text-xs">{r.intro_owner || r.sa_name || '—'}</TableCell>
                    <TableCell className="text-xs">{r.lead_source || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.run_date ? format(parseLocalDate(r.run_date), 'MMM d') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
