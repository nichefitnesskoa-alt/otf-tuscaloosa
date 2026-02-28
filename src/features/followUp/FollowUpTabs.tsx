/**
 * Four-tab follow-up system that lives inside the MyDay F/U tab.
 * Tabs: No-Show · Follow-Up Needed · 2nd Intro · Plans to Reschedule
 */
import { useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFollowUpData } from './useFollowUpData';
import NoShowTab from './NoShowTab';
import FollowUpNeededTab from './FollowUpNeededTab';
import SecondIntroTab from './SecondIntroTab';
import PlansToRescheduleTab from './PlansToRescheduleTab';

interface FollowUpTabsProps {
  onCountChange?: (count: number) => void;
  onRefresh?: () => void;
}

export default function FollowUpTabs({ onCountChange, onRefresh }: FollowUpTabsProps) {
  const { noShow, followUpNeeded, secondIntro, plansToReschedule, counts, isLoading, refresh } = useFollowUpData();

  useEffect(() => {
    onCountChange?.(counts.total);
  }, [counts.total, onCountChange]);

  const handleRefresh = () => {
    refresh();
    onRefresh?.();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Follow-Up Queue</h2>
          <p className="text-xs text-muted-foreground">People who need your attention</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Tabs defaultValue="noshow" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-auto gap-0 bg-muted/60 p-0 rounded-lg">
          <TabsTrigger value="noshow" className="flex flex-col items-center gap-0.5 py-1.5 text-[10px] leading-tight rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span>No-Show</span>
            <Badge variant="secondary" className="h-3.5 px-1 text-[9px] min-w-[18px]">
              {counts.noShow}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="followup" className="flex flex-col items-center gap-0.5 py-1.5 text-[10px] leading-tight rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span>Follow-Up</span>
            <Badge variant="secondary" className="h-3.5 px-1 text-[9px] min-w-[18px]">
              {counts.followUpNeeded}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="secondintro" className="flex flex-col items-center gap-0.5 py-1.5 text-[10px] leading-tight rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span>2nd Intro</span>
            <Badge variant="secondary" className="h-3.5 px-1 text-[9px] min-w-[18px]">
              {counts.secondIntro}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="reschedule" className="flex flex-col items-center gap-0.5 py-1.5 text-[10px] leading-tight rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span>Reschedule</span>
            <Badge variant="secondary" className="h-3.5 px-1 text-[9px] min-w-[18px]">
              {counts.plansToReschedule}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="noshow" className="mt-3">
          <NoShowTab items={noShow} isLoading={isLoading} onRefresh={handleRefresh} />
        </TabsContent>
        <TabsContent value="followup" className="mt-3">
          <FollowUpNeededTab items={followUpNeeded} isLoading={isLoading} onRefresh={handleRefresh} />
        </TabsContent>
        <TabsContent value="secondintro" className="mt-3">
          <SecondIntroTab items={secondIntro} isLoading={isLoading} onRefresh={handleRefresh} />
        </TabsContent>
        <TabsContent value="reschedule" className="mt-3">
          <PlansToRescheduleTab items={plansToReschedule} isLoading={isLoading} onRefresh={handleRefresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
