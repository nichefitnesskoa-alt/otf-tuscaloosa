/**
 * Missed Guest tab — people who showed up but didn't buy (past bookings with no run record).
 * Actions: [Send Text] [Log Outcome]
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, ClipboardEdit } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import IntroCard from '@/components/shared/IntroCard';
import { useAuth } from '@/context/AuthContext';
import type { FollowUpItem } from './useFollowUpData';

interface MissedGuestTabProps {
  items: FollowUpItem[];
  isLoading: boolean;
  onRefresh: () => void;
}

const PAGE_SIZE = 20;

export default function MissedGuestTab({ items, isLoading, onRefresh }: MissedGuestTabProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { user } = useAuth();

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Loading...</p>;
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-4">No missed guests right now.</p>;
  }

  const visible = items.slice(0, visibleCount);

  return (
    <div className="space-y-6">
      {visible.map(item => (
        <IntroCard
          key={item.bookingId}
          memberName={item.memberName}
          classDate={item.classDate}
          introTime={item.introTime}
          coachName={item.coachName}
          leadSource={item.leadSource}
          phone={item.phone}
          borderColor="#64748b"
          editable
          bookingId={item.bookingId}
          editedBy={user?.name || ''}
          onFieldSaved={onRefresh}
          outcomeBadge={
            <Badge className="text-[10px] px-1.5 py-0 h-5 bg-muted text-muted-foreground border">
              👻 Missed Guest
            </Badge>
          }
          timingInfo={item.lastContactAt
            ? `Last contact ${formatDistanceToNow(new Date(item.lastContactAt), { addSuffix: true })}`
            : 'No contact logged'
          }
          actionButtons={
            <>
              <Button
                size="sm"
                className="h-8 flex-1 text-xs gap-1"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('myday:open-script', {
                    detail: { bookingId: item.bookingId, isSecondIntro: false, category: 'no_show' },
                  }));
                }}
              >
                <Send className="w-3.5 h-3.5" />
                Send Text
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 flex-1 text-xs gap-1"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('myday:open-outcome', {
                    detail: { bookingId: item.bookingId },
                  }));
                }}
              >
                <ClipboardEdit className="w-3.5 h-3.5" />
                Log Outcome
              </Button>
            </>
          }
          lastContactSummary={item.lastContactSummary || undefined}
        />
      ))}
      {visibleCount < items.length && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
        >
          Load More ({items.length - visibleCount} remaining)
        </Button>
      )}
    </div>
  );
}
