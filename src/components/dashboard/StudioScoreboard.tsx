import { Card, CardContent } from '@/components/ui/card';
import { 
  Calendar, UserCheck, Percent, Target, TrendingUp 
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface StudioScoreboardProps {
  introsBooked: number;
  introsShowed: number;
  showRate: number;
  introSales: number;
  closingRate: number;
}

export function StudioScoreboard({
  introsBooked,
  introsShowed,
  showRate,
  introSales,
  closingRate,
}: StudioScoreboardProps) {
  return (
    <Card className="bg-foreground text-background">
      <CardContent className="p-4">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Studio Scoreboard
        </h2>
        
        <div className="grid grid-cols-5 gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center">
                  <Calendar className="w-4 h-4 mx-auto mb-1 opacity-70" />
                  <p className="text-2xl font-bold">{introsBooked}</p>
                  <p className="text-xs opacity-70">Booked</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>First intro bookings (excludes 2nd intros)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center">
                  <UserCheck className="w-4 h-4 mx-auto mb-1 opacity-70" />
                  <p className="text-2xl font-bold">{introsShowed}</p>
                  <p className="text-xs opacity-70">Showed</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Booked intros that actually attended, regardless of who ran them</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center">
                  <Percent className="w-4 h-4 mx-auto mb-1 opacity-70" />
                  <p className="text-2xl font-bold">{showRate.toFixed(0)}%</p>
                  <p className="text-xs opacity-70">Show Rate</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Showed ÷ Booked (booking performance)</p>
              </TooltipContent>
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
              <TooltipContent>
                <p>Intro-based membership sales</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center">
                  <Target className="w-4 h-4 mx-auto mb-1 text-success" />
                  <p className="text-2xl font-bold text-success">{closingRate.toFixed(0)}%</p>
                  <p className="text-xs opacity-70">Closing %</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sales ÷ Showed (conversion performance)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
