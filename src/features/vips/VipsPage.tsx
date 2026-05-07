import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Star, CalendarClock, Users, Calendar } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { VipsTodayTab } from './VipsTodayTab';
import { VipsAllTab } from './VipsAllTab';
import { VipsScheduleTab } from './VipsScheduleTab';

export default function VipsPage() {
  const { user } = useAuth();
  const isCoach = user?.role === 'Coach';
  const [tab, setTab] = useState('today');

  return (
    <div className="p-4 pb-24 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Star className="w-5 h-5 text-[#E8540A]" /> VIPs
          </h1>
          <p className="text-xs text-muted-foreground">
            {isCoach ? 'VIPs in your classes (read-only).' : 'Hospitality, not a workflow. Treat them like guests.'}
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-3 h-auto bg-muted/60 rounded-lg border border-primary/40">
          <TabsTrigger value="today" className="flex flex-col items-center py-2 text-xs gap-0.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <CalendarClock className="w-4 h-4" /> Today
          </TabsTrigger>
          <TabsTrigger value="all" className="flex flex-col items-center py-2 text-xs gap-0.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="w-4 h-4" /> All VIPs
          </TabsTrigger>
          {!isCoach && (
            <TabsTrigger value="schedule" className="flex flex-col items-center py-2 text-xs gap-0.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Calendar className="w-4 h-4" /> Schedule
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="today" className="mt-3"><VipsTodayTab /></TabsContent>
        <TabsContent value="all" className="mt-3"><VipsAllTab /></TabsContent>
        {!isCoach && <TabsContent value="schedule" className="mt-3"><VipsScheduleTab /></TabsContent>}
      </Tabs>
    </div>
  );
}
