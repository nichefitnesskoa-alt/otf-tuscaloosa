import { Card, CardContent } from '@/components/ui/card';
import {
  TrendingUp, Target, Users, Info,
} from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { CLOSE_RATE_THRESHOLDS } from '@/lib/studio-metrics';
import { cn } from '@/lib/utils';

interface StudioScoreboardProps {
  introsRun: number;
  introSales: number;
  closingRate: number;
  introsRunCorporate: number;
  closingRateCorporate: number;
}

function rateColor(rate: number) {
  return rate >= CLOSE_RATE_THRESHOLDS.green
    ? 'text-success'
    : rate >= CLOSE_RATE_THRESHOLDS.amber
      ? 'text-warning'
      : 'text-destructive';
}

interface RowProps {
  label: string;
  sublabel: string;
  introsRun: number;
  introSales: number;
  closingRate: number;
  runTooltip: string;
  rateTooltip: string;
}

function ScoreboardRow({ label, sublabel, introsRun, introSales, closingRate, runTooltip, rateTooltip }: RowProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 px-1">
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        <p className="text-[10px] uppercase tracking-wide opacity-60">{sublabel}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-center">
                <Users className="w-4 h-4 mx-auto mb-1 opacity-70" />
                <p className="text-2xl font-bold">{introsRun}</p>
                <p className="text-xs opacity-70">Intros Run</p>
              </div>
            </TooltipTrigger>
            <TooltipContent><p>{runTooltip}</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="text-center">
          <TrendingUp className="w-4 h-4 mx-auto mb-1 text-success" />
          <p className="text-2xl font-bold text-success">{introSales}</p>
          <p className="text-xs opacity-70">Sales</p>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-center">
                <Target className={cn('w-4 h-4 mx-auto mb-1', rateColor(closingRate))} />
                <p className={cn('text-2xl font-bold', rateColor(closingRate))}>{closingRate.toFixed(0)}%</p>
                <div className="flex items-center justify-center gap-0.5">
                  <p className="text-xs opacity-70">Close Rate</p>
                  <Info className="w-3 h-3 opacity-50" />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px]"><p>{rateTooltip}</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

export function StudioScoreboard({
  introsRun,
  introSales,
  closingRate,
  introsRunCorporate,
  closingRateCorporate,
}: StudioScoreboardProps) {
  return (
    <Card className="bg-surface-card border-surface-border text-text-primary">
      <CardContent className="p-4">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Studio Scoreboard
        </h2>

        <ScoreboardRow
          label="Internal · Total Journey"
          sublabel="1st intros only"
          introsRun={introsRun}
          introSales={introSales}
          closingRate={closingRate}
          runTooltip="1st-intro bookings that ran (excludes no-shows)."
          rateTooltip="Sales ÷ 1st intros that ran. A sale counts on its first intro's chain, even when the 2nd intro closed it."
        />

        <p className="text-[11px] text-muted-foreground text-center mt-2 mb-4 px-2">
          Total journey. A sale counts on the first intro's chain, even when the 2nd intro closed it.
        </p>

        <div className="border-t border-surface-border my-3" />

        <ScoreboardRow
          label="OTF Corporate · Last Coach"
          sublabel="1st + 2nd intros"
          introsRun={introsRunCorporate}
          introSales={introSales}
          closingRate={closingRateCorporate}
          runTooltip="Every ran class (1st and 2nd intros), excluding no-shows."
          rateTooltip="Sales ÷ every ran class. This is how OTF corporate measures studio close rate — the coach of the last attended class gets the close credit."
        />

        <p className="text-[11px] text-muted-foreground text-center mt-2 px-2">
          Every ran class counts. This is how OTF corporate tracks studio close rate.
        </p>

        <p className="text-[10px] opacity-40 text-center mt-3">Includes VIP-sourced intros &amp; sales</p>
      </CardContent>
    </Card>
  );
}
