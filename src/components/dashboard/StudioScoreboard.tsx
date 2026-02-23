import { Card, CardContent } from '@/components/ui/card';
import {
  TrendingUp, Target, Users, AlertTriangle, Info, CalendarCheck, ClipboardList, Dumbbell,
} from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  getLeadMeasureColor,
  Q_COMPLETION_THRESHOLDS, PREP_RATE_THRESHOLDS,
} from '@/lib/studio-metrics';
import { cn } from '@/lib/utils';

interface StudioScoreboardProps {
  introsRun: number;
  introSales: number;
  closingRate: number;
  qCompletionRate?: number;
  prepRate?: number;
  introsBooked?: number;
  introsShowed?: number;
}

export function StudioScoreboard({
  introsRun,
  introSales,
  closingRate,
  qCompletionRate,
  prepRate,
  introsBooked,
  introsShowed,
}: StudioScoreboardProps) {
  const showRate = (introsBooked && introsBooked > 0 && introsShowed !== undefined)
    ? (introsShowed / introsBooked) * 100
    : undefined;
  const noShows = (introsBooked !== undefined && introsShowed !== undefined)
    ? introsBooked - introsShowed
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
              <TooltipContent><p>Total first intros run (people who showed up, not 2nd intros)</p></TooltipContent>
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
                  <Target className="w-4 h-4 mx-auto mb-1 text-success" />
                  <p className="text-2xl font-bold text-success">{closingRate.toFixed(0)}%</p>
                  <div className="flex items-center justify-center gap-0.5">
                    <p className="text-xs opacity-70">Close Rate</p>
                    <Info className="w-3 h-3 opacity-50" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-[220px]">
                <p>Sales ÷ intros who showed up. Measures selling effectiveness.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Show Rate Row */}
        {showRate !== undefined && (
          <div className="border-t border-background/20 pt-3 mb-3">
            <div className="grid grid-cols-3 gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center p-2 bg-background/10 rounded-lg">
                      <CalendarCheck className="w-4 h-4 mx-auto mb-1 opacity-70" />
                      <p className="text-xl font-bold">{introsBooked}</p>
                      <p className="text-xs opacity-70">Booked</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent><p>Total 1st intro bookings (excludes VIP, 2nd intros)</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center p-2 bg-background/10 rounded-lg">
                      <Users className="w-4 h-4 mx-auto mb-1 opacity-70" />
                      <p className="text-xl font-bold">
                        <span className={showRate >= 75 ? 'text-success' : showRate >= 50 ? 'text-warning' : 'text-destructive'}>
                          {showRate.toFixed(0)}%
                        </span>
                      </p>
                      <div className="flex items-center justify-center gap-0.5">
                        <p className="text-xs opacity-70">Show Rate</p>
                        <Info className="w-3 h-3 opacity-50" />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px]">
                    <p>Showed ÷ Booked (past + today only). Future bookings excluded from denominator.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center p-2 bg-background/10 rounded-lg">
                      <AlertTriangle className="w-4 h-4 mx-auto mb-1 opacity-70" />
                      <p className="text-xl font-bold text-destructive">{noShows}</p>
                      <p className="text-xs opacity-70">No-Shows</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent><p>Booked intros (past + today) who never showed up. Future bookings excluded.</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <p className="text-[10px] opacity-50 text-center mt-2">
              {introsBooked} Booked → {introsShowed} Showed ({showRate.toFixed(0)}%) → {introSales} Sold ({closingRate.toFixed(0)}%)
            </p>
          </div>
        )}

        {/* Lead Measures Row — Q Completion + Prep Rate */}
        <div className="border-t border-background/20 pt-3">
          <p className="text-xs opacity-60 mb-2 uppercase tracking-wider">Lead Measures</p>
          <div className="grid grid-cols-2 gap-3">
            <LeadMeasureCard
              icon={<ClipboardList className="w-4 h-4" />}
              label="Q Completion"
              value={qCompletionRate}
              tooltip="% of 1st intro bookings with a completed questionnaire. Prepped intros close higher. Target: 70%+"
              thresholds={Q_COMPLETION_THRESHOLDS}
            />
            <LeadMeasureCard
              icon={<Dumbbell className="w-4 h-4" />}
              label="Prepped & Role Played %"
              value={prepRate}
              tooltip="% of intros run where the SA marked 'Prepped & Role Played' — meaning they reviewed the prep card AND role played digging deeper on the member's why and handling their likely objection before they walked in. Target: 70%+"
              thresholds={PREP_RATE_THRESHOLDS}
            />
          </div>
        </div>

        <p className="text-[10px] opacity-40 text-center mt-3">Excludes VIP events</p>
      </CardContent>
    </Card>
  );
}

function LeadMeasureCard({
  icon, label, value, tooltip, thresholds,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  tooltip: string;
  thresholds: { green: number; amber: number };
}) {
  const color = value !== undefined ? getLeadMeasureColor(value, thresholds) : undefined;
  const colorClass = color === 'success' ? 'text-success' : color === 'warning' ? 'text-warning' : color === 'destructive' ? 'text-destructive' : '';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="text-center p-2 bg-background/10 rounded-lg">
            <div className="mx-auto mb-1 opacity-70 flex justify-center">{icon}</div>
            <p className={cn('text-xl font-bold', colorClass)}>
              {value !== undefined ? `${value.toFixed(0)}%` : '—'}
            </p>
            <p className="text-xs opacity-70">{label}</p>
            {value !== undefined && value < thresholds.amber && (
              <div className="flex items-center justify-center gap-0.5 mt-0.5">
                <AlertTriangle className="w-3 h-3 text-destructive" />
                <span className="text-[10px] text-destructive font-medium">Below {thresholds.amber}%</span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px]"><p>{tooltip}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
