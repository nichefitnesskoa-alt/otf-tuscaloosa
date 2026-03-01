/**
 * 2nd Intro tab — with Log as Sent + Dismiss buttons.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Eye, ClipboardList, CheckCheck, Trash2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import IntroCard from '@/components/shared/IntroCard';
import { ContactNextEditor } from '@/components/shared/ContactNextEditor';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { FollowUpItem } from './useFollowUpData';

interface Props {
  items: FollowUpItem[];
  isLoading: boolean;
  onRefresh: () => void;
}

const PAGE_SIZE = 20;

export default function SecondIntroTab({ items, isLoading, onRefresh }: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [dismissTarget, setDismissTarget] = useState<FollowUpItem | null>(null);
  const { user } = useAuth();

  const handleLogSent = async (item: FollowUpItem) => {
    await supabase.from('script_actions').insert({
      booking_id: item.bookingId,
      action_type: 'script_sent',
      completed_by: user?.name || 'Unknown',
      script_category: 'confirmation',
    });
    toast.success(`Logged as sent for ${item.memberName}`);
    onRefresh();
  };

  const handleDismiss = async () => {
    if (!dismissTarget) return;
    await supabase.from('intros_booked').update({
      followup_dismissed_at: new Date().toISOString(),
    } as any).eq('id', dismissTarget.bookingId);
    toast.success(`${dismissTarget.memberName} removed from follow-up queue`);
    setDismissTarget(null);
    onRefresh();
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Loading...</p>;
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-4">No 2nd intros scheduled.</p>;
  }

  const visible = items.slice(0, visibleCount);

  return (
    <div className="space-y-6">
      {visible.map(item => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const isToday = item.classDate === todayStr;
        const isFuture = item.classDate > todayStr;

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
            editable
            bookingId={item.bookingId}
            editedBy={user?.name || ''}
            onFieldSaved={onRefresh}
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
            timingInfo={
              <div className="space-y-0.5">
                {item.introTime && <p>Class at {formatDisplayTime(item.introTime)}</p>}
                {item.lastContactAt && (
                  <p>Last contact {formatDistanceToNow(new Date(item.lastContactAt), { addSuffix: true })}</p>
                )}
                <ContactNextEditor
                  bookingId={item.bookingId}
                  contactNextDate={item.contactNextDate}
                  rescheduleContactDate={item.rescheduleContactDate}
                  onSaved={onRefresh}
                />
              </div>
            }
            actionButtons={
              <div className="flex flex-col gap-1.5 w-full">
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-8 flex-1 text-xs gap-1" onClick={() => {
                    window.dispatchEvent(new CustomEvent('myday:open-script', {
                      detail: { bookingId: item.bookingId, isSecondIntro: true, category: 'confirmation' },
                    }));
                  }}>
                    <CheckCircle className="w-3.5 h-3.5" /> Confirm
                  </Button>
                  <Button size="sm" variant="secondary" className="h-8 flex-1 text-xs gap-1" onClick={() => {
                    window.dispatchEvent(new CustomEvent('myday:open-prep', { detail: { bookingId: item.bookingId } }));
                  }}>
                    <Eye className="w-3.5 h-3.5" /> Prep
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 flex-1 text-xs gap-1" onClick={() => {
                    window.dispatchEvent(new CustomEvent('myday:open-outcome', { detail: { bookingId: item.bookingId } }));
                  }}>
                    <ClipboardList className="w-3.5 h-3.5" /> Outcome
                  </Button>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" className="h-7 flex-1 text-[10px] gap-1" onClick={() => handleLogSent(item)}>
                    <CheckCheck className="w-3 h-3" /> Log as Sent
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-destructive" onClick={() => setDismissTarget(item)}>
                    <Trash2 className="w-3 h-3" /> Dismiss
                  </Button>
                </div>
              </div>
            }
            lastContactSummary={item.lastContactSummary || undefined}
          />
        );
      })}
      {visibleCount < items.length && (
        <Button variant="outline" className="w-full" onClick={() => setVisibleCount(v => v + PAGE_SIZE)}>
          Load More ({items.length - visibleCount} remaining)
        </Button>
      )}
      <AlertDialog open={!!dismissTarget} onOpenChange={() => setDismissTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Follow-Up Queue?</AlertDialogTitle>
            <AlertDialogDescription>Remove {dismissTarget?.memberName} from the follow-up queue?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDismiss}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
