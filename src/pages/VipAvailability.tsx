/**
 * Public VIP Availability page — /vip-availability
 * Monthly calendar showing available VIP session slots.
 * Groups can view and claim available slots via a modal form.
 * No auth required. OTF-branded.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
const sb = supabase as any;
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Loader2, CheckCircle, ChevronLeft, ChevronRight, ChevronDown, AlertCircle } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  addDays,
  isBefore,
  isSameMonth,
  isToday as isDateToday,
} from 'date-fns';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { getNowCentral, getTodayYMD } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

/* ── Types ─────────────────────────────────────────── */

interface PublicSession {
  id: string;
  session_date: string;
  session_time: string;
  status: string;
  reserved_by_group: string | null;
  description: string | null;
  session_type: string | null;
}

/* ── Claim Modal ───────────────────────────────────── */

function ClaimDialog({
  session,
  open,
  onOpenChange,
  onClaimed,
}: {
  session: PublicSession | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onClaimed: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [phone, setPhone] = useState('');

  const [sessionType, setSessionType] = useState<'exclusive' | 'business_staff' | 'business_customers' | 'open' | ''>('');
  const [businessSubType, setBusinessSubType] = useState<'staff_only' | 'staff_customers' | 'staff_members' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setName('');
      setGroupName('');
      setPhone('');
      setSessionType('');
      setBusinessSubType(null);
      setError(null);
    }
  }, [open]);

  if (!session) return null;

  // Block claims within 7 days — public page cannot override
  const sessionDate = new Date(session.session_date + 'T00:00:00');
  const now = getNowCentral();
  const diffDays = Math.ceil((sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const tooSoon = diffDays < 3;

  const canSubmit =
    name.trim() && groupName.trim() && phone.trim() && sessionType && !tooSoon;

  const handleClaim = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const { data: current } = await sb
        .from('vip_sessions')
        .select('status')
        .eq('id', session.id)
        .is('archived_at', null)
        .single();
      if (!current || (current as any).status !== 'open') {
        setError('This slot was just claimed. Please choose another.');
        setSubmitting(false);
        return;
      }

      const { error: upErr } = await sb
        .from('vip_sessions')
        .update({
          status: 'reserved',
          reserved_by_group: groupName.trim(),
          reserved_contact_name: name.trim(),
          reserved_contact_phone: phone.trim(),
          session_type: sessionType,
          business_sub_type: businessSubType,
        } as any)
        .eq('id', session.id)
        .eq('status', 'open')
        .is('archived_at', null);
      if (upErr) throw upErr;

      // Idempotent claim: remove any prior group-contact row for this session
      // (prevents stale orphans when a slot was previously claimed by a different group)
      await sb
        .from('vip_registrations')
        .delete()
        .eq('vip_session_id', session.id)
        .eq('is_group_contact', true);

      await sb.from('vip_registrations').insert({
        vip_session_id: session.id,
        first_name: name.trim().split(' ')[0] || name.trim(),
        last_name: name.trim().split(' ').slice(1).join(' ') || '',
        phone: phone.trim(),
        is_group_contact: true,
      } as any);

      const formattedDate = format(
        new Date(session.session_date + 'T00:00:00'),
        'MMM d'
      );
      const formattedTime = formatDisplayTime(session.session_time);

      // Privacy-first staff alert: group + slot only, no contact name.
      await sb.from('notifications').insert({
        notification_type: 'vip_slot_claimed',
        title: `${groupName.trim()} claimed VIP slot`,
        body: `${groupName.trim()} claimed the ${formattedDate} ${formattedTime} VIP slot (${sessionType}).`,
        target_user: null,
        meta: {
          session_id: session.id,
          group_name: groupName.trim(),
          contact_name: name.trim(),
          contact_phone: phone.trim(),
          session_type: sessionType,
          business_sub_type: businessSubType,
        },
      });

      // Post to GroupMe (non-blocking)
      const gmMsg = `🎉 VIP Class Claimed!\n${groupName.trim()} booked ${formattedDate} at ${formattedTime}\nType: ${sessionType === 'exclusive' ? 'Private — Group Only' : 'Business'}\nContact: ${name.trim()} (${phone.trim()})`;
      supabase.functions.invoke('post-groupme', {
        body: { action: 'custom', text: gmMsg },
      }).catch(() => {});

      // Compute slug from session date/time (matches generator used elsewhere)
      const d2 = new Date(session.session_date + 'T00:00:00');
      const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      const _month = monthNames[d2.getMonth()];
      const _day = d2.getDate();
      const [_h, _m] = session.session_time.split(':');
      const _hour = parseInt(_h);
      const _min = _m || '00';
      const _ampm = _hour >= 12 ? 'pm' : 'am';
      const _h12 = _hour > 12 ? _hour - 12 : _hour === 0 ? 12 : _hour;
      const slug = `vip-${_month}${_day}-${_h12}${_min !== '00' ? _min : ''}${_ampm}`;

      onClaimed(session.id);
      onOpenChange(false);
      navigate(`/vip/${slug}/confirmed`);
    } catch (err: any) {
      console.error('Claim error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Claim{' '}
            {format(new Date(session.session_date + 'T00:00:00'), 'EEEE, MMM d')}{' '}
            at {formatDisplayTime(session.session_time)}
          </DialogTitle>
          <DialogDescription>
            Fill out the form below to reserve this private group class.
          </DialogDescription>
        </DialogHeader>

          <div className="space-y-3">
            {tooSoon && (
              <div className="bg-warning-dim dark:bg-warning/30 border border-warning dark:border-warning rounded-lg p-3 text-sm text-warning dark:text-warning">
                ⚠️ This slot is less than 3 days away and can no longer be claimed online. Please contact us directly if you need to book on short notice.
              </div>
            )}
            {error && (
              <div className="bg-danger-dim dark:bg-danger/30 border border-danger dark:border-danger rounded-lg p-3 text-sm text-danger dark:text-danger">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Your Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" className="border h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Group Name</Label>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Alpha Phi Sorority" className="border h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(205) 555-1234" className="border h-11" />
            </div>

            {/* Class Type Selection — 4 flat options */}
            <div className="space-y-2">
              <Label>Who will be joining this class?</Label>
              <div className="grid grid-cols-1 gap-2">
                {([
                  {
                    type: 'exclusive' as const,
                    subType: null,
                    header: 'Social Group or Organization',
                    sub: 'Greek life, sports teams, community groups. Private experience — just your people.',
                  },
                  {
                    type: 'business_staff' as const,
                    subType: 'staff_only' as const,
                    header: 'Business — Staff Only',
                    sub: 'A private experience for your team. No outside members.',
                  },
                  {
                    type: 'business_customers' as const,
                    subType: 'staff_customers' as const,
                    header: 'Business — Staff + Your Customers',
                    sub: "Bring your staff and invite your customers for a community bonding event. We'll give you a QR code to help drive sign-ups.",
                  },
                  {
                    type: 'open' as const,
                    subType: 'staff_members' as const,
                    header: 'Business — Staff + OTF Members',
                    sub: "Your group joins our members. We'll market with you and do a collab post together.",
                  },
                ]).map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => { setSessionType(opt.type); setBusinessSubType(opt.subType); }}
                    className={cn(
                      'w-full text-left rounded-lg border-2 p-3 cursor-pointer transition-colors min-h-[44px]',
                      sessionType === opt.type
                        ? 'border-brand bg-brand-dim dark:bg-brand/20'
                        : 'border-border hover:border-muted-foreground/30'
                    )}
                  >
                    <p className="font-semibold text-sm">{opt.header}</p>
                    <p className="text-xs text-muted-foreground mt-1">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full h-11 bg-brand hover:bg-brand-hover text-white font-semibold"
              onClick={handleClaim}
              disabled={submitting || !canSubmit}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Claim This Slot
            </Button>
          </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Desktop Slot Pill ─────────────────────────────── */

function SlotPill({
  session,
  onClaim,
  isConfirmed,
}: {
  session: PublicSession;
  onClaim: () => void;
  isConfirmed: boolean;
}) {
  const isOpen = session.status === 'open';
  const isOpenType = session.session_type === 'open';
  const isBusiness = session.session_type === 'business_customers';

  // Check 7-day block
  const sessionDate = new Date(session.session_date + 'T00:00:00');
  const now = getNowCentral();
  const diffDays = Math.ceil((sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const tooSoon = isOpen && diffDays < 3;

  if (isConfirmed) {
    return (
      <div className="rounded border-l-4 border-l-green-500 bg-success-dim dark:bg-success/30 px-1.5 py-1 text-center">
        <CheckCircle className="w-3.5 h-3.5 text-success mx-auto" />
      </div>
    );
  }

  const borderColor = isOpen
    ? tooSoon ? 'border-l-gray-400' : 'border-l-green-500'
    : isBusiness
      ? 'border-l-blue-500'
      : isOpenType
        ? 'border-l-teal-500'
        : 'border-l-amber-500';

  const canClick = isOpen && !tooSoon;

  return (
    <div
      role={canClick ? 'button' : undefined}
      tabIndex={canClick ? 0 : undefined}
      onClick={(e) => {
        if (canClick) {
          e.stopPropagation();
          onClaim();
        }
      }}
      onKeyDown={(e) => {
        if (canClick && (e.key === 'Enter' || e.key === ' ')) {
          e.stopPropagation();
          onClaim();
        }
      }}
      className={cn(
        'rounded border-l-4 px-1.5 py-1 bg-card',
        borderColor,
        canClick && 'cursor-pointer hover:bg-success-dim dark:hover:bg-success/20 transition-colors'
      )}
    >
      <p className={cn('text-[11px] font-semibold leading-tight', (!isOpen || tooSoon) && 'text-muted-foreground')}>
        {formatDisplayTime(session.session_time)}
      </p>
      {isOpen && tooSoon ? (
        <p className="text-[10px] leading-tight text-muted-foreground italic">Contact us</p>
      ) : isOpen ? (
        <p className="text-[10px] leading-tight text-success dark:text-success font-medium">Available</p>
      ) : isBusiness ? (
        <p className="text-[10px] leading-tight text-neutral dark:text-neutral truncate">
          {session.reserved_by_group || 'Group'} · Business Event
        </p>
      ) : isOpenType ? (
        <p className="text-[10px] leading-tight text-success dark:text-success truncate">
          {session.reserved_by_group || 'Group'} · Members Welcome
        </p>
      ) : (
        <p className="text-[10px] leading-tight text-warning dark:text-warning italic truncate">
          {session.reserved_by_group || 'Reserved'}
        </p>
      )}
    </div>
  );
}

/* ── Day Detail List ──────────────────────────────── */

function DaySlotList({
  sessions,
  confirmedIds,
  onClaim,
}: {
  sessions: PublicSession[];
  confirmedIds: Set<string>;
  onClaim: (s: PublicSession) => void;
}) {
  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No slots this day</p>;
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => {
        const isOpen = s.status === 'open';
        const isOpenType = s.session_type === 'open';
        const isBusiness = s.session_type === 'business_customers';
        const confirmed = confirmedIds.has(s.id);

        if (confirmed) {
          return (
            <div key={s.id} className="rounded-lg border-l-4 border-l-green-500 bg-success-dim dark:bg-success/30 p-3 text-center">
              <CheckCircle className="w-5 h-5 text-success mx-auto mb-1" />
              <p className="text-xs font-semibold text-success dark:text-success">Confirmed!</p>
            </div>
          );
        }

        const borderColor = isOpen
          ? 'border-l-green-500'
          : isBusiness
            ? 'border-l-blue-500'
            : isOpenType
              ? 'border-l-teal-500'
              : 'border-l-amber-500';

        return (
          <div key={s.id} className={cn('rounded-lg border-l-4 p-3', borderColor, 'bg-card')}>
            <p className="font-semibold text-sm">{formatDisplayTime(s.session_time)}</p>
            {isOpen ? (
              <>
                <p className="text-xs text-success dark:text-success font-medium">Available</p>
                <Button
                  className="w-full h-11 mt-2 bg-brand hover:bg-brand-hover text-white font-semibold text-sm"
                  onClick={() => onClaim(s)}
                >
                  Claim This Slot
                </Button>
              </>
            ) : isBusiness ? (
              <>
                <p className="text-xs text-neutral dark:text-neutral font-medium">
                  Reserved — {s.reserved_by_group || 'Group'} · Business Event
                </p>
              </>
            ) : isOpenType ? (
              <>
                <p className="text-xs text-success dark:text-success font-medium">
                  Reserved — {s.reserved_by_group || 'Group'} + Members Welcome
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-warning dark:text-warning font-medium">Reserved — Private Event</p>
                {s.reserved_by_group && (
                  <p className="text-xs text-muted-foreground italic mt-0.5">{s.reserved_by_group}</p>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Month Helpers ─────────────────────────────────── */

function useMonthData(monthOffset: number) {
  return useMemo(() => {
    const now = getNowCentral();
    const base = addMonths(now, monthOffset);
    const monthStart = startOfMonth(base);
    const monthEnd = endOfMonth(base);
    // Calendar grid: start from Sunday of the week containing monthStart
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const todayStr = getTodayYMD();

    return {
      monthStart,
      monthEnd,
      monthLabel: format(monthStart, 'MMMM yyyy'),
      days: allDays.map((d) => {
        const dateStr = format(d, 'yyyy-MM-dd');
        return {
          date: dateStr,
          dayDate: d,
          dateNum: d.getDate(),
          isToday: dateStr === todayStr,
          isCurrentMonth: isSameMonth(d, monthStart),
          isPast: isBefore(d, new Date(todayStr + 'T00:00:00')) && dateStr !== todayStr,
        };
      }),
      todayStr,
      queryStart: format(gridStart, 'yyyy-MM-dd'),
      queryEnd: format(gridEnd, 'yyyy-MM-dd'),
    };
  }, [monthOffset]);
}

function useWeekData(weekOffset: number) {
  return useMemo(() => {
    const now = getNowCentral();
    const base = addDays(now, weekOffset * 7);
    const weekStart = startOfWeek(base, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(base, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const todayStr = getTodayYMD();
    return {
      weekStart,
      weekEnd,
      weekLabel: `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`,
      days: days.map((d) => {
        const dateStr = format(d, 'yyyy-MM-dd');
        return {
          date: dateStr,
          dayDate: d,
          isToday: dateStr === todayStr,
          isPast: isBefore(d, new Date(todayStr + 'T00:00:00')) && dateStr !== todayStr,
          dayLabel: format(d, 'EEE, MMM d'),
        };
      }),
      todayStr,
      queryStart: format(weekStart, 'yyyy-MM-dd'),
      queryEnd: format(weekEnd, 'yyyy-MM-dd'),
    };
  }, [weekOffset]);
}

/* ── Main Page ─────────────────────────────────────── */

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function VipAvailability() {
  const isMobile = useIsMobile();
  const [sessions, setSessions] = useState<PublicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [forceMonthOnMobile, setForceMonthOnMobile] = useState(false);
  const [claimSession, setClaimSession] = useState<PublicSession | null>(null);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const useWeekView = isMobile && !forceMonthOnMobile;

  const monthData = useMonthData(monthOffset);
  const weekData = useWeekData(weekOffset);
  const { monthLabel, days } = monthData;
  const { weekLabel, days: weekDays } = weekData;
  const queryStart = useWeekView ? weekData.queryStart : monthData.queryStart;
  const queryEnd = useWeekView ? weekData.queryEnd : monthData.queryEnd;

  const isCurrentMonth = monthOffset === 0;
  const isCurrentWeek = weekOffset === 0;

  const fetchSessions = useCallback(async () => {
    const { data } = await sb
      .from('vip_sessions')
      .select('id, session_date, session_time, status, reserved_by_group, description, session_type')
      .is('archived_at', null)
      .eq('is_on_availability_page', true)
      .gte('session_date', queryStart)
      .lte('session_date', queryEnd)
      .neq('status', 'cancelled')
      .order('session_date', { ascending: true })
      .order('session_time', { ascending: true });
    setSessions((data as any[]) || []);
    setLoading(false);
  }, [queryStart, queryEnd]);

  useEffect(() => {
    setLoading(true);
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    const channel = sb
      .channel('vip-availability')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vip_sessions' },
        () => fetchSessions()
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [fetchSessions]);

  // Group sessions by date
  const sessionsByDate = useMemo(() => {
    const map: Record<string, PublicSession[]> = {};
    for (const s of sessions) {
      if (!map[s.session_date]) map[s.session_date] = [];
      map[s.session_date].push(s);
    }
    return map;
  }, [sessions]);

  // Selected day sessions for mobile sheet
  const selectedDaySessions = selectedDay ? sessionsByDate[selectedDay] || [] : [];

  // Split days into weeks (rows of 7)
  const weeks = useMemo(() => {
    const result: typeof days[number][][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  return (
    <div className="min-h-screen bg-neutral-dim dark:bg-neutral">
      {/* Header */}
      <div className="bg-brand text-white py-8 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-2xl font-bold">
            OTF Tuscaloosa — VIP Group Classes
          </h1>
          <p className="mt-2 text-sm opacity-90">
            We host free private fitness experiences for groups. Pick an
            available time below to claim your slot.
          </p>
        </div>
      </div>

      {/* Story */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-2 text-center">
        <p className="text-base font-semibold text-foreground">
          Your group. Our coaches. One hour that changes how your team sees each other.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Free for your entire group. All fitness levels welcome. Just pick a time.
        </p>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {/* Pick First, Then Share callout */}
        <div className="rounded-lg border-l-4 border-brand bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-foreground leading-relaxed">
              Pick your time first. Once you choose a timeslot that works for your group, it will automatically generate a link to share with the members of your group. That link will provide us with the information we need to book them into the class and set up their heart rate monitors.
            </p>
          </div>
        </div>

        {/* Navigation — week on mobile, month on desktop */}
        {useWeekView ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="min-h-[44px] flex-1 text-sm font-medium"
              disabled={isCurrentWeek}
              onClick={() => setWeekOffset((o) => o - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Prev Week
            </Button>
            <div className="flex-1 text-center">
              <p className="text-sm font-semibold">{weekLabel}</p>
              {!isCurrentWeek && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="text-xs text-brand underline cursor-pointer mt-0.5"
                >
                  Back to this week
                </button>
              )}
            </div>
            <Button
              variant="outline"
              className="min-h-[44px] flex-1 text-sm font-medium"
              onClick={() => setWeekOffset((o) => o + 1)}
            >
              Next Week
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="min-h-[44px] flex-1 text-sm font-medium"
              disabled={isCurrentMonth}
              onClick={() => setMonthOffset((o) => o - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous Month
            </Button>
            <div className="flex-1 text-center">
              <p className="text-sm font-semibold">{monthLabel}</p>
              {!isCurrentMonth && (
                <button
                  onClick={() => setMonthOffset(0)}
                  className="text-xs text-brand underline cursor-pointer mt-0.5"
                >
                  Back to this month
                </button>
              )}
            </div>
            <Button
              variant="outline"
              className="min-h-[44px] flex-1 text-sm font-medium"
              onClick={() => setMonthOffset((o) => o + 1)}
            >
              Next Month
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Mobile: toggle to full month view */}
        {isMobile && (
          <div className="flex justify-center">
            <button
              onClick={() => setForceMonthOnMobile((v) => !v)}
              className="text-xs text-brand underline"
            >
              {useWeekView ? 'See full month view' : 'Back to week view'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : useWeekView ? (
          /* MOBILE WEEK LIST */
          <div className="space-y-3">
            {weekDays.map((day) => {
              const daySessions = sessionsByDate[day.date] || [];
              return (
                <div
                  key={day.date}
                  className={cn(
                    'rounded-lg border bg-card overflow-hidden',
                    day.isToday && 'border-brand'
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center justify-between px-3 py-2 border-b',
                      day.isToday ? 'bg-brand-dim dark:bg-brand/20' : 'bg-muted/30'
                    )}
                  >
                    <p className="text-sm font-bold">
                      {day.dayLabel}
                      {day.isToday && <span className="ml-2 text-[10px] uppercase text-brand">Today</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {daySessions.length === 0
                        ? 'No slots'
                        : `${daySessions.length} slot${daySessions.length === 1 ? '' : 's'}`}
                    </p>
                  </div>
                  {daySessions.length > 0 && (
                    <div className="divide-y">
                      {daySessions.map((s) => {
                        const isOpen = s.status === 'open';
                        const isOpenType = s.session_type === 'open';
                        const isBusiness = s.session_type === 'business_customers';
                        const confirmed = confirmedIds.has(s.id);
                        const sessionDate = new Date(s.session_date + 'T00:00:00');
                        const diffDays = Math.ceil(
                          (sessionDate.getTime() - getNowCentral().getTime()) / (1000 * 60 * 60 * 24)
                        );
                        const tooSoon = diffDays < 3;
                        const canClaim = isOpen && !tooSoon && !confirmed;

                        const borderColor = confirmed
                          ? 'border-l-green-500'
                          : isOpen
                            ? 'border-l-green-500'
                            : isBusiness
                              ? 'border-l-blue-500'
                              : isOpenType
                                ? 'border-l-teal-500'
                                : 'border-l-amber-500';

                        return (
                          <button
                            key={s.id}
                            onClick={() => canClaim && setClaimSession(s)}
                            disabled={!canClaim}
                            className={cn(
                              'w-full flex items-center justify-between px-3 py-3 border-l-4 text-left min-h-[56px]',
                              borderColor,
                              canClaim && 'hover:bg-muted/40 active:bg-muted/60 cursor-pointer',
                              !canClaim && 'cursor-default'
                            )}
                          >
                            <div>
                              <p className="text-base font-bold">{formatDisplayTime(s.session_time)}</p>
                              {confirmed ? (
                                <p className="text-xs text-success font-medium">✓ Confirmed</p>
                              ) : isOpen && tooSoon ? (
                                <p className="text-xs text-muted-foreground italic">Within 3 days — contact us</p>
                              ) : isOpen ? (
                                <p className="text-xs text-success font-semibold">Available</p>
                              ) : isBusiness ? (
                                <p className="text-xs text-neutral truncate">{s.reserved_by_group || 'Group'} · Business</p>
                              ) : isOpenType ? (
                                <p className="text-xs text-success truncate">{s.reserved_by_group || 'Group'} · Members welcome</p>
                              ) : (
                                <p className="text-xs text-warning italic truncate">{s.reserved_by_group || 'Reserved'}</p>
                              )}
                            </div>
                            {canClaim && (
                              <span className="text-xs font-bold text-white bg-brand px-3 py-1.5 rounded-full">
                                Claim
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-center text-xs text-muted-foreground pt-2">
              Green = available · Amber = reserved · Blue = business event · Teal = open to members · Max 36 · Min 3 days out
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP / FULL MONTH GRID */}
            <div className="border rounded-lg overflow-hidden bg-card">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b bg-muted/30">
                {DAY_HEADERS.map((d) => (
                  <div key={d} className="text-center py-2 text-xs font-bold text-muted-foreground">
                    {d}
                  </div>
                ))}
              </div>

              {/* Week Rows */}
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
                  {week.map((day) => {
                    const daySessions = sessionsByDate[day.date] || [];
                    const hasSlots = daySessions.length > 0;

                    return (
                      <button
                        key={day.date}
                        onClick={() => {
                          if (isMobile && hasSlots) setSelectedDay(day.date);
                        }}
                        className={cn(
                          'relative border-r last:border-r-0 p-1 transition-colors text-left align-top',
                          isMobile ? 'min-h-[52px]' : 'min-h-[80px] min-w-[120px]',
                          !day.isCurrentMonth && !isMobile && 'bg-muted/20',
                          isMobile && !day.isCurrentMonth && 'invisible',
                          day.isToday && 'bg-brand-dim/50 dark:bg-brand/10',
                          isMobile && hasSlots && 'cursor-pointer hover:bg-muted/40',
                          (!hasSlots || !isMobile) && 'cursor-default'
                        )}
                      >
                        {/* Date Number */}
                        <span
                          className={cn(
                            'inline-flex items-center justify-center text-xs font-medium',
                            isMobile ? 'w-6 h-6' : 'w-7 h-7',
                            day.isToday
                              ? 'bg-brand text-white rounded-full font-bold'
                              : !day.isCurrentMonth && !isMobile
                                ? 'text-muted-foreground/40'
                                : 'text-foreground',
                            isMobile && !day.isCurrentMonth && 'invisible'
                          )}
                        >
                          {day.dateNum}
                        </span>

                        {/* Slot display */}
                        {hasSlots && (
                          isMobile ? (
                            <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                              {daySessions.map((s) => {
                                const isOpen = s.status === 'open';
                                const isOpenType = s.session_type === 'open';
                                const isBusiness = s.session_type === 'business_customers';
                                const dotColor = confirmedIds.has(s.id)
                                  ? 'bg-success ring-1 ring-success-dim'
                                  : isOpen
                                    ? 'bg-success'
                                    : isBusiness
                                      ? 'bg-neutral'
                                      : isOpenType
                                        ? 'bg-success'
                                        : 'bg-warning';
                                return <span key={s.id} className={cn('w-2 h-2 rounded-full', dotColor)} />;
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              {daySessions.map((s) => (
                                <SlotPill
                                  key={s.id}
                                  session={s}
                                  isConfirmed={confirmedIds.has(s.id)}
                                  onClaim={() => setClaimSession(s)}
                                />
                              ))}
                            </div>
                          )
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground pt-2">
              Green = available to claim · Amber = reserved private · Blue = business event · Teal = open to members · Max capacity: 36 · Tap to book
            </p>
          </>
        )}
      </div>


      {/* Mobile Bottom Sheet */}
      {isMobile && (
        <Sheet open={!!selectedDay} onOpenChange={(o) => { if (!o) setSelectedDay(null); }}>
          <SheetContent side="bottom" className="max-h-[70vh]">
            <SheetHeader>
              <SheetTitle>
                {selectedDay && format(new Date(selectedDay + 'T00:00:00'), 'EEEE, MMMM d')}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 overflow-y-auto">
              <DaySlotList
                sessions={selectedDaySessions}
                confirmedIds={confirmedIds}
                onClaim={(s) => {
                  setSelectedDay(null);
                  setTimeout(() => setClaimSession(s), 200);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Claim Dialog */}
      <ClaimDialog
        session={claimSession}
        open={!!claimSession}
        onOpenChange={(o) => {
          if (!o) setClaimSession(null);
        }}
        onClaimed={(id) => {
          setConfirmedIds((prev) => new Set(prev).add(id));
          fetchSessions();
        }}
      />
    </div>
  );
}
