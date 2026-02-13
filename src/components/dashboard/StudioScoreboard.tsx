import { Card, CardContent } from '@/components/ui/card';
import { 
  TrendingUp, DollarSign, Target, Users, Heart, MessageSquareHeart, ClipboardList, AlertTriangle
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface StudioScoreboardProps {
  introsRun: number;
  introSales: number;
  closingRate: number;
  goalWhyRate: number;
  relationshipRate: number;
  madeAFriendRate: number;
  qCompletionRate?: number;
}

export function StudioScoreboard({
  introsRun,
  introSales,
  closingRate,
  goalWhyRate,
  relationshipRate,
  madeAFriendRate,
  qCompletionRate,
}: StudioScoreboardProps) {
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
              <TooltipContent>
                <p>Total first intros run (not 2nd intros)</p>
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
                <p>Sales ÷ Intros Run</p>
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
                    <Target className="w-4 h-4 mx-auto mb-1 opacity-70" />
                    <p className="text-xl font-bold">{goalWhyRate.toFixed(0)}%</p>
                    <p className="text-xs opacity-70">Goal + Why</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Main fitness goal + why captured (Yes/Partial)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center p-2 bg-background/10 rounded-lg">
                    <Heart className="w-4 h-4 mx-auto mb-1 opacity-70" />
                    <p className="text-xl font-bold">{relationshipRate.toFixed(0)}%</p>
                    <p className="text-xs opacity-70">Peak Exp.</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Peak Gym Experience executed (Yes/Partial)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center p-2 bg-background/10 rounded-lg">
                    <MessageSquareHeart className="w-4 h-4 mx-auto mb-1 opacity-70" />
                    <p className="text-xl font-bold">{madeAFriendRate.toFixed(0)}%</p>
                    <p className="text-xs opacity-70">Made Friend</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Made a friend (great relationship & natural conversation)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        {/* 6B: Q Completion Rate */}
        {qCompletionRate !== undefined && (
          <div className="border-t border-background/20 pt-3 mt-3">
            <div className="flex items-center justify-between p-2 bg-background/10 rounded-lg">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 opacity-70" />
                <div>
                  <p className="text-sm font-bold">{qCompletionRate.toFixed(0)}%</p>
                  <p className="text-xs opacity-70">Q Completion</p>
                </div>
              </div>
              {qCompletionRate < 70 && (
                <div className="flex items-center gap-1 text-warning">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-medium">Below 70%</span>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-[10px] opacity-40 text-center mt-3">Excludes VIP events</p>
      </CardContent>
    </Card>
  );
}
