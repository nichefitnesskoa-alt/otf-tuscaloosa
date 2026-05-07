import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Star, CalendarClock, Users, Calendar, Heart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { VipsTodayTab } from './VipsTodayTab';
import { VipsAllTab } from './VipsAllTab';
import { VipsScheduleTab } from './VipsScheduleTab';

export default function VipsPage() {
  const { user } = useAuth();
  const isCoach = user?.role === 'Coach';
  // Always defaults to schedule on every mount — never persisted.
  const [tab, setTab] = useState(isCoach ? 'all' : 'schedule');

  return (
    <div className="p-4 pb-24 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Star className="w-5 h-5 text-[#E8540A]" /> VIPs
          </h1>
          <p className="text-xs text-muted-foreground">
            {isCoach ? 'VIPs in your classes (read-only).' : 'Schedule VIP classes. Hospitality lives in its own tab.'}
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className={`w-full grid ${isCoach ? 'grid-cols-2' : 'grid-cols-3'} h-auto bg-muted/60 rounded-lg border border-primary/40`}>
          {!isCoach && (
            <TabsTrigger value="schedule" className="flex flex-col items-center py-2 text-xs gap-0.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Calendar className="w-4 h-4" /> Schedule
            </TabsTrigger>
          )}
          <TabsTrigger value="all" className="flex flex-col items-center py-2 text-xs gap-0.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="w-4 h-4" /> All VIPs
          </TabsTrigger>
          <TabsTrigger value="hospitality" className="flex flex-col items-center py-2 text-xs gap-0.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Heart className="w-4 h-4" /> Hospitality
          </TabsTrigger>
        </TabsList>

        {!isCoach && <TabsContent value="schedule" className="mt-3"><VipsScheduleTab /></TabsContent>}
        <TabsContent value="all" className="mt-3"><VipsAllTab /></TabsContent>
        <TabsContent value="hospitality" className="mt-3"><VipsTodayTab /></TabsContent>
      </Tabs>
    </div>
  );
}
