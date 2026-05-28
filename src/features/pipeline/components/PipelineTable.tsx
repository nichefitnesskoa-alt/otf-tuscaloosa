/**
 * Virtualized pipeline table using @tanstack/react-virtual.
 */
import { useRef, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2 } from 'lucide-react';
import { PipelineRowCard } from './PipelineRowCard';
import type { ClientJourney, JourneyTab, VipInfo } from '../pipelineTypes';

interface PipelineTableProps {
  journeys: ClientJourney[];
  vipInfoMap: Map<string, VipInfo>;
  isLoading: boolean;
  activeTab: JourneyTab;
  isOnline: boolean;
  onOpenDialog: (type: string, data?: any) => void;
}

const ESTIMATED_ROW_HEIGHT = 80;

export function PipelineTable({
  journeys, vipInfoMap, isLoading, activeTab, isOnline, onOpenDialog,
}: PipelineTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Always call useVirtualizer unconditionally (Rules of Hooks)
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
