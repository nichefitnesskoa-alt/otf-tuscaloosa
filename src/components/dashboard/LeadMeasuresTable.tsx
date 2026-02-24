import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, ClipboardCheck, BookOpen, MessageCircle, Users, Timer } from 'lucide-react';
import { SALeadMeasure } from '@/hooks/useLeadMeasures';

interface Props {
  data: SALeadMeasure[];
  loading?: boolean;
  compact?: boolean;
}

function formatSpeed(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function speedColor(minutes: number | null): string {
  if (minutes === null) return 'text-muted-foreground';
  if (minutes <= 15) return 'text-success';
  if (minutes <= 60) return 'text-warning';
  return 'text-destructive';
}

function pctColor(pct: number | null): string {
  if (pct === null) return 'text-muted-foreground';
  if (pct >= 70) return 'text-success';
  if (pct >= 50) return 'text-warning';
  return 'text-destructive';
}

export function LeadMeasuresTable({ data, loading, compact }: Props) {
  if (loading) return <div className="text-xs text-muted-foreground py-4 text-center">Loading lead measures…</div>;
  if (data.length === 0) return <div className="text-xs text-muted-foreground py-4 text-center">No data for this period</div>;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Lead Measures by SA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left py-2 pr-2 font-medium text-muted-foreground">SA</th>
                <th className="text-center py-2 px-1 font-medium text-muted-foreground" title="Avg time to first contact">
                  <Timer className="w-3 h-3 mx-auto" />
                  <span className="block text-[9px]">Speed</span>
                </th>
                <th className="text-center py-2 px-1 font-medium text-muted-foreground" title="Questionnaire completion %">
                  <ClipboardCheck className="w-3 h-3 mx-auto" />
                  <span className="block text-[9px]">Q %</span>
                </th>
                <th className="text-center py-2 px-1 font-medium text-muted-foreground" title="Prep rate %">
                  <BookOpen className="w-3 h-3 mx-auto" />
                  <span className="block text-[9px]">Prep</span>
                </th>
                <th className="text-center py-2 px-1 font-medium text-muted-foreground" title="Follow-up touches">
                  <MessageCircle className="w-3 h-3 mx-auto" />
                  <span className="block text-[9px]">FU</span>
                </th>
                <th className="text-center py-2 px-1 font-medium text-muted-foreground" title="DMs sent">
                  <span className="block text-[9px]">DMs</span>
                </th>
                <th className="text-center py-2 px-1 font-medium text-muted-foreground" title="Leads reached out to">
                  <Users className="w-3 h-3 mx-auto" />
                  <span className="block text-[9px]">Leads</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((sa, i) => (
                <tr key={sa.saName} className="border-b border-border/30 last:border-0">
                  <td className="py-1.5 pr-2 font-medium truncate max-w-[80px]">
                    {i < 3 && <span className="mr-0.5">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>}
                    {sa.saName}
                  </td>
                  <td className={`text-center py-1.5 px-1 font-semibold ${speedColor(sa.speedToLead)}`}>
                    {formatSpeed(sa.speedToLead)}
                  </td>
                  <td className={`text-center py-1.5 px-1 font-semibold ${pctColor(sa.qCompletionPct)}`}>
                    {sa.qCompletionPct !== null ? `${sa.qCompletionPct}%` : '—'}
                  </td>
                  <td className={`text-center py-1.5 px-1 font-semibold ${pctColor(sa.prepRatePct)}`}>
                    {sa.prepRatePct !== null ? `${sa.prepRatePct}%` : '—'}
                  </td>
                  <td className="text-center py-1.5 px-1 font-semibold">{sa.followUpTouches}</td>
                  <td className="text-center py-1.5 px-1 font-semibold">{sa.dmsSent}</td>
                  <td className="text-center py-1.5 px-1 font-semibold">{sa.leadsReachedOut}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Speed = avg time to first contact · Q = questionnaire completion · Prep = intros prepped before class · FU = follow-up touches sent
        </p>
      </CardContent>
    </Card>
  );
}
