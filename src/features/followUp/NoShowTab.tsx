/**
 * No-Show tab — people who didn't show up.
 * Actions: [Send Text] [Book 2nd Intro] [Log as Sent] [Dismiss]
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, CalendarPlus, CheckCheck, Trash2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import IntroCard from '@/components/shared/IntroCard';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { FollowUpItem } from './useFollowUpData';

interface NoShowTabProps {
  items: FollowUpItem[];
  isLoading: boolean;
  onRefresh: () => void;
}

const PAGE_SIZE = 20;

export default function NoShowTab({ items, isLoading, onRefresh }: NoShowTabProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [dismissTarget, setDismissTarget] = useState<FollowUpItem | null>(null);
  const { user } = useAuth();

  const handleLogSent = async (item: FollowUpItem) => {
    await supabase.from('script_actions').insert({
      booking_id: item.bookingId,
      action_type: 'script_sent',
      completed_by: user?.name || 'Unknown',
      script_category: 'no_show',
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
          editable
          bookingId={item.bookingId}
          editedBy={user?.name || ''}
          onFieldSaved={onRefresh}
          outcomeBadge={
            <Badge className="text-[10px] px-1.5 py-0 h-5 bg-destructive/15 text-destructive border">
              🚫 No-Show
            </Badge>
          }
          timingInfo={
            <div className="space-y-0.5">
              <p>{item.lastContactAt
                ? `Last contact ${formatDistanceToNow(new Date(item.lastContactAt), { addSuffix: true })}${item.lastContactSummary ? ` via ${item.lastContactSummary}` : ''}`
                : 'Never contacted'}</p>
              {item.contactNextDate && (
                <p className="text-muted-foreground">Contact next: {format(new Date(item.contactNextDate + 'T12:00:00'), 'MMM d')}</p>
              )}
            </div>
          }
          actionButtons={
            <div className="flex flex-col gap-1.5 w-full">
              <div className="flex gap-1.5">
                <Button size="sm" className="h-8 flex-1 text-xs gap-1" onClick={() => {
                  window.dispatchEvent(new CustomEvent('myday:open-script', {
                    detail: { bookingId: item.bookingId, isSecondIntro: false, category: 'no_show' },
                  }));
                }}>
                  <Send className="w-3.5 h-3.5" /> Send Text
                </Button>
                <Button size="sm" variant="outline" className="h-8 flex-1 text-xs gap-1" onClick={() => {
                  window.dispatchEvent(new CustomEvent('followup:book-second-intro', {
                    detail: { bookingId: item.bookingId, memberName: item.memberName, phone: item.phone },
                  }));
                }}>
                  <CalendarPlus className="w-3.5 h-3.5" /> Book 2nd
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
      ))}
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
