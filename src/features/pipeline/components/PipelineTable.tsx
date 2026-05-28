/**
 * Virtualized pipeline table using @tanstack/react-virtual.
 */
import { useRef, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2, Star, CalendarPlus, X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ClassTimeSelect } from '@/components/shared/FormHelpers';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PipelineRowCard } from './PipelineRowCard';
import type { ClientJourney, JourneyTab, VipInfo } from '../pipelineTypes';

interface PipelineTableProps {
  journeys: ClientJourney[];
  vipGroups: [string, ClientJourney[]][] | null;
  vipInfoMap: Map<string, VipInfo>;
  isLoading: boolean;
  activeTab: JourneyTab;
  isOnline: boolean;
  onOpenDialog: (type: string, data?: any) => void;
  onRefresh: () => Promise<void>;
}

const ESTIMATED_ROW_HEIGHT = 80;

export function PipelineTable({
  journeys, vipGroups, vipInfoMap, isLoading, activeTab, isOnline, onOpenDialog, onRefresh,
}: PipelineTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // VIP bulk schedule state
  const [bulkScheduleGroup, setBulkScheduleGroup] = useState<string | null>(null);
  const [bulkDate, setBulkDate] = useState('');
  const [bulkTime, setBulkTime] = useState('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const handleBulkSchedule = async (groupName: string) => {
    if (!bulkDate || !bulkTime) { toast.error('Please set both date and time'); return; }
    setIsBulkUpdating(true);
    try {
      const { data: updated, error } = await supabase
        .from('intros_booked')
        .update({ class_date: bulkDate, intro_time: bulkTime })
        .eq('vip_class_name', groupName)
        .is('deleted_at', null)
        .select('id');
      if (error) throw error;
      const count = updated?.length || 0;
      if (count > 0) {
        const bookingIds = updated!.map(b => b.id);
        await supabase.from('intro_questionnaires')
          .update({ scheduled_class_date: bulkDate, scheduled_class_time: bulkTime })
          .in('booking_id', bookingIds);
      }
      toast.success(`Updated ${count} bookings for ${groupName}`);
      setBulkScheduleGroup(null);
      setBulkDate(''); setBulkTime('');
      await onRefresh();
    } catch (err) {
      console.error('Bulk schedule error:', err);
      toast.error('Failed to update group schedule');
    } finally { setIsBulkUpdating(false); }
  };

  // Always call useVirtualizer unconditionally (Rules of Hooks — fixes React error #300)
  const virtualizer = useVirtualizer({
    count: journeys.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 10,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (journeys.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-8">No clients match current filters</div>;
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (journeys.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-8">No clients match current filters</div>;
  }

  return (
    <div ref={parentRef} className="h-[500px] overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualRow => {
          const journey = journeys[virtualRow.index];
          return (
            <div
              key={journey.memberKey}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
            >
              <div className="pb-2">
                <PipelineRowCard
                  journey={journey}
                  vipInfoMap={vipInfoMap}
                  isOnline={isOnline}
                  onOpenDialog={onOpenDialog}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
