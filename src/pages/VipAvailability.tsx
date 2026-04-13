/**
 * Public VIP Availability page — /vip-availability
 * Weekly calendar grid showing available VIP session slots.
 * Groups can view and claim available slots via a modal form.
 * No auth required. OTF-branded.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
const sb = supabase as any;
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  eachDayOfInterval,
  isBefore,
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setGroupName('');
      setEmail('');
      setPhone('');
      setGroupSize('');
      setError(null);
      setConfirmed(false);
    }
  }, [open]);

  if (!session) return null;

  const canSubmit =
    name.trim() && groupName.trim() && email.trim() && phone.trim() && groupSize.trim();

  const handleClaim = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      // Race-condition check
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
        body: `${groupName.trim()} claimed the ${formattedDate} ${formattedTime} VIP slot. ${groupSize} estimated attendees. Contact: ${name.trim()}`,
        target_user: null,
        meta: {
          session_id: session.id,
          group_name: groupName.trim(),
          contact_name: name.trim(),
          contact_email: email.trim(),
          contact_phone: phone.trim(),
          estimated_size: parseInt(groupSize),
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
      <DialogContent className="max-w-md">
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
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className="border h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Group Name</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Alpha Phi Sorority"
                className="border h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="border h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(205) 555-1234"
                className="border h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estimated Group Size</Label>
              <Input
                type="number"
                min="1"
                value={groupSize}
                onChange={(e) => setGroupSize(e.target.value)}
                placeholder="15"
                className="border h-11"
              />
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

/* ── Slot Pill ─────────────────────────────────────── */

function SlotPill({
  session,
  expanded,
  onToggle,
  onClaim,
  isConfirmed,
}: {
  session: PublicSession;
  expanded: boolean;
  onToggle: () => void;
  onClaim: () => void;
  isConfirmed: boolean;
}) {
  const isOpen = session.status === 'open';
  const isReserved = session.status === 'reserved';

  if (isConfirmed) {
    return (
      <div className="rounded-lg border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/30 p-2.5 text-center">
        <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
        <p className="text-xs font-semibold text-green-700 dark:text-green-400">
          Confirmed!
        </p>
      </div>
    );
  }

  if (isReserved) {
    return (
      <div className="rounded-lg border-l-4 border-l-amber-500 bg-muted/40 p-2.5">
        <p className="font-semibold text-sm text-muted-foreground">
          {formatDisplayTime(session.session_time)}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
          Reserved
        </p>
        {session.reserved_by_group && (
          <p className="text-xs text-muted-foreground italic mt-0.5">
            {session.reserved_by_group}
          </p>
        )}
      </div>
    );
  }

  if (isOpen) {
    return (
      <div className="space-y-1.5">
        <button
          onClick={onToggle}
          className="w-full rounded-lg border-l-4 border-l-green-500 bg-card p-2.5 text-left cursor-pointer hover:bg-muted/50 transition-colors min-h-[44px]"
        >
          <p className="font-semibold text-sm">
            {formatDisplayTime(session.session_time)}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 font-medium">
            Available
          </p>
        </button>
        {expanded && (
          <Button
            className="w-full h-11 bg-[#FF6900] hover:bg-[#e55f00] text-white font-semibold text-sm"
            onClick={onClaim}
          >
            Claim This Slot
          </Button>
        )}
      </div>
    );
  }

  return null;
}

/* ── Week Helpers ──────────────────────────────────── */

function useWeekData(weekOffset: number) {
  return useMemo(() => {
    const now = getNowCentral();
    const base = addWeeks(now, weekOffset);
    const monday = startOfWeek(base, { weekStartsOn: 1 });
    const sunday = endOfWeek(base, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: monday, end: sunday });
    const todayStr = getTodayYMD();

    return {
      monday,
      sunday,
      days: days.map((d) => {
        const dateStr = format(d, 'yyyy-MM-dd');
        return {
          date: dateStr,
          dayDate: d,
          dayAbbr: format(d, 'EEE'),
          dateNum: d.getDate(),
          isToday: dateStr === todayStr,
          isPast: isBefore(d, new Date(todayStr + 'T00:00:00')) && dateStr !== todayStr,
        };
      }),
      todayStr,
    };
  }, [weekOffset]);
}

/* ── Main Page ─────────────────────────────────────── */

