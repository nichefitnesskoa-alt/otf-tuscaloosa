import { Card, CardContent } from '@/components/ui/card';
import { 
  TrendingUp, DollarSign, Target, Users, Heart, MessageSquareHeart
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
  goalWhyRate: number;
  relationshipRate: number;
  madeAFriendRate: number;
}

export function PersonalScoreboard({
  userName,
  introsRun,
  introSales,
  closingRate,
  totalCommission,
  goalWhyRate,
  relationshipRate,
  madeAFriendRate,
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
                  <p className="text-xs opacity-70">Closing %</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Your Sales ÷ Intros Run</p>
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
                    <p className="text-xs opacity-70">Relationship</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>High relationship experience executed (Yes/Partial)</p>
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
                  <p>Did you make a friend?</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
