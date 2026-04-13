/**
 * Public VIP Availability page — /vip-availability
 * Monthly calendar showing available VIP session slots.
 * Groups can view and claim available slots via a modal form.
 * No auth required. OTF-branded.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Loader2, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
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
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [groupSize, setGroupSize] = useState('');
  const [sessionType, setSessionType] = useState<'exclusive' | 'open' | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setGroupName('');
      setEmail('');
      setPhone('');
      setGroupSize('');
      setSessionType('');
      setError(null);
      setConfirmed(false);
    }
  }, [open]);

  if (!session) return null;

  const canSubmit =
    name.trim() && groupName.trim() && email.trim() && phone.trim() && groupSize.trim() && sessionType;

  const handleClaim = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const { data: current } = await sb
        .from('vip_sessions')
        .select('status')
        .eq('id', session.id)
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
          reserved_contact_email: email.trim(),
          reserved_contact_phone: phone.trim(),
          estimated_group_size: parseInt(groupSize),
          session_type: sessionType,
        } as any)
        .eq('id', session.id)
        .eq('status', 'open');
      if (upErr) throw upErr;

      await sb.from('vip_registrations').insert({
        vip_session_id: session.id,
        full_name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      } as any);

      const formattedDate = format(
        new Date(session.session_date + 'T00:00:00'),
        'MMM d'
      );
      const formattedTime = formatDisplayTime(session.session_time);

      await sb.from('notifications').insert({
        notification_type: 'vip_slot_claimed',
        title: `${groupName.trim()} claimed VIP slot`,
        body: `${groupName.trim()} claimed the ${formattedDate} ${formattedTime} VIP slot (${sessionType}). ${groupSize} estimated attendees. Contact: ${name.trim()}`,
        target_user: null,
        meta: {
          session_id: session.id,
          group_name: groupName.trim(),
          contact_name: name.trim(),
          contact_email: email.trim(),
          contact_phone: phone.trim(),
          estimated_size: parseInt(groupSize),
          session_type: sessionType,
        },
      });

      setConfirmed(true);
      onClaimed(session.id);
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

        {confirmed ? (
          <div className="py-6 text-center space-y-2">
            <CheckCircle className="w-10 h-10 text-green-600 mx-auto" />
            <p className="font-semibold text-green-700 dark:text-green-400">
              Your slot is confirmed!
            </p>
            <p className="text-sm text-muted-foreground">
              We'll be in touch with next steps and a link for your group members
              to fill out before class.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
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
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" className="border h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(205) 555-1234" className="border h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Estimated Group Size</Label>
              <Input type="number" min="1" value={groupSize} onChange={(e) => setGroupSize(e.target.value)} placeholder="15" className="border h-11" />
            </div>

            {/* Class Type Selection */}
            <div className="space-y-2">
              <Label>Would you like to open this class to OTF Tuscaloosa members?</Label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setSessionType('exclusive')}
                  className={cn(
                    'w-full text-left rounded-lg border-2 p-3 cursor-pointer transition-colors min-h-[44px]',
                    sessionType === 'exclusive'
                      ? 'border-[#FF6900] bg-orange-50 dark:bg-orange-950/20'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  <p className="font-semibold text-sm">Private — Our group only</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Just your people. More intimate experience.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setSessionType('open')}
                  className={cn(
                    'w-full text-left rounded-lg border-2 p-3 cursor-pointer transition-colors min-h-[44px]',
                    sessionType === 'open'
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/20'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  <p className="font-semibold text-sm">Community — Open to OTF members</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your group joins our members. Fuller class, bigger energy. Great for businesses and community events.
                  </p>
                </button>
              </div>
            </div>

            <Button
              className="w-full h-11 bg-[#FF6900] hover:bg-[#e55f00] text-white font-semibold"
              onClick={handleClaim}
              disabled={submitting || !canSubmit}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Claim This Slot
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Slot Dot ──────────────────────────────────────── */

function SlotDot({
  session,
  onClaim,
  isConfirmed,
}: {
  session: PublicSession;
  onClaim: () => void;
  isConfirmed: boolean;
}) {
  const isOpen = session.status === 'open';
  const isReserved = session.status === 'reserved';
  const isOpenType = session.session_type === 'open';

  if (isConfirmed) {
    return (
      <div className="w-3 h-3 rounded-full bg-green-500 ring-2 ring-green-300" title="Confirmed!" />
    );
  }

  const dotColor = isOpen
    ? 'bg-green-500'
    : isOpenType
      ? 'bg-teal-500'
      : 'bg-amber-500';

  const popoverContent = isOpen ? (
    <div className="space-y-2">
      <p className="font-semibold text-sm">{formatDisplayTime(session.session_time)}</p>
      <p className="text-xs text-green-600 dark:text-green-400 font-medium">Available</p>
      <Button
        className="w-full h-11 bg-[#FF6900] hover:bg-[#e55f00] text-white font-semibold text-sm"
        onClick={onClaim}
      >
        Claim This Slot
      </Button>
    </div>
  ) : (
    <div className="space-y-1">
      <p className="font-semibold text-sm">{formatDisplayTime(session.session_time)}</p>
      {isOpenType ? (
        <>
          <p className="text-xs text-teal-600 dark:text-teal-400 font-medium">
            Reserved — {session.reserved_by_group || 'Group'} + Members Welcome
          </p>
        </>
      ) : (
        <>
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Reserved — Private Event
          </p>
          {session.reserved_by_group && (
            <p className="text-xs text-muted-foreground italic">{session.reserved_by_group}</p>
          )}
        </>
      )}
    </div>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'w-3.5 h-3.5 rounded-full cursor-pointer transition-transform hover:scale-125 min-w-[14px]',
            dotColor,
            isOpen && 'ring-2 ring-green-200 dark:ring-green-800'
          )}
          title={`${formatDisplayTime(session.session_time)} — ${isOpen ? 'Available' : 'Reserved'}`}
        />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3">
        {popoverContent}
      </PopoverContent>
    </Popover>
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
        const confirmed = confirmedIds.has(s.id);

        if (confirmed) {
          return (
            <div key={s.id} className="rounded-lg border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/30 p-3 text-center">
              <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
              <p className="text-xs font-semibold text-green-700 dark:text-green-400">Confirmed!</p>
            </div>
          );
        }

        const borderColor = isOpen
          ? 'border-l-green-500'
          : isOpenType
            ? 'border-l-teal-500'
            : 'border-l-amber-500';

        return (
          <div key={s.id} className={cn('rounded-lg border-l-4 p-3', borderColor, 'bg-card')}>
            <p className="font-semibold text-sm">{formatDisplayTime(s.session_time)}</p>
            {isOpen ? (
              <>
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Available</p>
                <Button
                  className="w-full h-11 mt-2 bg-[#FF6900] hover:bg-[#e55f00] text-white font-semibold text-sm"
                  onClick={() => onClaim(s)}
                >
                  Claim This Slot
                </Button>
              </>
            ) : isOpenType ? (
              <>
                <p className="text-xs text-teal-600 dark:text-teal-400 font-medium">
                  Reserved — {s.reserved_by_group || 'Group'} + Members Welcome
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Reserved — Private Event</p>
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

/* ── Main Page ─────────────────────────────────────── */

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function VipAvailability() {
  const isMobile = useIsMobile();
  const [sessions, setSessions] = useState<PublicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);
  const [claimSession, setClaimSession] = useState<PublicSession | null>(null);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { monthLabel, days, queryStart, queryEnd } = useMonthData(monthOffset);

  const isCurrentMonth = monthOffset === 0;

  const fetchSessions = useCallback(async () => {
    const { data } = await sb
      .from('vip_sessions')
      .select('id, session_date, session_time, status, reserved_by_group, description, session_type')
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-[#FF6900] text-white py-8 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-2xl font-bold">
            OTF Tuscaloosa — Private Group Classes
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
        {/* Month Navigation */}
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
                className="text-xs text-[#FF6900] underline cursor-pointer mt-0.5"
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

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Calendar Grid */}
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
                          if (hasSlots) setSelectedDay(day.date);
                        }}
                        className={cn(
                          'relative border-r last:border-r-0 p-1 transition-colors text-left',
                          isMobile ? 'min-h-[52px]' : 'min-h-[80px]',
                          !day.isCurrentMonth && 'bg-muted/20',
                          day.isToday && 'bg-orange-50/50 dark:bg-orange-950/10',
                          hasSlots && 'cursor-pointer hover:bg-muted/40',
                          !hasSlots && 'cursor-default'
                        )}
                      >
                        {/* Date Number */}
                        <span
                          className={cn(
                            'inline-flex items-center justify-center text-xs font-medium',
                            isMobile ? 'w-6 h-6' : 'w-7 h-7',
                            day.isToday
                              ? 'bg-[#FF6900] text-white rounded-full font-bold'
                              : !day.isCurrentMonth
                                ? 'text-muted-foreground/40'
                                : 'text-foreground'
                          )}
                        >
                          {day.dateNum}
                        </span>

                        {/* Slot Dots */}
                        {hasSlots && (
                          isMobile ? (
                            /* Mobile: just show colored dots */
                            <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                              {daySessions.map((s) => {
                                const isOpen = s.status === 'open';
                                const isOpenType = s.session_type === 'open';
                                const dotColor = confirmedIds.has(s.id)
                                  ? 'bg-green-500 ring-1 ring-green-300'
                                  : isOpen
                                    ? 'bg-green-500'
                                    : isOpenType
                                      ? 'bg-teal-500'
                                      : 'bg-amber-500';
                                return <span key={s.id} className={cn('w-2 h-2 rounded-full', dotColor)} />;
                              })}
                            </div>
                          ) : (
                            /* Desktop: interactive dots with popovers */
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {daySessions.map((s) => (
                                <SlotDot
                                  key={s.id}
                                  session={s}
                                  isConfirmed={confirmedIds.has(s.id)}
                                  onClaim={() => {
                                    setClaimSession(s);
                                  }}
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

            {/* Legend */}
            <div className="flex items-center gap-4 justify-center text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Available
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Reserved — Private
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" /> Reserved — Members Welcome
              </span>
            </div>
          </>
        )}
      </div>

      {/* Desktop Day Detail Panel */}
      {!isMobile && selectedDay && (
        <div className="max-w-5xl mx-auto px-4 pb-8">
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">
                {format(new Date(selectedDay + 'T00:00:00'), 'EEEE, MMMM d')}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[44px] text-xs cursor-pointer"
                onClick={() => setSelectedDay(null)}
              >
                Close
              </Button>
            </div>
            <DaySlotList
              sessions={selectedDaySessions}
              confirmedIds={confirmedIds}
              onClaim={(s) => setClaimSession(s)}
            />
          </div>
        </div>
      )}

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
