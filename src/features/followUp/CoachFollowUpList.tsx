/**
 * Coach Follow-Up List — shows missed guests owned by the logged-in coach.
 * Records with owner_role='Coach' that haven't been transferred or closed.
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { ContactNextEditor } from '@/components/shared/ContactNextEditor';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CoachFollowUpItem {
  id: string;
  bookingId: string;
  memberName: string;
  classDate: string;
  coachName: string | null;
  saName: string | null;
  phone: string | null;
  touchNumber: number;
  scheduledDate: string;
  lastContactAt: string | null;
  lastContactSummary: string | null;
  createdAt: string;
}

interface CoachFollowUpListProps {
  onCountChange?: (count: number) => void;
}

export default function CoachFollowUpList({ onCountChange }: CoachFollowUpListProps) {
  const { user } = useAuth();
  const coachName = user?.name || '';
  const [items, setItems] = useState<CoachFollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!coachName) return;
    setLoading(true);
    try {
      const { data: queueItems } = await supabase
        .from('follow_up_queue')
        .select('*')
        .eq('owner_role' as any, 'Coach')
        .eq('coach_owner' as any, coachName)
        .is('not_interested_at' as any, null)
        .is('transferred_to_sa_at' as any, null)
        .order('scheduled_date', { ascending: true });

      if (!queueItems) { setItems([]); setLoading(false); return; }

      // Get booking details for SA name
      const bookingIds = queueItems.filter(q => q.booking_id).map(q => q.booking_id!);
      let bookingMap = new Map<string, { intro_owner: string | null; phone: string | null; class_date: string }>();
      if (bookingIds.length > 0) {
        const { data: bookings } = await supabase
          .from('intros_booked')
          .select('id, intro_owner, phone, class_date')
          .in('id', bookingIds);
        if (bookings) {
          bookingMap = new Map(bookings.map(b => [b.id, b]));
        }
      }

      // Get last touch per booking
      const { data: touches } = await supabase
        .from('followup_touches')
        .select('booking_id, created_at, touch_type')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false });
      
      const touchMap = new Map<string, { at: string; summary: string }>();
      for (const t of touches || []) {
        if (t.booking_id && !touchMap.has(t.booking_id)) {
          touchMap.set(t.booking_id, { at: t.created_at, summary: t.touch_type });
        }
      }

      const mapped: CoachFollowUpItem[] = queueItems.map(q => {
        const booking = q.booking_id ? bookingMap.get(q.booking_id) : undefined;
        const touch = q.booking_id ? touchMap.get(q.booking_id) : undefined;
        return {
          id: q.id,
          bookingId: q.booking_id || '',
          memberName: q.person_name,
          classDate: booking?.class_date || q.trigger_date,
          coachName: (q as any).coach_owner || null,
          saName: booking?.intro_owner || null,
          phone: booking?.phone || null,
          touchNumber: q.touch_number,
          scheduledDate: q.scheduled_date,
          lastContactAt: touch?.at || null,
          lastContactSummary: touch?.summary || null,
          createdAt: q.created_at,
        };
      });

      setItems(mapped);
    } catch (err) {
      console.error('Coach follow-up fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [coachName]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { onCountChange?.(items.length); }, [items.length, onCountChange]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="space-y-1">
        <div className={`text-5xl font-medium ${items.length === 0 ? 'text-success' : 'text-[#E8540A]'}`}>
          {items.length}
        </div>
        <p className="text-lg font-bold text-foreground">
          {items.length === 0 ? "You're caught up" : 'missed guests to follow up with'}
        </p>
        <p className="text-xs text-muted-foreground">
          Reach out within 21 days or they transfer to the SA team.
        </p>
      </div>

      <Button variant="ghost" size="sm" className="h-9" onClick={fetchItems} disabled={loading}>
        <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </Button>

      {items.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground text-center py-8">No missed guests assigned to you</p>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <CoachFollowUpCard key={item.id} item={item} todayStr={todayStr} onRefresh={fetchItems} userName={coachName} />
        ))}
      </div>
    </div>
  );
}

function CoachFollowUpCard({ item, todayStr, onRefresh, userName }: {
  item: CoachFollowUpItem;
  todayStr: string;
  onRefresh: () => void;
  userName: string;
}) {
  const [notInterestedOpen, setNotInterestedOpen] = useState(false);
  const [loggingDone, setLoggingDone] = useState(false);

  const daysSinceIntro = differenceInDays(new Date(), new Date(item.classDate + 'T12:00:00'));
  const daysSinceCreated = differenceInDays(new Date(), new Date(item.createdAt));
  const daysRemaining = Math.max(0, 21 - daysSinceCreated);

  const introDateLabel = (() => {
    try { return format(new Date(item.classDate + 'T12:00:00'), 'MMM d'); }
    catch { return item.classDate; }
  })();

  const lastContactText = !item.lastContactAt
    ? 'Never contacted'
    : `Last contact ${differenceInDays(new Date(), new Date(item.lastContactAt))} days ago`;

  const handleSendText = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('myday:open-script', {
      detail: { bookingId: item.bookingId, category: 'follow_up' },
    }));
  };

  const handleBook2nd = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('followup:book-second-intro', {
      detail: { bookingId: item.bookingId, memberName: item.memberName },
    }));
  };

  const handleNotInterested = async () => {
    await supabase.from('follow_up_queue').update({
      not_interested_at: new Date().toISOString(),
      not_interested_by: userName,
      closed_reason: 'not_interested',
    } as any).eq('id', item.id);
    toast.success('Marked as not interested');
    setNotInterestedOpen(false);
    onRefresh();
  };

  const handleLogDone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoggingDone(true);
    try {
      await supabase.from('followup_touches').insert({
        booking_id: item.bookingId,
        touch_type: 'follow_up',
        created_by: userName,
      });

      let daysUntilNext = 2;
      const tc = item.touchNumber;
      if (tc >= 4) daysUntilNext = 7;
      else if (tc >= 3) daysUntilNext = 5;
      else if (tc >= 2) daysUntilNext = 3;

      const nextDate = format(new Date(Date.now() + daysUntilNext * 86400000), 'yyyy-MM-dd');
      await supabase.from('follow_up_queue').update({
        touch_number: tc + 1,
        scheduled_date: nextDate,
      }).eq('id', item.id);

      toast.success('Logged — next contact set');
      onRefresh();
    } catch {
      toast.error('Failed to log');
    } finally {
      setLoggingDone(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border bg-card p-3 space-y-1.5">
        {/* Line 1: Name + Missed Guest badge */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold">{item.memberName}</span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-foreground text-background">
            Missed Guest
          </span>
        </div>

        {/* Line 2: Date · SA */}
        <p className="text-xs text-muted-foreground">
          {introDateLabel}
          {item.saName && ` · SA: ${item.saName}`}
          {item.phone && ` · ${item.phone}`}
        </p>

        {/* Line 3: Days since intro */}
        <p className={`text-xs font-medium ${daysSinceIntro >= 14 ? 'text-[#E8540A]' : 'text-muted-foreground'}`}>
          {daysSinceIntro} days ago
        </p>

        {/* Line 4: Days remaining */}
        {daysRemaining <= 7 && (
          <p className="text-xs font-medium text-destructive">
            {daysRemaining} days left before transfer
          </p>
        )}

        {/* Line 5: Last contact */}
        <p className="text-xs text-muted-foreground">{lastContactText}</p>

        {/* Contact next editor */}
        <ContactNextEditor
          bookingId={item.bookingId}
          contactNextDate={item.scheduledDate}
          rescheduleContactDate={null}
          onSaved={onRefresh}
        />

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <Button
            size="sm"
            className="min-h-[44px] bg-[#E8540A] hover:bg-[#D14A09] text-white flex-1 cursor-pointer"
            onClick={handleSendText}
          >
            Send Text
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-h-[44px] flex-1 cursor-pointer"
            onClick={handleBook2nd}
          >
            Book 2nd Intro
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="min-h-[44px] text-destructive cursor-pointer"
            onClick={() => setNotInterestedOpen(true)}
          >
            Not Interested
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="min-h-[44px] text-muted-foreground cursor-pointer"
            onClick={handleLogDone}
            disabled={loggingDone}
          >
            {loggingDone ? 'Logging...' : 'Log as Done'}
          </Button>
        </div>
      </div>

      {/* Not Interested confirmation */}
      <AlertDialog open={notInterestedOpen} onOpenChange={setNotInterestedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {item.memberName} as not interested?</AlertDialogTitle>
            <AlertDialogDescription>
              This closes their follow-up permanently. They won't appear in anyone's queue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleNotInterested} className="min-h-[44px] bg-destructive hover:bg-destructive/90">
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
