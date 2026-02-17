/**
 * Virtualized pipeline table using @tanstack/react-virtual.
 * Renders PipelineRowCard for each journey.
 */
import { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import PipelineRowCard from './PipelineRowCard';
import type { ClientJourney, VipInfo, PipelineBooking } from '../pipelineTypes';

interface PipelineTableProps {
  journeys: ClientJourney[];
  expandedClients: Set<string>;
  onToggleExpand: (key: string) => void;
  vipInfoMap: Map<string, VipInfo>;
  isVipTab: boolean;
  vipGroups: [string, ClientJourney[]][] | null;
  isSaving: boolean;
  onEditBooking: (b: PipelineBooking) => void;
  onEditRun: (r: any) => void;
  onPurchase: (b: PipelineBooking) => void;
  onMarkNotInterested: (b: PipelineBooking) => void;
  onSetOwner: (b: PipelineBooking) => void;
  onSoftDelete: (b: PipelineBooking) => void;
  onHardDeleteBooking: (b: PipelineBooking) => void;
  onHardDeleteRun: (r: any) => void;
  onLog2ndIntroRun: (j: ClientJourney) => void;
  onBook2ndIntro: (j: ClientJourney) => void;
  onCreateRun: (j: ClientJourney) => void;
  onLinkRun: (r: any, bookings: PipelineBooking[]) => void;
  onCreateMatchingBooking: (r: any) => void;
  onUnlinkRun: (r: any) => void;
  onMarkRunNotInterested: (r: any, j: ClientJourney) => void;
  userName: string;
  // VIP bulk schedule
  bulkScheduleGroup: string | null;
  onBulkScheduleGroup: (g: string | null) => void;
  bulkDate: string;
  onBulkDateChange: (d: string) => void;
  bulkTime: string;
  onBulkTimeChange: (t: string) => void;
  onBulkSchedule: (g: string) => void;
  isBulkUpdating: boolean;
}

export default function PipelineTable({
  journeys,
  expandedClients,
  onToggleExpand,
  vipInfoMap,
  isVipTab,
  vipGroups,
  isSaving,
  onEditBooking,
  onEditRun,
  onPurchase,
  onMarkNotInterested,
  onSetOwner,
  onSoftDelete,
  onHardDeleteBooking,
  onHardDeleteRun,
  onLog2ndIntroRun,
  onBook2ndIntro,
  onCreateRun,
  onLinkRun,
  onCreateMatchingBooking,
  onUnlinkRun,
  onMarkRunNotInterested,
  userName,
  bulkScheduleGroup,
  onBulkScheduleGroup,
  bulkDate,
  onBulkDateChange,
  bulkTime,
  onBulkTimeChange,
  onBulkSchedule,
  isBulkUpdating,
}: PipelineTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // For VIP mode, flatten groups into items
  const flatItems = useMemo(() => {
    if (isVipTab && vipGroups) {
      const items: { type: 'header' | 'journey'; groupName?: string; journey?: ClientJourney; count?: number }[] = [];
      vipGroups.forEach(([groupName, groupJourneys]) => {
        items.push({ type: 'header', groupName, count: groupJourneys.length });
        groupJourneys.slice(0, 100).forEach(j => items.push({ type: 'journey', journey: j }));
      });
      return items;
    }
    return journeys.map(j => ({ type: 'journey' as const, journey: j }));
  }, [isVipTab, vipGroups, journeys]);

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = flatItems[index];
      if (item.type === 'header') return 48;
      const journey = item.journey!;
      return expandedClients.has(journey.memberKey) ? 400 : 72;
    },
    overscan: 5,
  });

  if (flatItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        No clients match the current filters
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-[500px] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => {
          const item = flatItems[virtualRow.index];

          if (item.type === 'header') {
            return (
              <div
                key={`header-${item.groupName}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="py-1"
              >
                <VipGroupHeader
                  groupName={item.groupName!}
                  count={item.count!}
                  bulkScheduleGroup={bulkScheduleGroup}
                  onBulkScheduleGroup={onBulkScheduleGroup}
                  bulkDate={bulkDate}
                  onBulkDateChange={onBulkDateChange}
                  bulkTime={bulkTime}
                  onBulkTimeChange={onBulkTimeChange}
                  onBulkSchedule={onBulkSchedule}
                  isBulkUpdating={isBulkUpdating}
                />
              </div>
            );
          }

          const journey = item.journey!;
          return (
            <div
              key={journey.memberKey}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="py-1"
            >
              <PipelineRowCard
                journey={journey}
                isExpanded={expandedClients.has(journey.memberKey)}
                onToggle={() => onToggleExpand(journey.memberKey)}
                vipInfo={journey.bookings.map(b => vipInfoMap.get(b.id)).find(v => v) || null}
                isSaving={isSaving}
                onEditBooking={onEditBooking}
                onEditRun={onEditRun}
                onPurchase={onPurchase}
                onMarkNotInterested={onMarkNotInterested}
                onSetOwner={onSetOwner}
                onSoftDelete={onSoftDelete}
                onHardDeleteBooking={onHardDeleteBooking}
                onHardDeleteRun={onHardDeleteRun}
                onLog2ndIntroRun={() => onLog2ndIntroRun(journey)}
                onBook2ndIntro={() => onBook2ndIntro(journey)}
                onCreateRun={() => onCreateRun(journey)}
                onLinkRun={onLinkRun}
                onCreateMatchingBooking={onCreateMatchingBooking}
                onUnlinkRun={onUnlinkRun}
                onMarkRunNotInterested={(r) => onMarkRunNotInterested(r, journey)}
              />
            </div>
          );
        })}
      </div>
      {journeys.length > 100 && !isVipTab && (
        <div className="text-center text-xs text-muted-foreground py-2">
          Showing {Math.min(flatItems.length, journeys.length)} clients (virtualized)
        </div>
      )}
    </div>
  );
}

// ── VIP Group Header ──
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Star, CalendarPlus, Save, X, Loader2 } from 'lucide-react';

function VipGroupHeader({
  groupName,
  count,
  bulkScheduleGroup,
  onBulkScheduleGroup,
  bulkDate,
  onBulkDateChange,
  bulkTime,
  onBulkTimeChange,
  onBulkSchedule,
  isBulkUpdating,
}: {
  groupName: string;
  count: number;
  bulkScheduleGroup: string | null;
  onBulkScheduleGroup: (g: string | null) => void;
  bulkDate: string;
  onBulkDateChange: (d: string) => void;
  bulkTime: string;
  onBulkTimeChange: (t: string) => void;
  onBulkSchedule: (g: string) => void;
  isBulkUpdating: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-purple-50 border border-purple-200">
        <Star className="w-3.5 h-3.5 text-purple-600" />
        <span className="text-sm font-semibold text-purple-700">{groupName}</span>
        <Badge variant="secondary" className="text-[10px] h-5">{count}</Badge>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-6 text-[10px] gap-1 border-purple-300 text-purple-700 hover:bg-purple-100"
          onClick={() => onBulkScheduleGroup(bulkScheduleGroup === groupName ? null : groupName)}
        >
          <CalendarPlus className="w-3 h-3" />
          Set Date & Time
        </Button>
      </div>
      {bulkScheduleGroup === groupName && (
        <div className="flex items-center gap-2 mt-1.5 px-2 py-2 rounded-md bg-purple-50/50 border border-purple-100">
          <Input type="date" value={bulkDate} onChange={(e) => onBulkDateChange(e.target.value)} className="h-7 text-xs w-36" />
          <Input type="time" value={bulkTime} onChange={(e) => onBulkTimeChange(e.target.value)} className="h-7 text-xs w-28" />
          <Button size="sm" className="h-7 text-xs gap-1" disabled={isBulkUpdating || !bulkDate || !bulkTime} onClick={() => onBulkSchedule(groupName)}>
            {isBulkUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Apply
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onBulkScheduleGroup(null)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
