/**
 * Priority-sorted unified follow-up list with 5 explicit category filters.
 */
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, ChevronDown, ChevronRight, Phone, Copy, ClipboardList } from 'lucide-react';
import { stripCountryCode, formatPhoneDisplay } from '@/lib/parsing/phone';
import { useFollowUpData, type FollowUpItem, type FollowUpType } from './useFollowUpData';
import { ContactNextEditor } from '@/components/shared/ContactNextEditor';
import { format, differenceInDays, endOfWeek } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

interface FollowUpListProps {
  onCountChange?: (count: number) => void;
  onRefresh?: () => void;
}

type FilterType = 'all' | FollowUpType | 'transferred';

const TYPE_LABELS: Record<FollowUpType, string> = {
  noshow_1st: 'No Show (1st Intro)',
  noshow_2nd: 'No Show (2nd Intro)',
  reschedule: 'Planning to Reschedule',
  didnt_buy_1st: "Didn't Buy (1st Intro - Try to Reschedule 2nd)",
  didnt_buy_2nd: "Didn't Buy (2nd Intro - Final Reach Out)",
};

const TYPE_SHORT_LABELS: Record<FollowUpType, string> = {
  noshow_1st: 'NS 1st',
  noshow_2nd: 'NS 2nd',
  reschedule: 'Reschedule',
  didnt_buy_1st: "DB 1st",
  didnt_buy_2nd: "DB 2nd",
};

const TYPE_COLORS: Record<FollowUpType, string> = {
  noshow_1st: 'bg-destructive/15 text-destructive',
  noshow_2nd: 'bg-red-700/15 text-red-700',
  reschedule: 'bg-purple-500/15 text-purple-600',
  didnt_buy_1st: 'bg-orange-500/15 text-orange-600',
  didnt_buy_2nd: 'bg-amber-600/15 text-amber-700',
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
    return b.classDate.localeCompare(a.classDate);
  });
}

export default function FollowUpList({ onCountChange, onRefresh }: FollowUpListProps) {
  const { user } = useAuth();
  const { allItems, counts, isLoading, refresh, silentRefresh } = useFollowUpData();
  const [filter, setFilter] = useState<FilterType>('all');
  const [focusOpen, setFocusOpen] = useState(true);
  const [comingUpOpen, setComingUpOpen] = useState(false);

  useEffect(() => {
    onCountChange?.(counts.total);
  }, [counts.total, onCountChange]);

  const handleRefresh = () => {
    silentRefresh();
    onRefresh?.();
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const filtered = useMemo(() => {
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
    { key: 'noshow_1st', label: 'No Show (1st Intro)' },
    { key: 'noshow_2nd', label: 'No Show (2nd Intro)' },
    { key: 'reschedule', label: 'Planning to Reschedule' },
    { key: 'didnt_buy_1st', label: "Didn't Buy (1st)" },
    { key: 'didnt_buy_2nd', label: "Didn't Buy (2nd)" },
    { key: 'transferred', label: 'Transferred' },
  ];

  const focusCount = Math.min(focusTotal, 20);
  const isCaughtUp = focusCount === 0;

  return (
    <div className="space-y-3">
      {/* Header */}
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

      {/* Focus Today */}
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

      {/* Coming Up */}
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
      noshow_1st: 'no_show',
      noshow_2nd: 'no_show',
      reschedule: 'reschedule',
      didnt_buy_1st: 'follow_up',
      didnt_buy_2nd: 'follow_up',
    };
    window.dispatchEvent(new CustomEvent('myday:open-script', {
      detail: { bookingId: item.bookingId, category: categoryMap[item.followUpType], fromFollowUp: true },
    }));
  };

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    const clean = stripCountryCode(item.phone);
    if (clean) {
      navigator.clipboard.writeText(clean);
      toast.success('Phone copied');
    } else {
      toast.error('No valid phone on file');
    }
  };

  const handleLogOutcome = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('myday:open-outcome', {
      detail: { bookingId: item.bookingId },
    }));
  };

  const handleDismiss = async () => {
    await supabase.from('follow_up_queue').update({
      not_interested_at: new Date().toISOString(),
      not_interested_by: userName,
      closed_reason: 'not_interested',
    } as any).eq('booking_id', item.bookingId);
    await supabase.from('intros_booked').update({
      followup_dismissed_at: new Date().toISOString(),
    } as any).eq('id', item.bookingId);
    toast.success('Marked as not interested');
    setSwiped(false);
    onRefresh();
  };

  return (
    <div className="relative overflow-hidden rounded-lg border bg-card">
      {swiped && (
        <div className="absolute inset-0 bg-destructive flex items-center justify-end px-4 z-0">
          <button
            onClick={handleDismiss}
            className="text-destructive-foreground font-medium text-sm min-h-[44px] px-4 cursor-pointer"
          >
            Not Interested
          </button>
        </div>
      )}

      <div
        className={`relative bg-card p-3 space-y-1.5 transition-transform ${swiped ? '-translate-x-24' : ''}`}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const diff = touchStartX.current - e.changedTouches[0].clientX;
          if (diff > 60) setSwiped(true);
          else if (diff < -30) setSwiped(false);
        }}
      >
        {/* Line 1: Name + Priority + Type */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold">{item.memberName}</span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priority.color}`}>
            {priority.label}
          </span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[item.followUpType]}`}>
            {TYPE_SHORT_LABELS[item.followUpType]}
          </span>
          {(item as any).transferredFromCoach && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700">
              Transferred from Coach
            </span>
          )}
        </div>

        {/* Line 2: Date · Coach · Phone */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
          <span>{introDateFormatted}</span>
          {item.coachName && <><span>·</span><span>Coach: {item.coachName}</span></>}
          {item.phone && (
            <>
              <span>·</span>
              <a href={`tel:${stripCountryCode(item.phone) || item.phone}`} className="text-primary hover:underline inline-flex items-center gap-0.5">
                <Phone className="w-3 h-3" />
                {formatPhoneDisplay(item.phone) || item.phone}
              </a>
              <Button
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0 cursor-pointer"
                title="Copy Phone"
                onClick={handleCopyPhone}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>

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
            <Phone className="w-3.5 h-3.5 mr-1" />
            Send Text
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-h-[44px] p-0 w-11 cursor-pointer"
            title="Copy Phone"
            onClick={handleCopyPhone}
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-h-[44px] flex-1 cursor-pointer"
            onClick={handleLogOutcome}
          >
            <ClipboardList className="w-3.5 h-3.5 mr-1" />
            Log Outcome
          </Button>
        </div>
      </div>
    </div>
  );
}
