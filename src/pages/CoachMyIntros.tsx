/**
 * My Intros — Coach follow-up page.
 * Shows every intro a coach has ever run with follow-up status.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { format, differenceInHours, differenceInDays, addDays, parseISO } from 'date-fns';
import { ChevronDown, Phone, Copy, Check, MessageSquare, CalendarPlus, CheckCircle2, X } from 'lucide-react';
import { ScriptSendDrawer } from '@/components/scripts/ScriptSendDrawer';
import { ContactNextEditor } from '@/components/shared/ContactNextEditor';
import { toast } from 'sonner';
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

// ── Types ──

interface FollowUpRow {
  id: string;
  booking_id: string | null;
  person_name: string;
  touch_number: number;
  scheduled_date: string;
  status: string;
  not_interested_at: string | null;
  transferred_to_sa_at: string | null;
  coach_owner: string | null;
  fitness_goal: string | null;
  primary_objection: string | null;
  closed_reason: string | null;
}

interface BookingRow {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  class_start_at: string | null;
  coach_name: string;
  phone: string | null;
  phone_e164: string | null;
  email: string | null;
  lead_source: string;
  originating_booking_id: string | null;
  sa_conversation_5_of_5: string | null;
  sa_conversation_meaning: string | null;
  sa_conversation_obstacle: string | null;
  booking_status_canon: string;
  reschedule_contact_date: string | null;
  linked_ig_lead_id: string | null;
  deleted_at: string | null;
}

interface RunRow {
  id: string;
  linked_intro_booked_id: string | null;
  result_canon: string;
  coach_name: string | null;
  member_name: string;
  run_date: string | null;
}

interface QuestionnaireRow {
  booking_id: string;
  q1_fitness_goal: string | null;
  q2_fitness_level: number | null;
  q5_emotional_driver: string | null;
}

interface TouchRow {
  booking_id: string | null;
  created_at: string;
  touch_type: string;
  channel: string | null;
}

// ── Merged intro type ──
interface MergedIntro {
  bookingId: string;
  memberName: string;
  classDate: string;
  introTime: string | null;
  classStartAt: string | null;
  phone: string | null;
  resultCanon: string; // SALE, DIDNT_BUY, NO_SHOW, MISSED_GUEST, UNRESOLVED
  isSecondIntro: boolean;
  followUpRow: FollowUpRow | null;
  questionnaire: QuestionnaireRow | null;
  saConversation: { fiveOfFive: string | null; meaning: string | null; obstacle: string | null } | null;
  lastTouch: { daysAgo: number; channel: string | null } | null;
  rescheduleContactDate: string | null;
  linkedIgLeadId: string | null;
  transferred: boolean;
  touchNumber: number;
  priorityTier: number; // 1=within48h, 2=overdue, 3=dueToday, 4=thisWeek, 5=caughtUp
  priorityLabel: string;
  statusBadge: { label: string; color: string };
}

// ── Priority calculation ──
function computePriority(
  classStartAt: string | null,
  classDate: string,
  rescheduleContactDate: string | null,
  resultCanon: string,
  transferred: boolean,
  notInterestedAt: string | null,
): { tier: number; label: string } {
  if (resultCanon === 'SALE' || transferred || notInterestedAt) return { tier: 5, label: 'Caught up' };

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  // Check 48-hour window from class_start_at
  if (classStartAt) {
    const classTime = new Date(classStartAt);
    const hoursSince = differenceInHours(now, classTime);
    if (hoursSince >= 0 && hoursSince <= 48 && resultCanon !== 'SALE') {
      return { tier: 1, label: 'Within 48 hrs' };
    }
  }

  // Check contact_next date
  if (rescheduleContactDate) {
    if (rescheduleContactDate < todayStr) return { tier: 2, label: 'Overdue' };
    if (rescheduleContactDate === todayStr) return { tier: 3, label: 'Due today' };
    // Within 7 days
    const diff = differenceInDays(parseISO(rescheduleContactDate), now);
    if (diff <= 7) return { tier: 4, label: 'This week' };
    return { tier: 5, label: 'Caught up' };
  }

  // No contact date set — check if class was recent
  if (classStartAt) {
    const hoursSince = differenceInHours(now, new Date(classStartAt));
    if (hoursSince > 48 && resultCanon !== 'SALE') return { tier: 2, label: 'Overdue' };
  }

  return { tier: 5, label: 'Caught up' };
}

function getStatusBadge(resultCanon: string, transferred: boolean): { label: string; color: string } {
  if (transferred) return { label: 'Transferred to SA', color: 'bg-muted text-muted-foreground' };
  switch (resultCanon) {
    case 'SALE': return { label: 'Joined', color: 'bg-green-600 text-white' };
    case 'DIDNT_BUY': return { label: 'Follow-Up', color: 'bg-[#E8540A] text-white' };
    case 'NO_SHOW': return { label: 'No-Show', color: 'bg-destructive text-destructive-foreground' };
    case 'MISSED_GUEST': return { label: 'Missed Guest', color: 'bg-amber-500 text-white' };
    case 'SECOND_INTRO': return { label: '2nd Intro Planned', color: 'bg-teal-600 text-white' };
    case 'PLANNING_TO_BUY': return { label: 'Planning to Buy', color: 'bg-teal-500 text-white' };
    default: return { label: 'Unresolved', color: 'bg-muted text-muted-foreground' };
  }
}

// Filter types
type FilterType = 'all' | 'needs_followup' | 'second_intro' | 'missed_guest' | 'joined' | 'no_show';
const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'needs_followup', label: 'Needs Follow-Up' },
  { key: 'second_intro', label: '2nd Intro' },
  { key: 'missed_guest', label: 'Missed Guest' },
  { key: 'joined', label: 'Joined' },
  { key: 'no_show', label: 'No-Show' },
];

export default function CoachMyIntros() {
  const { user } = useAuth();
  const coachName = user?.name || '';

  const [loading, setLoading] = useState(true);
  const [intros, setIntros] = useState<MergedIntro[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Script drawer
  const [scriptDrawer, setScriptDrawer] = useState<{ open: boolean; bookingId: string | null; leadId: string | null; name: string | null; phone: string | null }>({ open: false, bookingId: null, leadId: null, name: null, phone: null });

  // Not interested dialog
  const [notInterestedTarget, setNotInterestedTarget] = useState<MergedIntro | null>(null);

  // Phone copy state
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Log as done loading
  const [loggingDone, setLoggingDone] = useState<string | null>(null);

  const priorityRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!coachName) return;
    setLoading(true);

    // Fetch all data in parallel
    const [fuRes, bookRes, runRes, qRes, touchRes] = await Promise.all([
      supabase
        .from('follow_up_queue')
        .select('id, booking_id, person_name, touch_number, scheduled_date, status, not_interested_at, transferred_to_sa_at, coach_owner, fitness_goal, primary_objection, closed_reason')
        .eq('coach_owner', coachName)
        .eq('owner_role', 'Coach')
        .is('not_interested_at', null)
        .is('transferred_to_sa_at', null),
      supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_time, class_start_at, coach_name, phone, phone_e164, email, lead_source, originating_booking_id, sa_conversation_5_of_5, sa_conversation_meaning, sa_conversation_obstacle, booking_status_canon, reschedule_contact_date, linked_ig_lead_id, deleted_at')
        .eq('coach_name', coachName)
        .is('deleted_at', null)
        .order('class_date', { ascending: false })
        .limit(500),
      supabase
        .from('intros_run')
        .select('id, linked_intro_booked_id, result_canon, coach_name, member_name, run_date')
        .eq('coach_name', coachName)
        .limit(500),
      supabase
        .from('intro_questionnaires')
        .select('booking_id, q1_fitness_goal, q2_fitness_level, q5_emotional_driver')
        .limit(1000),
      supabase
        .from('followup_touches')
        .select('booking_id, created_at, touch_type, channel')
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

    const followUps = (fuRes.data || []) as FollowUpRow[];
    const bookings = (bookRes.data || []) as BookingRow[];
    const runs = (runRes.data || []) as RunRow[];
    const questionnaires = (qRes.data || []) as QuestionnaireRow[];
    const touches = (touchRes.data || []) as TouchRow[];

    // Build lookup maps
    const fuByBooking = new Map<string, FollowUpRow>();
    followUps.forEach(fu => { if (fu.booking_id) fuByBooking.set(fu.booking_id, fu); });

    const runByBooking = new Map<string, RunRow>();
    runs.forEach(r => { if (r.linked_intro_booked_id) runByBooking.set(r.linked_intro_booked_id, r); });

    const qByBooking = new Map<string, QuestionnaireRow>();
    questionnaires.forEach(q => { if (q.booking_id) qByBooking.set(q.booking_id, q); });

    const touchByBooking = new Map<string, TouchRow>();
    touches.forEach(t => {
      if (t.booking_id && !touchByBooking.has(t.booking_id)) {
        touchByBooking.set(t.booking_id, t);
      }
    });

    // Also fetch transferred/not-interested for display
    const [fuAllRes] = await Promise.all([
      supabase
        .from('follow_up_queue')
        .select('id, booking_id, person_name, touch_number, scheduled_date, status, not_interested_at, transferred_to_sa_at, coach_owner')
        .eq('coach_owner', coachName)
        .eq('owner_role', 'Coach'),
    ]);
    const allFollowUps = (fuAllRes.data || []) as FollowUpRow[];
    const allFuByBooking = new Map<string, FollowUpRow>();
    allFollowUps.forEach(fu => { if (fu.booking_id) allFuByBooking.set(fu.booking_id, fu); });

    // Total Journey: build set of every booking id linked to any of the coach's
    // bookings via originating_booking_id (this booking, its 2nd intro, or its
    // originating 1st intro). Then look up sales across that whole chain so a
    // member who bought on a later visit drops off this active queue.
    const myBookingIds = bookings.map(b => b.id);
    const originatingIds = bookings.map(b => (b as any).originating_booking_id).filter(Boolean) as string[];
    const chainBookingIds = new Set<string>([...myBookingIds, ...originatingIds]);
    if (myBookingIds.length > 0) {
      const { data: rebooks } = await supabase
        .from('intros_booked')
        .select('id, originating_booking_id')
        .in('originating_booking_id', myBookingIds);
      (rebooks || []).forEach((r: any) => {
        if (r.id) chainBookingIds.add(r.id);
        if (r.originating_booking_id) chainBookingIds.add(r.originating_booking_id);
      });
    }
    // Map: any booking in chainBookingIds with a SALE run
    const soldBookingIds = new Set<string>();
    if (chainBookingIds.size > 0) {
      const { data: chainRuns } = await supabase
        .from('intros_run')
        .select('linked_intro_booked_id, result, result_canon')
        .in('linked_intro_booked_id', Array.from(chainBookingIds));
      (chainRuns || []).forEach((r: any) => {
        if (!r.linked_intro_booked_id) return;
        if (r.result_canon === 'SALE') soldBookingIds.add(r.linked_intro_booked_id);
      });
    }
    // Map booking id → true if any booking in its chain has a sale
    const chainSaleByBooking = new Map<string, boolean>();
    bookings.forEach(b => {
      const ids = new Set<string>([b.id]);
      const orig = (b as any).originating_booking_id;
      if (orig) ids.add(orig);
      // Sibling bookings: anything originating from this booking, or from same originator
      // Already covered by the rebooks fetch above (added to chainBookingIds), but we
      // need per-booking chain membership. Cheap approach: a sale anywhere in the
      // global chainBookingIds for this member's chain. Build by walking originating links.
      // For simplicity: include all chainBookingIds that share originating_booking_id with b.
      bookings.forEach(other => {
        const otherOrig = (other as any).originating_booking_id;
        if (other.id === b.id) return;
        if (orig && (other.id === orig || otherOrig === orig)) ids.add(other.id);
        if (otherOrig === b.id) ids.add(other.id);
      });
      let sold = false;
      ids.forEach(id => { if (soldBookingIds.has(id)) sold = true; });
      chainSaleByBooking.set(b.id, sold);
    });

    // Merge: bookings as primary, enriched with run + followup data
    const merged: MergedIntro[] = bookings.map(b => {
      const run = runByBooking.get(b.id);
      const fu = fuByBooking.get(b.id) || null;
      const allFu = allFuByBooking.get(b.id);
      const q = qByBooking.get(b.id) || null;
      const lastTouchRow = touchByBooking.get(b.id);
      const transferred = !!(allFu?.transferred_to_sa_at);
      const notInterested = allFu?.not_interested_at || null;

      const baseResultCanon = run?.result_canon || 'UNRESOLVED';
      // Total Journey override: if any booking in this person's chain has a sale,
      // treat this intro as Joined and route it to "Caught up".
      const resultCanon = chainSaleByBooking.get(b.id) ? 'SALE' : baseResultCanon;
      const isSecondIntro = !!b.originating_booking_id;

      const lastTouch = lastTouchRow
        ? { daysAgo: differenceInDays(new Date(), new Date(lastTouchRow.created_at)), channel: lastTouchRow.channel || lastTouchRow.touch_type }
        : null;

      const saConv = (b.sa_conversation_5_of_5 || b.sa_conversation_meaning || b.sa_conversation_obstacle)
        ? { fiveOfFive: b.sa_conversation_5_of_5, meaning: b.sa_conversation_meaning, obstacle: b.sa_conversation_obstacle }
        : null;

      const priority = computePriority(
        b.class_start_at,
        b.class_date,
        b.reschedule_contact_date,
        resultCanon,
        transferred,
        notInterested,
      );

      return {
        bookingId: b.id,
        memberName: b.member_name,
        classDate: b.class_date,
        introTime: b.intro_time,
        classStartAt: b.class_start_at,
        phone: b.phone_e164 || b.phone,
        resultCanon,
        isSecondIntro,
        followUpRow: fu,
        questionnaire: q,
        saConversation: saConv,
        lastTouch,
        rescheduleContactDate: b.reschedule_contact_date,
        linkedIgLeadId: b.linked_ig_lead_id,
        transferred,
        touchNumber: fu?.touch_number || allFu?.touch_number || 1,
        priorityTier: priority.tier,
        priorityLabel: priority.label,
        statusBadge: getStatusBadge(
          transferred ? 'TRANSFERRED' : resultCanon,
          transferred,
        ),
      };
    });

    // Sort: priority tier asc, then newest class date first
    merged.sort((a, b) => {
      if (a.priorityTier !== b.priorityTier) return a.priorityTier - b.priorityTier;
      return b.classDate.localeCompare(a.classDate);
    });

    setIntros(merged);
    setLoading(false);
  }, [coachName]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtered list
  const filtered = useMemo(() => {
    if (activeFilter === 'all') return intros;
    return intros.filter(i => {
      switch (activeFilter) {
        case 'needs_followup': return ['DIDNT_BUY', 'UNRESOLVED'].includes(i.resultCanon) && !i.transferred;
        case 'second_intro': return i.isSecondIntro || i.resultCanon === 'SECOND_INTRO';
        case 'missed_guest': return i.resultCanon === 'MISSED_GUEST';
        case 'joined': return i.resultCanon === 'SALE';
        case 'no_show': return i.resultCanon === 'NO_SHOW';
        default: return true;
      }
    });
  }, [intros, activeFilter]);

  // Urgent count
  const urgentCount = useMemo(() => intros.filter(i => i.priorityTier === 1).length, [intros]);
  const hasFollowUpsDue = useMemo(() => intros.some(i => i.priorityTier <= 3), [intros]);

  // ── Actions ──

  const handleLogDone = async (intro: MergedIntro) => {
    setLoggingDone(intro.bookingId);
    try {
      // Write touch
      await supabase.from('followup_touches').insert({
        created_by: coachName,
        touch_type: 'mark_done',
        booking_id: intro.bookingId,
        channel: 'coach_my_intros',
        notes: `Touch #${intro.touchNumber} completed`,
      } as any);

      // Calculate next contact date
      const intervals = [2, 3, 5, 7];
      const days = intervals[Math.min(intro.touchNumber - 1, 3)];
      const nextDate = format(addDays(new Date(), days), 'yyyy-MM-dd');

      // Update follow_up_queue if exists
      if (intro.followUpRow) {
        await supabase.from('follow_up_queue').update({
          touch_number: intro.touchNumber + 1,
          scheduled_date: nextDate,
        }).eq('id', intro.followUpRow.id);
      }

      // Update reschedule_contact_date on booking
      await supabase.from('intros_booked').update({
        reschedule_contact_date: nextDate,
        last_edited_at: new Date().toISOString(),
      } as any).eq('id', intro.bookingId);

      toast.success(`Logged! Next contact: ${format(addDays(new Date(), days), 'MMM d')}`);
      fetchData();
    } catch (err) {
      toast.error('Failed to log');
    }
    setLoggingDone(null);
  };

  const handleNotInterested = async () => {
    if (!notInterestedTarget) return;
    const fu = notInterestedTarget.followUpRow;
    if (fu) {
      await supabase.from('follow_up_queue').update({
        not_interested_at: new Date().toISOString(),
        not_interested_by: coachName,
      }).eq('id', fu.id);
    }
    toast.success(`${notInterestedTarget.memberName} marked as not interested`);
    setNotInterestedTarget(null);
    fetchData();
  };

  const handleCopyPhone = async (phone: string, bookingId: string) => {
    await navigator.clipboard.writeText(phone);
    setCopiedPhone(bookingId);
    toast.success('Phone copied!');
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const scrollToFirstUrgent = () => {
    priorityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading your intros...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold">My Intros</h1>
        <p className="text-xs text-muted-foreground">Everyone you've coached. Stay connected within 48 hours.</p>
      </div>

      {/* Priority alert bar */}
      {urgentCount > 0 && (
        <button
          onClick={scrollToFirstUrgent}
          className="w-full rounded-lg bg-amber-500 text-white px-4 py-3 text-sm font-semibold text-center cursor-pointer min-h-[44px]"
        >
          {urgentCount} intro{urgentCount !== 1 ? 's' : ''} need a touch within 48 hours
        </button>
      )}

      {/* Caught up banner */}
      {!hasFollowUpsDue && intros.length > 0 && (
        <div className="w-full rounded-lg bg-green-600 text-white px-4 py-3 text-sm font-semibold text-center">
          ✓ You're caught up. No follow-ups due.
        </div>
      )}

      {/* Filter pills */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 cursor-pointer min-h-[36px]',
                activeFilter === f.key
                  ? 'bg-[#E8540A] text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground border border-border'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Card list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-8 italic">No intros match this filter.</p>
        ) : (
          filtered.map((intro, idx) => {
            const isExpanded = expandedId === intro.bookingId;
            const daysSince = differenceInDays(new Date(), parseISO(intro.classDate));
            const isFirstUrgent = idx === 0 && intro.priorityTier === 1;
            const isSale = intro.resultCanon === 'SALE';
            const showBookSecond = !isSale && ['MISSED_GUEST', 'NO_SHOW', 'DIDNT_BUY', 'UNRESOLVED'].includes(intro.resultCanon);
            const phoneDisplay = intro.phone;

            return (
              <div
                key={intro.bookingId}
                ref={isFirstUrgent ? priorityRef : undefined}
                className="rounded-lg border border-border bg-card overflow-hidden"
              >
                {/* Collapsed header */}
                <button
                  type="button"
                  onClick={() => setExpandedId(prev => prev === intro.bookingId ? null : intro.bookingId)}
                  className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 min-h-[44px] cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm">{intro.memberName}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', intro.statusBadge.color)}>
                        {intro.statusBadge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      <span>{daysSince === 0 ? 'Today' : `${daysSince}d ago`}</span>
                      <span>·</span>
                      <span>{format(parseISO(intro.classDate), 'MMM d')}</span>
                      <span>·</span>
                      <span className={cn(
                        'font-medium',
                        intro.priorityTier === 1 ? 'text-destructive' :
                        intro.priorityTier === 2 ? 'text-destructive' :
                        intro.priorityTier === 3 ? 'text-amber-600' :
                        intro.priorityTier === 4 ? 'text-muted-foreground' :
                        'text-green-600'
                      )}>
                        {intro.priorityLabel}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={cn('w-5 h-5 text-muted-foreground transition-transform shrink-0', isExpanded && 'rotate-180')} />
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                    {/* Section 1: Member Context */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="font-medium">{intro.memberName}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{format(parseISO(intro.classDate), 'MMM d, yyyy')}</span>
                        {intro.introTime && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">{intro.introTime.substring(0, 5)}</span>
                          </>
                        )}
                      </div>

                      {/* Phone */}
                      {phoneDisplay && (
                        <div className="flex items-center gap-2">
                          <a href={`tel:${phoneDisplay}`} className="text-sm text-primary underline flex items-center gap-1 cursor-pointer min-h-[44px]">
                            <Phone className="w-3.5 h-3.5" />
                            {phoneDisplay}
                          </a>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); handleCopyPhone(phoneDisplay, intro.bookingId); }}
                          >
                            {copiedPhone === intro.bookingId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copiedPhone === intro.bookingId ? 'Copied!' : 'Copy'}
                          </Button>
                        </div>
                      )}

                      {/* Questionnaire */}
                      {intro.questionnaire ? (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {intro.questionnaire.q2_fitness_level != null && (
                            <span>Fitness: <strong>{intro.questionnaire.q2_fitness_level}/5</strong></span>
                          )}
                          {intro.questionnaire.q1_fitness_goal && (
                            <span>Looking for: <strong>{intro.questionnaire.q1_fitness_goal.slice(0, 40)}{intro.questionnaire.q1_fitness_goal.length > 40 ? '...' : ''}</strong></span>
                          )}
                          {intro.questionnaire.q5_emotional_driver && (
                            <span>Why: <strong>{intro.questionnaire.q5_emotional_driver.slice(0, 40)}{intro.questionnaire.q5_emotional_driver.length > 40 ? '...' : ''}</strong></span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No questionnaire on file</p>
                      )}

                      {/* SA Conversation */}
                      {intro.saConversation && (
                        <div className="space-y-0.5 text-xs">
                          {intro.saConversation.fiveOfFive && (
                            <p className="text-muted-foreground">What a 5/5 looks like: <strong>{intro.saConversation.fiveOfFive}</strong></p>
                          )}
                          {intro.saConversation.meaning && (
                            <p className="text-[#E8540A]">What would change: <strong>{intro.saConversation.meaning}</strong></p>
                          )}
                          {intro.saConversation.obstacle && (
                            <p className="text-muted-foreground">What's holding them back: <strong>{intro.saConversation.obstacle}</strong></p>
                          )}
                        </div>
                      )}

                      {/* Outcome */}
                      <p className="text-xs text-muted-foreground">
                        Outcome: <strong>{intro.resultCanon === 'SALE' ? 'Joined' : intro.resultCanon.replace(/_/g, ' ')}</strong>
                      </p>

                      {/* Last contact */}
                      <p className="text-xs text-muted-foreground">
                        {intro.lastTouch
                          ? `Last contact ${intro.lastTouch.daysAgo === 0 ? 'today' : `${intro.lastTouch.daysAgo}d ago`} via ${intro.lastTouch.channel}`
                          : 'Never contacted'}
                      </p>

                      {/* Contact next editor */}
                      <ContactNextEditor
                        bookingId={intro.bookingId}
                        contactNextDate={intro.rescheduleContactDate}
                        rescheduleContactDate={intro.rescheduleContactDate}
                        onSaved={fetchData}
                      />
                    </div>

                    {/* Section 2: Actions */}
                    {!intro.transferred && intro.resultCanon !== 'SALE' && (
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 min-h-[44px] text-[13px] font-medium gap-1.5 cursor-pointer bg-[#E8540A] hover:bg-[#E8540A]/90 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setScriptDrawer({
                              open: true,
                              bookingId: intro.bookingId,
                              leadId: intro.linkedIgLeadId,
                              name: intro.memberName,
                              phone: intro.phone,
                            });
                          }}
                        >
                          <MessageSquare className="w-4 h-4" />
                          Send Text
                        </Button>

                        {showBookSecond && (
                          <Button
                            variant="outline"
                            className="flex-1 min-h-[44px] text-[13px] font-medium gap-1.5 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Navigate to booking flow or emit event
                              toast.info('Use the Pipeline to book a 2nd intro for ' + intro.memberName);
                            }}
                          >
                            <CalendarPlus className="w-4 h-4" />
                            Book 2nd Intro
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          className="min-h-[44px] text-[13px] font-medium gap-1.5 cursor-pointer text-muted-foreground"
                          disabled={loggingDone === intro.bookingId}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLogDone(intro);
                          }}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {loggingDone === intro.bookingId ? 'Saving...' : 'Log as Done'}
                        </Button>
                      </div>
                    )}

                    {intro.resultCanon === 'SALE' && (
                      <p className="text-xs text-green-600 font-medium">✓ This member joined — no follow-up needed.</p>
                    )}

                    {intro.transferred && (
                      <p className="text-xs text-muted-foreground italic">Transferred to SA — no coach actions.</p>
                    )}

                    {/* Not interested button */}
                    {!intro.transferred && intro.resultCanon !== 'SALE' && (
                      <button
                        className="text-xs text-destructive hover:underline cursor-pointer min-h-[44px] flex items-center gap-1"
                        onClick={(e) => { e.stopPropagation(); setNotInterestedTarget(intro); }}
                      >
                        <X className="w-3 h-3" />
                        Mark as not interested
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Script Send Drawer */}
      <ScriptSendDrawer
        open={scriptDrawer.open}
        onOpenChange={(open) => setScriptDrawer(prev => ({ ...prev, open }))}
        bookingId={scriptDrawer.bookingId}
        leadId={scriptDrawer.leadId}
        leadName={scriptDrawer.name}
        leadPhone={scriptDrawer.phone}
        categoryFilter={['follow-up', 'post-intro', 'no-show', 'missed-guest']}
        saName={coachName}
      />

      {/* Not interested confirmation */}
      <AlertDialog open={!!notInterestedTarget} onOpenChange={(open) => { if (!open) setNotInterestedTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as not interested?</AlertDialogTitle>
            <AlertDialogDescription>
              Mark {notInterestedTarget?.memberName} as not interested? This removes them from follow-up.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px] cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleNotInterested} className="min-h-[44px] cursor-pointer bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Yes, not interested
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
