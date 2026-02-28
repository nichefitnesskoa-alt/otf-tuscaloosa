/**
 * Follow-Up Needed tab.
 * State A: No 2nd intro booked → [Send Text] [Book 2nd Intro]
 * State B: 2nd intro ran, non-terminal → [Gather Feedback] [Mark Not Interested]
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, CalendarPlus, MessageSquare, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import IntroCard from '@/components/shared/IntroCard';
import type { FollowUpItem } from './useFollowUpData';

interface Props {
  items: FollowUpItem[];
  isLoading: boolean;
  onRefresh: () => void;
}

const PAGE_SIZE = 20;

export default function FollowUpNeededTab({ items, isLoading, onRefresh }: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [markingNotInterested, setMarkingNotInterested] = useState<string | null>(null);

  const handleMarkNotInterested = async (item: FollowUpItem) => {
    setMarkingNotInterested(item.bookingId);
    try {
      if (item.runId) {
        await supabase.from('intros_run').update({
          result: 'Not Interested',
          result_canon: 'NOT_INTERESTED',
        }).eq('id', item.runId);
      }
      toast.success(`${item.memberName} marked as Not Interested`);
      onRefresh();
    } catch {
      toast.error('Failed to update');
    } finally {
      setMarkingNotInterested(null);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Loading...</p>;
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-4">Follow-up queue is clear.</p>;
  }

  const visible = items.slice(0, visibleCount);

  return (
    <div className="space-y-6">
      {visible.map(item => {
        const isStateB = item.followUpState === 'B';
        return (
          <IntroCard
            key={item.bookingId}
            memberName={item.memberName}
            classDate={item.classDate}
            introTime={item.introTime}
            coachName={item.coachName}
            leadSource={item.leadSource}
            phone={item.phone}
            borderColor={isStateB ? '#d97706' : '#dc2626'}
            outcomeBadge={
              <Badge className={`text-[10px] px-1.5 py-0 h-5 border ${
                isStateB
                  ? 'bg-amber-100 text-amber-700 border-amber-300'
                  : 'bg-red-100 text-red-700 border-red-300'
              }`}>
                {isStateB ? '⏳ 2nd Intro — Still Undecided' : '📋 Follow-up Needed'}
              </Badge>
            }
            timingInfo={item.lastContactAt
              ? `Last contact ${formatDistanceToNow(new Date(item.lastContactAt), { addSuffix: true })}`
              : 'No contact logged'
            }
            actionButtons={
              isStateB ? (
                <>
                  <Button
                    size="sm"
                    className="h-8 flex-1 text-xs gap-1"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('myday:open-script', {
                        detail: { bookingId: item.bookingId, isSecondIntro: true, category: 'feedback' },
                      }));
                    }}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Gather Feedback
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 flex-1 text-xs gap-1"
                    onClick={() => handleMarkNotInterested(item)}
                    disabled={markingNotInterested === item.bookingId}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Not Interested
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    className="h-8 flex-1 text-xs gap-1"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('myday:open-script', {
                        detail: { bookingId: item.bookingId, isSecondIntro: false, category: 'follow_up' },
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
              )
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
