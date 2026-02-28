/**
 * Plans to Reschedule tab — people who said they want to come back.
 * Shows editable "Suggested contact: [date]" with inline date picker.
 * Actions: [Send Text] [Book Intro]
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, CalendarPlus, Calendar as CalendarIcon } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import IntroCard from '@/components/shared/IntroCard';
import { useAuth } from '@/context/AuthContext';
import type { FollowUpItem } from './useFollowUpData';

interface Props {
  items: FollowUpItem[];
  isLoading: boolean;
  onRefresh: () => void;
}

const PAGE_SIZE = 20;

function ContactDatePicker({ item, onRefresh }: { item: FollowUpItem; onRefresh: () => void }) {
  const [date, setDate] = useState<Date | undefined>(
    item.rescheduleContactDate ? new Date(item.rescheduleContactDate + 'T12:00:00') : undefined
  );
  const [saving, setSaving] = useState(false);

  const handleSelect = async (d: Date | undefined) => {
    if (!d) return;
    setDate(d);
    setSaving(true);
    try {
      await supabase.from('intros_booked').update({
        reschedule_contact_date: format(d, 'yyyy-MM-dd'),
      } as any).eq('id', item.bookingId);
      toast.success('Contact date updated');
      onRefresh();
    } catch {
      toast.error('Failed to save date');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors',
            'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
            'hover:bg-blue-100 dark:hover:bg-blue-900/40',
          )}
          disabled={saving}
        >
          <CalendarIcon className="w-3 h-3" />
          <span>
            Suggested contact: {date ? format(date, 'MMM d') : 'Set date'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

export default function PlansToRescheduleTab({ items, isLoading, onRefresh }: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { user } = useAuth();

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Loading...</p>;
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-4">No pending reschedules.</p>;
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
          borderColor="#2563eb"
          editable
          bookingId={item.bookingId}
          editedBy={user?.name || ''}
          onFieldSaved={onRefresh}
          outcomeBadge={
            <Badge className="text-[10px] px-1.5 py-0 h-5 bg-blue-100 text-blue-700 border-blue-300 border">
              📅 Plans to Reschedule
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
                    detail: { bookingId: item.bookingId, isSecondIntro: false, category: 'reschedule' },
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
                Book Intro
              </Button>
            </>
          }
          lastContactSummary={item.lastContactSummary || undefined}
        >
          <ContactDatePicker item={item} onRefresh={onRefresh} />
        </IntroCard>
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
