import { Card, CardContent } from '@/components/ui/card';
import { 
  TrendingUp, DollarSign, Target, Users, ClipboardList, CalendarCheck, CheckCircle2, Info
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PersonalScoreboardProps {
  userName: string;
  introsRun: number;
  introSales: number;
  closingRate: number;
  totalCommission: number;
  qCompletionRate?: number;
  confirmationRate?: number;
  followUpCompletionRate?: number;
}

export function PersonalScoreboard({
  userName,
  introsRun,
  introSales,
  closingRate,
  totalCommission,
  qCompletionRate = 0,
  confirmationRate = 0,
  followUpCompletionRate = 0,
}: PersonalScoreboardProps) {
  return (
    <Card className="bg-foreground text-background">
      <CardContent className="p-4">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          {userName}'s Dashboard
        </h2>
        
        {/* Main Metrics Row */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center">
                  <Users className="w-4 h-4 mx-auto mb-1 opacity-70" />
                  <p className="text-2xl font-bold">{introsRun}</p>
                  <p className="text-xs opacity-70">Intros Run</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Total first intros you ran (not 2nd intros)</p>
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
                <p>Your intro-based membership sales</p>
              </TooltipContent>
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
                <p>Sales ÷ intros who showed up. Measures your selling effectiveness.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center">
                  <DollarSign className="w-4 h-4 mx-auto mb-1 text-success" />
                  <p className="text-2xl font-bold text-success">${totalCommission.toFixed(0)}</p>
                  <p className="text-xs opacity-70">Commission</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Your total commission earned</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Lead Measures Row */}
        <div className="border-t border-background/20 pt-3">
          <p className="text-xs opacity-60 mb-2 uppercase tracking-wider">Lead Measures</p>
          <div className="grid grid-cols-3 gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center p-2 bg-background/10 rounded-lg">
                    <ClipboardList className="w-4 h-4 mx-auto mb-1 opacity-70" />
                    <p className="text-xl font-bold">{qCompletionRate.toFixed(0)}%</p>
                    <p className="text-xs opacity-70">Q Completion</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Questionnaires completed for 1st intros (excludes 2nd intros & VIP)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center p-2 bg-background/10 rounded-lg">
                    <CalendarCheck className="w-4 h-4 mx-auto mb-1 opacity-70" />
                    <p className="text-xl font-bold">{confirmationRate.toFixed(0)}%</p>
                    <p className="text-xs opacity-70">Confirmations</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Confirmation scripts sent vs intros booked for tomorrow</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center p-2 bg-background/10 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 mx-auto mb-1 opacity-70" />
                    <p className="text-xl font-bold">{followUpCompletionRate.toFixed(0)}%</p>
                    <p className="text-xs opacity-70">Follow-Up</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Follow-ups sent on time vs total due</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <p className="text-[10px] opacity-40 text-center mt-3">Excludes VIP events</p>
      </CardContent>
    </Card>
  );
}
