/**
 * WigConstraintTiles — WIG page tile row for the three constraint metrics.
 * Reads the same canonical helper as MyDay's ShiftScoreboard (constraint.ts)
 * so studio numbers on WIG match SA numbers on MyDay for the same range.
 *
 * Per-SA breakdown uses the display roster canon (rosterInRange) —
 * inactive staff with data in-range still show, tagged. Pickers are not
 * affected; this is display-only.
 */
import { useMemo } from 'react';
import { useConstraintMetrics } from '@/lib/metrics/constraint';
import { useRosterWithDataInRange } from '@/lib/staff/rosterInRange';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { Clock, Calendar, UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DateRange } from '@/lib/pay-period';

function fmtPct(v: number | null): string { return v == null ? '—' : `${Math.round(v)}%`; }
function fmtMin(v: number | null): string {
  if (v == null) return '—';
  if (v < 60) return `${Math.round(v)}m`;
  return `${(v / 60).toFixed(1)}h`;
}

function StudioRow({ range }: { range: DateRange }) {
  const { data } = useConstraintMetrics(range, null);
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-md border p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Clock className="w-3 h-3" />Speed to lead</div>
        <div className="text-2xl font-bold tabular-nums">{fmtMin(data?.speedMedianMin ?? null)}</div>
        <div className="text-[11px] text-muted-foreground">median · first contact</div>
      </div>
      <div className="rounded-md border p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Calendar className="w-3 h-3" />Booking rate</div>
        <div className="text-2xl font-bold tabular-nums">{fmtPct(data?.booking.pct ?? null)}</div>
        <div className="text-[11px] text-muted-foreground">{data?.booking.booked ?? 0} of {data?.booking.total ?? 0}</div>
      </div>
      <div className="rounded-md border p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><UserCheck className="w-3 h-3" />Show rate</div>
        <div className="text-2xl font-bold tabular-nums">{fmtPct(data?.show.pct ?? null)}</div>
        <div className="text-[11px] text-muted-foreground">{data?.show.shown ?? 0} of {data?.show.total ?? 0}</div>
      </div>
    </div>
  );
}

function SaRow({ name, isInactive, range }: { name: string; isInactive: boolean; range: DateRange }) {
  const { data } = useConstraintMetrics(range, name);
  const hasAny = data && ((data.booking.total || 0) > 0 || (data.show.total || 0) > 0 || data.speedMedianMin != null);
  if (!hasAny) return null;
  return (
    <tr className="border-t">
      <td className="py-1.5 pr-2 font-medium">
        {name}
        {isInactive && <Badge variant="outline" className="ml-2 text-[10px]">Inactive</Badge>}
      </td>
      <td className="py-1.5 pr-2 tabular-nums">{fmtMin(data?.speedMedianMin ?? null)}</td>
      <td className="py-1.5 pr-2 tabular-nums">{fmtPct(data?.booking.pct ?? null)}</td>
      <td className="py-1.5 pr-2 tabular-nums">{fmtPct(data?.show.pct ?? null)}</td>
    </tr>
  );
}

export function WigConstraintTiles({ dateRange }: { dateRange: DateRange | null }) {
  const range: DateRange | null = dateRange;
  const { salesAssociates } = useActiveStaff();
  const activeSet = useMemo(() => new Set(salesAssociates || []), [salesAssociates]);
  const roster = useRosterWithDataInRange(salesAssociates || [], salesAssociates || []);

  if (!range) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">The Constraint</CardTitle>
        <p className="text-xs text-muted-foreground">Top-of-funnel game: speed to lead, booking rate, show rate.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <StudioRow range={range} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-2 font-medium">SA</th>
                <th className="py-1.5 pr-2 font-medium">Speed</th>
                <th className="py-1.5 pr-2 font-medium">Booking %</th>
                <th className="py-1.5 pr-2 font-medium">Show %</th>
              </tr>
            </thead>
            <tbody>
              {roster.names.map(name => (
                <SaRow key={name} name={name} isInactive={roster.inactiveNames.has(name) || !activeSet.has(name)} range={range} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