export default function VipAvailability() {
  const isMobile = useIsMobile();
  const [sessions, setSessions] = useState<PublicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [claimSession, setClaimSession] = useState<PublicSession | null>(null);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [selectedMobileDate, setSelectedMobileDate] = useState<string | null>(null);

  const { monday, sunday, days, todayStr } = useWeekData(weekOffset);

  const weekStart = format(monday, 'yyyy-MM-dd');
  const weekEnd = format(sunday, 'yyyy-MM-dd');

  // Set mobile default to today when on current week
  useEffect(() => {
    if (isMobile) {
      if (weekOffset === 0) {
        setSelectedMobileDate(todayStr);
      } else {
        setSelectedMobileDate(format(monday, 'yyyy-MM-dd'));
      }
    }
  }, [weekOffset, isMobile, todayStr, monday]);

  const fetchSessions = useCallback(async () => {
    const { data } = await sb
      .from('vip_sessions')
      .select('id, session_date, session_time, status, reserved_by_group, description')
      .eq('is_on_availability_page', true)
      .gte('session_date', weekStart)
      .lte('session_date', weekEnd)
      .neq('status', 'cancelled')
      .order('session_date', { ascending: true })
      .order('session_time', { ascending: true });
    setSessions((data as any[]) || []);
    setLoading(false);
  }, [weekStart, weekEnd]);

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

  const isCurrentWeek = weekOffset === 0;

  /* ── Day Column ─────────────────────────────────── */

  const renderDaySlots = (dateStr: string) => {
    const daySessions = sessionsByDate[dateStr] || [];
    if (daySessions.length === 0) {
      return (
        <p className="text-center text-muted-foreground text-sm py-4">—</p>
      );
    }
    return (
      <div className="space-y-2">
        {daySessions.map((s) => (
          <SlotPill
            key={s.id}
            session={s}
            expanded={expandedId === s.id}
            isConfirmed={confirmedIds.has(s.id)}
            onToggle={() =>
              setExpandedId((prev) => (prev === s.id ? null : s.id))
            }
            onClaim={() => {
              setClaimSession(s);
              setExpandedId(null);
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-[#FF6900] text-white py-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold">
            OTF Tuscaloosa — Private Group Classes
          </h1>
          <p className="mt-2 text-sm opacity-90">
            We host free private fitness experiences for groups. Pick an
            available time below to claim your slot.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Week Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="min-h-[44px] flex-1 text-sm font-medium"
            disabled={isCurrentWeek}
            onClick={() => setWeekOffset((o) => o - 1)}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous Week
          </Button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold">
              Week of {format(monday, 'MMMM d')}
            </p>
            {!isCurrentWeek && (
              <button
                onClick={() => setWeekOffset(0)}
                className="text-xs text-[#FF6900] underline cursor-pointer mt-0.5"
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

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isMobile ? (
          /* ── Mobile: Day tabs + single day view ─── */
          <div className="space-y-3">
            {/* Day tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {days.map((day) => {
                const count = (sessionsByDate[day.date] || []).length;
                const isSelected = selectedMobileDate === day.date;
                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedMobileDate(day.date)}
                    className={cn(
                      'flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border min-h-[44px] min-w-[52px] cursor-pointer relative',
                      isSelected
                        ? 'bg-[#FF6900] text-white border-[#FF6900] font-bold'
                        : day.isToday
                          ? 'bg-card text-card-foreground border-[#FF6900]/50 ring-1 ring-[#FF6900]/30 hover:bg-muted'
                          : 'bg-card text-card-foreground border-border hover:bg-muted'
                    )}
                  >
                    <span className="text-[13px]">{day.dayAbbr}</span>
                    <span className="text-[11px]">{day.dateNum}</span>
                    {count > 0 && (
                      <span
                        className={cn(
                          'absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[9px] font-bold min-w-[16px] h-[16px] px-1',
                          isSelected
                            ? 'bg-white text-[#FF6900]'
                            : 'bg-[#FF6900] text-white'
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Selected day content */}
            {selectedMobileDate && (
              <div>
                <p className="text-sm font-semibold mb-2 text-muted-foreground">
                  {format(
                    new Date(selectedMobileDate + 'T00:00:00'),
                    'EEEE, MMMM d'
                  )}
                </p>
                {renderDaySlots(selectedMobileDate)}
              </div>
            )}
          </div>
        ) : (
          /* ── Desktop: 7-column grid ──────────────── */
          <div className="grid grid-cols-7 gap-2">
            {/* Column headers */}
            {days.map((day) => (
              <div
                key={day.date}
                className={cn(
                  'text-center pb-2 border-b-2',
                  day.isToday ? 'border-[#FF6900]' : 'border-transparent'
                )}
              >
                <p className="font-bold text-sm">{day.dayAbbr}</p>
                <p
                  className={cn(
                    'text-xs',
                    day.isToday
                      ? 'text-[#FF6900] font-semibold'
                      : 'text-muted-foreground'
                  )}
                >
                  {day.dateNum}
                </p>
              </div>
            ))}
            {/* Column content */}
            {days.map((day) => (
              <div key={day.date + '-content'} className="min-h-[80px]">
                {renderDaySlots(day.date)}
              </div>
            ))}
          </div>
        )}
      </div>

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
