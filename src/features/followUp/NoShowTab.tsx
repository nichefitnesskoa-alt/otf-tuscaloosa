/**
 * No-Show tab — people who didn't show up or missed their booking.
 * Actions: [Send Text] [Book 2nd Intro]
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, CalendarPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import IntroCard from '@/components/shared/IntroCard';
import type { FollowUpItem } from './useFollowUpData';

interface NoShowTabProps {
  items: FollowUpItem[];
  isLoading: boolean;
  onRefresh: () => void;
}

const PAGE_SIZE = 20;

export default function NoShowTab({ items, isLoading, onRefresh }: NoShowTabProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Loading...</p>;
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-4">No no-shows right now. Great day.</p>;
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
          outcomeBadge={
            <Badge className="text-[10px] px-1.5 py-0 h-5 bg-muted text-muted-foreground border">
              👻 {item.result || 'Missed Guest'}
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
                  window.dispatchEvent(new CustomEvent('followup:book-second-intro', {
                    detail: { bookingId: item.bookingId, memberName: item.memberName, phone: item.phone },
                  }));
                }}
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Book 2nd Intro
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
