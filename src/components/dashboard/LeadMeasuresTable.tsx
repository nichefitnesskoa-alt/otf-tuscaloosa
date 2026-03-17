import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, ClipboardCheck, BookOpen, PlayCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SALeadMeasure } from '@/hooks/useLeadMeasures';

interface Props {
  data: SALeadMeasure[];
  loading?: boolean;
  compact?: boolean;
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
        <TooltipProvider>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left py-2 pr-2 font-medium text-muted-foreground">SA</th>
                  <th className="text-center py-2 px-1 font-medium text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help">
                          <ClipboardCheck className="w-3 h-3 mx-auto" />
                          <span className="block text-[9px]">Q Done</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px] text-xs">
                        <p><strong>Questionnaires Completed</strong></p>
                        <p>Of the intros this SA ran, how many had a completed questionnaire beforehand. Shown as completed / ran.</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="text-center py-2 px-1 font-medium text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help">
                          <ClipboardCheck className="w-3 h-3 mx-auto" />
                          <span className="block text-[9px]">Q %</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px] text-xs">
                        <p><strong>Questionnaire Completion %</strong></p>
                        <p>Of the intros this SA ran, what % had a completed questionnaire beforehand.</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="text-center py-2 px-1 font-medium text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help">
                          <BookOpen className="w-3 h-3 mx-auto" />
                          <span className="block text-[9px]">Prep</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px] text-xs">
                        <p><strong>Prep Rate %</strong></p>
                        <p>% of intros that were prepped (reviewed questionnaire & notes) before the class.</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="text-center py-2 px-1 font-medium text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help">
                          <PlayCircle className="w-3 h-3 mx-auto" />
                          <span className="block text-[9px]">Ran</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px] text-xs">
                        <p><strong>Intros Ran</strong></p>
                        <p>Total number of intros run by this SA in the selected period.</p>
                      </TooltipContent>
                    </Tooltip>
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
                    <td className="text-center py-1.5 px-1 text-muted-foreground text-[11px]">
                      {sa.introsRan > 0 ? `${sa.qCompletedCount}/${sa.introsRan}` : '—'}
                    </td>
                    <td className={`text-center py-1.5 px-1 font-semibold ${pctColor(sa.qCompletionPct)}`}>
                      {sa.qCompletionPct !== null ? `${sa.qCompletionPct}%` : '—'}
                    </td>
                    <td className={`text-center py-1.5 px-1 font-semibold ${pctColor(sa.prepRatePct)}`}>
                      {sa.prepRatePct !== null ? `${sa.prepRatePct}%` : '—'}
                    </td>
                    <td className="text-center py-1.5 px-1 font-semibold">{sa.introsRan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TooltipProvider>
        <p className="text-[10px] text-muted-foreground mt-2">
          Q Done = questionnaires completed / intros ran · Q % = completion rate · Prep = intros prepped before class · Ran = total intros run
        </p>
      </CardContent>
    </Card>
  );
}
