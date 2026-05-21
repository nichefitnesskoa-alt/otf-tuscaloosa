import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useData } from '@/context/DataContext';
import { DateRange } from '@/lib/pay-period';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { computeFunnelBothRows } from './ConversionFunnel';

interface Props {
  dateRange: DateRange | null;
  /** Show a green "all in sync" card when there is no drift. Default: false. */
  showWhenInSync?: boolean;
}

interface Source {
  label: string;
  ran: number;
  sales: number;
}

/**
 * Cross-checks the three Studio surfaces (Scoreboard, Per-SA Runner Stats,
 * Conversion Funnel) for the same date range. Surfaces a red banner if they
 * disagree on intros ran or sales — the same divergence pattern that caused
 * the Alexa Brodsky orphan undercount.
 */
export function MetricsConsistencyAlert({ dateRange, showWhenInSync = false }: Props) {
  const { introsBooked, introsRun, sales, shiftRecaps, followUpQueue, followupTouches } = useData();
  const metrics = useDashboardMetrics(
    introsBooked, introsRun, sales, dateRange, shiftRecaps, undefined, followUpQueue, followupTouches,
  );

  const sources = useMemo<Source[]>(() => {
    // Scoreboard
    const scoreboard: Source = {
      label: 'Studio Scoreboard',
      ran: metrics.studio.introsRun,
      sales: metrics.studio.introSales,
    };

    // Per-SA Runner Stats (sum of attributed rows)
    const perSARan = metrics.perSA.reduce((s, m) => s + (m.introsBooked || 0), 0);
    const perSASales = metrics.perSA.reduce((s, m) => s + (m.sales || 0), 0);
    const perSA: Source = { label: 'Per-SA Runner Stats', ran: perSARan, sales: perSASales };

    // Conversion Funnel (1st + 2nd intros)
    const funnel = computeFunnelBothRows(introsBooked, introsRun, dateRange);
    const funnelRan = funnel.first.showed + funnel.second.showed;
    const funnelSales = funnel.first.sold + funnel.second.sold;
    const conversionFunnel: Source = { label: 'Conversion Funnel', ran: funnelRan, sales: funnelSales };

    return [scoreboard, perSA, conversionFunnel];
  }, [metrics, introsBooked, introsRun, dateRange]);

  const ranValues = sources.map(s => s.ran);
  const salesValues = sources.map(s => s.sales);
  const ranDrift = Math.max(...ranValues) - Math.min(...ranValues);
  const salesDrift = Math.max(...salesValues) - Math.min(...salesValues);
  const inSync = ranDrift === 0 && salesDrift === 0;

  if (inSync && !showWhenInSync) return null;

  if (inSync) {
    return (
      <Card className="border-success/40 bg-success-dim">
        <CardContent className="flex items-center gap-2 p-3">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <p className="text-xs text-text-primary">
            Scoreboard, Per-SA, and Conversion Funnel all agree on intros ran and sales.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-danger bg-danger-dim">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-danger" />
          <p className="text-sm font-semibold text-danger">
            Metrics disagree for the selected date range
          </p>
        </div>
        <p className="text-xs text-text-secondary">
          Studio Scoreboard, Per-SA stats, and the Conversion Funnel should all show
          the same intros ran and sales totals. Drift means a booking is being
          counted, attributed, or excluded inconsistently — likely an orphaned
          chain or a missing intro_owner.
        </p>
        <div className="overflow-hidden rounded border border-danger/30">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-danger-dim text-text-primary">
                <th className="px-2 py-1 text-left font-medium">Source</th>
                <th className="px-2 py-1 text-right font-medium">Intros Ran</th>
                <th className="px-2 py-1 text-right font-medium">Sales</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(s => (
                <tr key={s.label} className="border-t border-danger/20 text-text-primary">
                  <td className="px-2 py-1">{s.label}</td>
                  <td className={`px-2 py-1 text-right tabular-nums ${s.ran !== ranValues[0] || ranDrift > 0 ? '' : ''}`}>{s.ran}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{s.sales}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-text-secondary">
          Drift — Ran: {ranDrift} · Sales: {salesDrift}
        </p>
      </CardContent>
    </Card>
  );
}
