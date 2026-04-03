/**
 * Priority-sorted unified follow-up list replacing the four-tab system.
 * Two sections: "Focus Today" (expanded) and "Coming Up" (collapsed).
 */
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, ChevronDown, ChevronRight, Phone, Pencil } from 'lucide-react';
import { useFollowUpData, type FollowUpItem, type FollowUpType } from './useFollowUpData';
import { ContactNextEditor } from '@/components/shared/ContactNextEditor';
import { format, differenceInDays, isToday, isBefore, startOfDay, endOfWeek } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

interface FollowUpListProps {
  onCountChange?: (count: number) => void;
  onRefresh?: () => void;
}

type FilterType = 'all' | FollowUpType | 'transferred';

const TYPE_LABELS: Record<FollowUpType, string> = {
  noshow: 'No-Show',
  missed: 'Missed Guest',
  secondintro: '2nd Intro',
  reschedule: 'Reschedule',
};

const TYPE_COLORS: Record<FollowUpType, string> = {
  noshow: 'bg-destructive/15 text-destructive',
  missed: 'bg-orange-500/15 text-orange-600',
  secondintro: 'bg-blue-500/15 text-blue-600',
  reschedule: 'bg-purple-500/15 text-purple-600',
};

function getPriority(item: FollowUpItem, todayStr: string): { score: number; label: string; color: string } {
  const contactNext = item.contactNextDate;
  if (contactNext && contactNext < todayStr) {
    return { score: 1, label: 'Overdue', color: 'bg-destructive text-destructive-foreground' };
  }
  if (contactNext && contactNext === todayStr) {
    return { score: 2, label: 'Due today', color: 'bg-[#E8540A] text-white' };
  }
  if (!item.lastContactAt) {
    return { score: 3, label: 'First touch', color: 'bg-amber-500/20 text-amber-700' };
  }
  const daysSinceContact = differenceInDays(new Date(), new Date(item.lastContactAt));
  if (daysSinceContact >= 7) {
    return { score: 4, label: 'Follow up', color: 'bg-muted text-muted-foreground' };
  }
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  if (contactNext && contactNext <= weekEnd) {
    return { score: 5, label: 'Follow up', color: 'bg-muted text-muted-foreground' };
  }
  return { score: 6, label: 'Follow up', color: 'bg-muted text-muted-foreground' };
}

function sortByPriority(items: FollowUpItem[], todayStr: string): FollowUpItem[] {
  return [...items].sort((a, b) => {
    const pa = getPriority(a, todayStr).score;
    const pb = getPriority(b, todayStr).score;
    if (pa !== pb) return pa - pb;
    return a.classDate.localeCompare(b.classDate);
  });
}

