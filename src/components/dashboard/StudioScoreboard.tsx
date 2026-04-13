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
}

export function StudioScoreboard({
  introsRun,
  introSales,
  closingRate,
}: StudioScoreboardProps) {
  const showRate = (introsBooked && introsBooked > 0 && introsShowed !== undefined)
    ? (introsShowed / introsBooked) * 100
    : undefined;

  return (
    <Card className="bg-foreground text-background">
      <CardContent className="p-4">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Studio Scoreboard
        </h2>

        {/* Main Metrics Row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center">
                  <Users className="w-4 h-4 mx-auto mb-1 opacity-70" />
                  <p className="text-2xl font-bold">{introsRun}</p>
                  <p className="text-xs opacity-70">Intros Run</p>
                </div>
              </TooltipTrigger>
              <TooltipContent><p>Total intros where the member showed up (excludes no-shows)</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center">
                  <TrendingUp className="w-4 h-4 mx-auto mb-1 text-success" />
                  <p className="text-2xl font-bold text-success">{introSales}</p>
                  <p className="text-xs opacity-70">Sales</p>
                </div>
              </TooltipTrigger>
              <TooltipContent><p>Intro-based membership sales</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center">
                  <Target className={cn("w-4 h-4 mx-auto mb-1", closingRate >= CLOSE_RATE_THRESHOLDS.green ? 'text-success' : closingRate >= CLOSE_RATE_THRESHOLDS.amber ? 'text-warning' : 'text-destructive')} />
                  <p className={cn("text-2xl font-bold", closingRate >= CLOSE_RATE_THRESHOLDS.green ? 'text-success' : closingRate >= CLOSE_RATE_THRESHOLDS.amber ? 'text-warning' : 'text-destructive')}>{closingRate.toFixed(0)}%</p>
                  <div className="flex items-center justify-center gap-0.5">
                    <p className="text-xs opacity-70">Close Rate</p>
                    <Info className="w-3 h-3 opacity-50" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-[220px]">
                <p>Sales ÷ intros who showed up (excludes no-shows). Measures selling effectiveness.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        


        <p className="text-[10px] opacity-40 text-center mt-3">Excludes VIP events</p>
      </CardContent>
    </Card>
  );
}

