/**
 * Day group: header with date label, count, Q ratio, and bulk actions.
 * Renders intro row cards for that day with Prep/Script/Coach/Outcome buttons.
 */
import { Badge } from '@/components/ui/badge';
import type { DayGroup } from './myDayTypes';
import IntroRowCard from './IntroRowCard';
import BulkActionsBar from './BulkActionsBar';

interface IntroDayGroupProps {
  group: DayGroup;
  isOnline: boolean;
  userName: string;
  onSendQ: (bookingId: string) => void;
  onConfirm: (bookingId: string) => void;
  onRefresh: () => void;
  needsOutcome?: boolean;
}

export default function IntroDayGroup({
  group, isOnline, userName, onSendQ, onConfirm, onRefresh, needsOutcome = false,
}: IntroDayGroupProps) {
  const qPercent = Math.round(group.qSentRatio * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{group.label}</h3>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {group.items.length} intro{group.items.length !== 1 ? 's' : ''}
          </Badge>
          {!needsOutcome && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${qPercent === 100 ? 'text-emerald-700 border-emerald-300' : qPercent >= 50 ? 'text-amber-700 border-amber-300' : 'text-destructive border-destructive/30'}`}>
              Q: {qPercent}%
            </Badge>
          )}
        </div>
      </div>
      <BulkActionsBar items={group.items} userName={userName} isOnline={isOnline} onDone={onRefresh} />
      <div className="space-y-2">
        {group.items.map(item => (
          <IntroRowCard
            key={item.bookingId}
            item={item}
            isOnline={isOnline}
            userName={userName}
            onSendQ={onSendQ}
            onConfirm={onConfirm}
            onRefresh={onRefresh}
            needsOutcome={needsOutcome}
          />
        ))}
      </div>
    </div>
  );
}