export default function FollowUpList({ onCountChange, onRefresh }: FollowUpListProps) {
  const { user } = useAuth();
  const { allItems, counts, isLoading, refresh } = useFollowUpData();
  const [filter, setFilter] = useState<FilterType>('all');
  const [focusOpen, setFocusOpen] = useState(true);
  const [comingUpOpen, setComingUpOpen] = useState(false);

  useEffect(() => {
    onCountChange?.(counts.total);
  }, [counts.total, onCountChange]);

  const handleRefresh = () => {
    refresh();
    onRefresh?.();
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const filtered = useMemo(() => {
    // SA only sees SA-owned items (transferred items have owner_role=SA after transfer)
    if (filter === 'all') return allItems;
    if (filter === 'transferred') return allItems.filter(i => !!(i as any).transferredFromCoach);
    return allItems.filter(i => i.followUpType === filter);
  }, [allItems, filter]);

  const { focusItems, comingUpItems, focusTotal } = useMemo(() => {
    const focus: FollowUpItem[] = [];
    const coming: FollowUpItem[] = [];
    for (const item of filtered) {
      const cn = item.contactNextDate;
      if (!cn || cn <= todayStr) {
        focus.push(item);
      } else {
        coming.push(item);
      }
    }
    return {
      focusItems: sortByPriority(focus, todayStr),
      comingUpItems: sortByPriority(coming, todayStr),
      focusTotal: focus.length,
    };
  }, [filtered, todayStr]);

  const displayFocus = focusItems.slice(0, 20);
  const focusCapped = focusItems.length > 20;

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'noshow', label: 'No-Show' },
    { key: 'missed', label: 'Missed' },
    { key: 'secondintro', label: '2nd Intro' },
    { key: 'reschedule', label: 'Reschedule' },
    { key: 'transferred', label: 'Transferred' },
  ];

  const focusCount = Math.min(focusTotal, 20);
  const isCaughtUp = focusCount === 0;

  return (
    <div className="space-y-3">
      {/* Header — large focal number */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className={`text-5xl font-medium ${isCaughtUp ? 'text-success' : 'text-[#E8540A]'}`}>
            {focusCount}
          </div>
          <p className="text-lg font-bold text-foreground">
            {isCaughtUp ? "You're caught up today" : 'people to reach today'}
          </p>
          <p className="text-xs text-muted-foreground">{counts.total} total in queue</p>
          <p className="text-xs text-muted-foreground">People who didn't buy yet. One touch per person, every day.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="sr-only">Refresh</span>
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium min-h-[32px] transition-colors cursor-pointer ${
              filter === f.key
                ? 'bg-[#E8540A] text-white'
                : 'bg-muted/60 text-muted-foreground border border-border hover:bg-accent'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Focus Today section */}
      <CollapsibleSection
        title="Focus Today"
        count={focusTotal}
        open={focusOpen}
        onToggle={() => setFocusOpen(o => !o)}
      >
        {displayFocus.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">All caught up — no one due today</p>
        ) : (
          <div className="space-y-2">
            {displayFocus.map(item => (
              <FollowUpCard key={item.bookingId} item={item} todayStr={todayStr} onRefresh={handleRefresh} userName={user?.name || ''} />
            ))}
            {focusCapped && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Showing 20 of {focusTotal} — complete some to see more
              </p>
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* Coming Up section */}
      <CollapsibleSection
        title="Coming Up"
        count={comingUpItems.length}
        open={comingUpOpen}
        onToggle={() => setComingUpOpen(o => !o)}
      >
        {comingUpItems.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nothing scheduled ahead</p>
        ) : (
          <div className="space-y-2">
            {comingUpItems.map(item => (
              <FollowUpCard key={item.bookingId} item={item} todayStr={todayStr} onRefresh={handleRefresh} userName={user?.name || ''} />
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}

/* ─── Collapsible Section ─── */
function CollapsibleSection({ title, count, open, onToggle, children }: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="text-sm font-semibold">{title}</span>
          <Badge variant="secondary" className="text-xs">{count}</Badge>
        </div>
      </button>
      {open && <div className="p-2">{children}</div>}
    </div>
  );
}

/* ─── Follow-Up Card ─── */
function FollowUpCard({ item, todayStr, onRefresh, userName }: {
  item: FollowUpItem;
  todayStr: string;
  onRefresh: () => void;
  userName: string;
}) {
  const [swiped, setSwiped] = useState(false);
  const [loggingDone, setLoggingDone] = useState(false);
  const touchStartX = useRef(0);
  const priority = getPriority(item, todayStr);

  const lastContactText = useMemo(() => {
    if (!item.lastContactAt) return 'Never contacted';
    const days = differenceInDays(new Date(), new Date(item.lastContactAt));
    const channel = item.lastContactSummary || '';
    if (days === 0) return `Last contact today${channel ? ` via ${channel}` : ''}`;
    return `Last contact ${days} day${days !== 1 ? 's' : ''} ago${channel ? ` via ${channel}` : ''}`;
  }, [item.lastContactAt, item.lastContactSummary]);

  const introDateFormatted = useMemo(() => {
    try {
      const [y, m, d] = item.classDate.split('-').map(Number);
      return format(new Date(y, m - 1, d), 'MMM d');
    } catch { return item.classDate; }
  }, [item.classDate]);

  const handleSendText = (e: React.MouseEvent) => {
    e.stopPropagation();
    const categoryMap: Record<FollowUpType, string> = {
      noshow: 'no_show',
      missed: 'follow_up',
      secondintro: 'feedback',
      reschedule: 'reschedule',
    };
    window.dispatchEvent(new CustomEvent('myday:open-script', {
      detail: { bookingId: item.bookingId, category: categoryMap[item.followUpType] },
    }));
  };

  const handleSecondaryAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.followUpType === 'secondintro') {
      window.dispatchEvent(new CustomEvent('myday:open-outcome', {
        detail: { bookingId: item.bookingId },
      }));
    } else {
      window.dispatchEvent(new CustomEvent('followup:book-second-intro', {
        detail: { bookingId: item.bookingId, memberName: item.memberName },
      }));
    }
  };

  const handleLogDone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoggingDone(true);
    try {
      // Log touch
      await supabase.from('script_actions').insert({
        booking_id: item.bookingId,
        action_type: 'script_sent',
        completed_by: userName,
        completed_at: new Date().toISOString(),
      } as any);

      // Calculate next contact date based on touch count
      const { count } = await supabase
        .from('script_actions')
        .select('id', { count: 'exact', head: true })
        .eq('booking_id', item.bookingId);
      
      const touchCount = (count || 0);
      let daysUntilNext = 2;
      if (touchCount >= 4) daysUntilNext = 7;
      else if (touchCount >= 3) daysUntilNext = 5;
      else if (touchCount >= 2) daysUntilNext = 3;

      const nextDate = format(new Date(Date.now() + daysUntilNext * 86400000), 'yyyy-MM-dd');
      await supabase.from('intros_booked').update({
        reschedule_contact_date: nextDate,
        last_edited_at: new Date().toISOString(),
      } as any).eq('id', item.bookingId);

      toast.success('Logged — next contact set');
      onRefresh();
    } catch (err) {
      toast.error('Failed to log');
    } finally {
      setLoggingDone(false);
    }
  };

  const handleDismiss = async () => {
    await supabase.from('intros_booked').update({
      followup_dismissed_at: new Date().toISOString(),
    } as any).eq('id', item.bookingId);
    toast.success('Dismissed');
    setSwiped(false);
    onRefresh();
  };

  const secondaryLabel = item.followUpType === 'secondintro' ? 'Mark Sold'
    : item.followUpType === 'reschedule' ? 'Book Now'
    : 'Book 2nd Intro';

  return (
    <div className="relative overflow-hidden rounded-lg border bg-card">
      {/* Dismiss layer behind */}
      {swiped && (
        <div className="absolute inset-0 bg-destructive flex items-center justify-end px-4 z-0">
          <button
            onClick={handleDismiss}
            className="text-destructive-foreground font-medium text-sm min-h-[44px] px-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Card content */}
      <div
        className={`relative bg-card p-3 space-y-1.5 transition-transform ${swiped ? '-translate-x-24' : ''}`}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const diff = touchStartX.current - e.changedTouches[0].clientX;
          if (diff > 60) setSwiped(true);
          else if (diff < -30) setSwiped(false);
        }}
      >
        {/* Line 1: Name + Priority + Type + Transferred badge */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold">{item.memberName}</span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priority.color}`}>
            {priority.label}
          </span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[item.followUpType]}`}>
            {TYPE_LABELS[item.followUpType]}
          </span>
          {(item as any).transferredFromCoach && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700">
              Transferred from Coach
            </span>
          )}
        </div>

        {/* Line 2: Date · Coach · Phone */}
        <p className="text-xs text-muted-foreground">
          {introDateFormatted}
          {item.coachName && ` · Coach: ${item.coachName}`}
          {item.phone && ` · ${item.phone}`}
        </p>

        {/* Line 3: Last contact */}
        <p className="text-xs text-muted-foreground">{lastContactText}</p>

        {/* Line 4: Contact next */}
        <ContactNextEditor
          bookingId={item.bookingId}
          contactNextDate={item.contactNextDate}
          rescheduleContactDate={item.rescheduleContactDate}
          onSaved={onRefresh}
        />

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
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
            onClick={handleSecondaryAction}
          >
            {secondaryLabel}
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
    </div>
  );
}