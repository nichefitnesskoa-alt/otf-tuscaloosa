/**
 * 2nd Intro tab — unrun 2nd intro bookings.
 * Actions: [Confirm] [Prep] [Outcome]
 * Shows class date/time prominently.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Eye, ClipboardList } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import IntroCard from '@/components/shared/IntroCard';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import type { FollowUpItem } from './useFollowUpData';

interface Props {
  items: FollowUpItem[];
  isLoading: boolean;
  onRefresh: () => void;
}

const PAGE_SIZE = 20;

export default function SecondIntroTab({ items, isLoading, onRefresh }: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Loading...</p>;
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-4">No 2nd intros scheduled.</p>;
  }

  const visible = items.slice(0, visibleCount);

  return (
    <div className="space-y-6">
      {visible.map(item => {
        const isToday = item.classDate === format(new Date(), 'yyyy-MM-dd');
        const isFuture = item.classDate > format(new Date(), 'yyyy-MM-dd');

        return (
          <IntroCard
            key={item.bookingId}
            memberName={item.memberName}
            classDate={item.classDate}
            introTime={item.introTime}
            coachName={item.coachName}
            leadSource={item.leadSource}
            phone={item.phone}
            borderColor="#2563eb"
            badges={
              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-blue-600 text-white border-transparent">2nd</Badge>
            }
            outcomeBadge={
              <Badge className={`text-[10px] px-1.5 py-0 h-5 border ${
                isToday ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-blue-100 text-blue-700 border-blue-300'
              }`}>
                {isToday ? '🔥 Today' : isFuture ? '📅 Upcoming' : '⏳ Past — needs outcome'}
              </Badge>
            }
            timingInfo={item.introTime ? `Class at ${formatDisplayTime(item.introTime)}` : undefined}
            actionButtons={
              <>
                <Button
                  size="sm"
                  className="h-8 flex-1 text-xs gap-1"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('myday:open-script', {
                      detail: { bookingId: item.bookingId, isSecondIntro: true, category: 'confirmation' },
                    }));
                  }}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 flex-1 text-xs gap-1"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('myday:open-prep', {
                      detail: { bookingId: item.bookingId },
                    }));
                  }}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Prep
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 flex-1 text-xs gap-1"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('followup:open-outcome', {
                      detail: { bookingId: item.bookingId },
                    }));
                  }}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Outcome
                </Button>
              </>
            }
            lastContactSummary={item.lastContactSummary || undefined}
          />
        );
      })}
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
