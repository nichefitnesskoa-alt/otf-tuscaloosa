/**
 * Missed Guests tab — merged: no outcome (past bookings), follow-up needed, and state B (2nd intro non-terminal).
 * Actions vary by state. All cards get [Log as Sent] [Dismiss].
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, CalendarPlus, MessageSquare, XCircle, CheckCheck, Trash2, ClipboardEdit } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import IntroCard from '@/components/shared/IntroCard';
import { ContactNextEditor } from '@/components/shared/ContactNextEditor';
import { useAuth } from '@/context/AuthContext';
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
  const [dismissTarget, setDismissTarget] = useState<FollowUpItem | null>(null);
  const { user } = useAuth();

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

  const handleLogSent = async (item: FollowUpItem) => {
    await supabase.from('script_actions').insert({
      booking_id: item.bookingId,
      action_type: 'script_sent',
      completed_by: user?.name || 'Unknown',
      script_category: 'follow_up',
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
    return <p className="text-sm text-muted-foreground italic py-4">No missed guests right now.</p>;
  }

  const visible = items.slice(0, visibleCount);

  return (
    <div className="space-y-6">
      {visible.map(item => {
        const isStateB = item.followUpState === 'B';
        const isNoOutcome = item.badgeType === 'no_outcome';
        
        const badge = isStateB
          ? <Badge className="text-[10px] px-1.5 py-0 h-5 border bg-amber-100 text-amber-700 border-amber-300">⏳ 2nd Intro — Still Undecided</Badge>
          : isNoOutcome
            ? <Badge className="text-[10px] px-1.5 py-0 h-5 bg-muted text-muted-foreground border">👻 Missed Guest</Badge>
            : <Badge className="text-[10px] px-1.5 py-0 h-5 border bg-red-100 text-red-700 border-red-300">📋 Follow-up Needed</Badge>;

        return (
          <IntroCard
            key={item.bookingId}
            memberName={item.memberName}
            classDate={item.classDate}
            introTime={item.introTime}
            coachName={item.coachName}
            leadSource={item.leadSource}
            phone={item.phone}
            borderColor={isStateB ? '#d97706' : isNoOutcome ? '#64748b' : '#dc2626'}
            editable
            bookingId={item.bookingId}
            editedBy={user?.name || ''}
            onFieldSaved={onRefresh}
            outcomeBadge={badge}
            timingInfo={
              <div className="space-y-0.5">
                <p>{item.lastContactAt
                  ? `Last contact ${formatDistanceToNow(new Date(item.lastContactAt), { addSuffix: true })}${item.lastContactSummary ? ` via ${item.lastContactSummary}` : ''}`
                  : 'Never contacted'}</p>
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
                  {isStateB ? (
                    <>
                      <Button size="sm" className="h-8 flex-1 text-xs gap-1" onClick={() => {
                        window.dispatchEvent(new CustomEvent('myday:open-script', {
                          detail: { bookingId: item.bookingId, isSecondIntro: true, category: 'feedback' },
                        }));
                      }}>
                        <MessageSquare className="w-3.5 h-3.5" /> Gather Feedback
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 flex-1 text-xs gap-1"
                        onClick={() => handleMarkNotInterested(item)}
                        disabled={markingNotInterested === item.bookingId}>
                        <XCircle className="w-3.5 h-3.5" /> Not Interested
                      </Button>
                    </>
                  ) : isNoOutcome ? (
                    <>
                      <Button size="sm" className="h-8 flex-1 text-xs gap-1" onClick={() => {
                        window.dispatchEvent(new CustomEvent('myday:open-script', {
                          detail: { bookingId: item.bookingId, isSecondIntro: false, category: 'no_show' },
                        }));
                      }}>
                        <Send className="w-3.5 h-3.5" /> Send Text
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 flex-1 text-xs gap-1" onClick={() => {
                        window.dispatchEvent(new CustomEvent('myday:open-outcome', {
                          detail: { bookingId: item.bookingId },
                        }));
                      }}>
                        <ClipboardEdit className="w-3.5 h-3.5" /> Log Outcome
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" className="h-8 flex-1 text-xs gap-1" onClick={() => {
                        window.dispatchEvent(new CustomEvent('myday:open-script', {
                          detail: { bookingId: item.bookingId, isSecondIntro: false, category: 'follow_up' },
                        }));
                      }}>
                        <Send className="w-3.5 h-3.5" /> Send Text
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 flex-1 text-xs gap-1" onClick={() => {
                        window.dispatchEvent(new CustomEvent('followup:book-second-intro', {
                          detail: { bookingId: item.bookingId, memberName: item.memberName, phone: item.phone },
                        }));
                      }}>
                        <CalendarPlus className="w-3.5 h-3.5" /> Book 2nd Intro
                      </Button>
                    </>
                  )}
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
            <AlertDialogDescription>Remove {dismissTarget?.memberName} from the follow-up queue? They won't appear here again.</AlertDialogDescription>
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
