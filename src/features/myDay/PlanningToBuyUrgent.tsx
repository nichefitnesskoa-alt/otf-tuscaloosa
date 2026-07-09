/**
 * PlanningToBuyUrgent — Bold banner on MyDay surfacing planning-to-buy people
 * whose promised buy date is TODAY or PAST. Prevents them from being buried
 * inside the Follow-Up section.
 *
 * Flow:
 *  - Row surfaces when a `follow_up_queue` planning_to_buy row is due.
 *  - "We texted them" logs a touch, marks the current queue row sent, and
 *    schedules a NEW pending row 2 days out so the banner re-surfaces if no
 *    outcome is logged.
 *  - On the 2nd text (touch_number >= 2), the next scheduled row is flagged
 *    `closed_reason='awaiting_response_final'`. When THAT row comes due with
 *    still no outcome, `runAutoNotInterested` writes the canonical
 *    NOT_INTERESTED outcome via applyIntroOutcomeUpdate — coherent across
 *    WIG/SOML/Follow-Up.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getTodayYMD } from '@/lib/dateUtils';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { AlertTriangle, Phone, ClipboardList, Check, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPhoneDisplay, stripCountryCode } from '@/lib/parsing/phone';
import { useAuth } from '@/context/AuthContext';
import { applyIntroOutcomeUpdate } from '@/lib/domain/outcomes';
import { toast } from 'sonner';

interface Row {
  bookingId: string;
  queueRowId: string;
  name: string;
  phone: string | null;
  scheduledDate: string; // yyyy-MM-dd
  touchNumber: number;
  isFinalAttempt: boolean; // closed_reason === 'awaiting_response_final'
  classDate: string | null;
}

const TERMINAL_OUTCOMES = ['Purchased', 'Not Interested'];
const PURCHASE_RESULTS = ['Premier', 'Elite', 'Basic'];
function isTerminal(result: string | null | undefined): boolean {
  if (!result) return false;
  if (TERMINAL_OUTCOMES.includes(result)) return true;
  return PURCHASE_RESULTS.some(p => result.includes(p));
}

function ymd(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function PlanningToBuyUrgent() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const today = getTodayYMD();
    const { data: queue } = await (supabase
      .from('follow_up_queue')
      .select('id, booking_id, person_name, scheduled_date, touch_number, closed_reason, created_at') as any)
      .eq('person_type', 'planning_to_buy')
      .eq('status', 'pending')
      .is('not_interested_at', null)
      .lte('scheduled_date', today)
      .order('scheduled_date', { ascending: true });

    const items = (queue || []).filter((q: any) => q.booking_id && q.scheduled_date);
    if (items.length === 0) { setRows([]); setLoading(false); return; }

    const bookingIds: string[] = Array.from(new Set(items.map((q: any) => String(q.booking_id))));
    const nameList: string[] = Array.from(new Set(items.map((q: any) => String(q.person_name || '')).filter((s: string) => s.length > 0)));

    const [bookingsRes, runsRes] = await Promise.all([
      supabase.from('intros_booked').select('id, member_name, phone, class_date').in('id', bookingIds),
      nameList.length > 0
        ? supabase.from('intros_run').select('member_name, result').in('member_name', nameList)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const terminal = new Set<string>();
    for (const r of (runsRes.data || []) as any[]) {
      if (isTerminal(r.result)) terminal.add((r.member_name || '').toLowerCase());
    }

    const bookingMap = new Map<string, any>();
    for (const b of (bookingsRes.data || []) as any[]) bookingMap.set(b.id, b);

    // ── AUTO NOT INTERESTED: any "awaiting_response_final" row that's due
    //    and has had no new outcome → close via canonical pipeline.
    const autoClosed = new Set<string>();
    for (const q of items) {
      if (q.closed_reason !== 'awaiting_response_final') continue;
      const booking = bookingMap.get(q.booking_id);
      if (!booking) continue;
      const nameLower = (q.person_name || '').toLowerCase();
      if (terminal.has(nameLower)) continue;

      try {
        await applyIntroOutcomeUpdate({
          bookingId: q.booking_id,
          memberName: q.person_name || booking.member_name,
          classDate: booking.class_date || getTodayYMD(),
          newResult: 'Not interested',
          editedBy: 'System (planning-to-buy auto-close)',
          sourceComponent: 'PlanningToBuyUrgent',
          editReason: 'Auto: no response after 2 follow-up texts on planning-to-buy',
        });
        await (supabase.from('follow_up_queue') as any)
          .update({
            status: 'converted',
            not_interested_at: new Date().toISOString(),
            not_interested_by: 'System',
            closed_reason: 'auto_not_interested',
          })
          .eq('booking_id', q.booking_id)
          .eq('status', 'pending');
        autoClosed.add(q.booking_id);
      } catch (e) {
        console.warn('Auto not-interested failed for booking', q.booking_id, e);
      }
    }

    // Dedupe by booking_id — keep earliest scheduled date
    const seen = new Map<string, Row>();
    for (const q of items) {
      if (autoClosed.has(q.booking_id)) continue;
      const nameLower = (q.person_name || '').toLowerCase();
      if (terminal.has(nameLower)) continue;
      const booking = bookingMap.get(q.booking_id);
      if (!booking) continue;
      const existing = seen.get(q.booking_id);
      if (existing && existing.scheduledDate <= q.scheduled_date) continue;
      seen.set(q.booking_id, {
        bookingId: q.booking_id,
        queueRowId: q.id,
        name: q.person_name || booking.member_name,
        phone: booking.phone || null,
        scheduledDate: q.scheduled_date,
        touchNumber: q.touch_number || 1,
        isFinalAttempt: q.closed_reason === 'awaiting_response_final',
        classDate: booking.class_date || null,
      });
    }

    setRows(Array.from(seen.values()).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('planning-to-buy-urgent')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follow_up_queue' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intros_run' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleTexted = async (r: Row) => {
    if (savingId) return;
    setSavingId(r.bookingId);
    try {
      const userName = user?.name || 'Unknown';
      const nextTouch = (r.touchNumber || 1) + 1;
      // Second text → the NEXT scheduled row is the final attempt.
      const isSecondText = nextTouch >= 3; // touch 1 = initial due, 2 = after 1st text, 3 = after 2nd text
      const nextScheduled = ymd(addDays(new Date(), 2));

      // 1) Log the touch
      await (supabase.from('followup_touches') as any).insert({
        booking_id: r.bookingId,
        person_name: r.name,
        channel: 'sms',
        note: isSecondText
          ? '2nd text about planning-to-buy date (auto-closes in 2 days if no response)'
          : 'Texted about planning-to-buy date',
        created_by: userName,
      });

      // 2) Mark current queue row sent
      await (supabase.from('follow_up_queue') as any)
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_by: userName,
        })
        .eq('id', r.queueRowId);

      // 3) Schedule the next surface
      await (supabase.from('follow_up_queue') as any).insert({
        booking_id: r.bookingId,
        person_name: r.name,
        person_type: 'planning_to_buy',
        touch_number: nextTouch,
        trigger_date: getTodayYMD(),
        scheduled_date: nextScheduled,
        status: 'pending',
        closed_reason: isSecondText ? 'awaiting_response_final' : 'awaiting_response_1',
      });

      toast.success(isSecondText
        ? 'Logged. If no response in 2 days, auto-marks Not Interested.'
        : 'Logged. Back on your list in 2 days if no response.');
      fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error('Could not save. Try again.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading || rows.length === 0) return null;

  const today = getTodayYMD();
  const openOutcome = (bookingId: string) => {
    window.dispatchEvent(new CustomEvent('myday:open-outcome', { detail: { bookingId } }));
  };

  return (
    <div
      className="rounded-md border-2 border-destructive bg-destructive/10 p-3"
      role="alert"
    >
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
        <p className="text-sm font-bold text-destructive">
          Planning to Buy — {rows.length} person{rows.length === 1 ? '' : 's'} due today or overdue
        </p>
      </div>
      <div className="space-y-1.5">
        {rows.map(r => {
          const daysDiff = differenceInDays(parseISO(today), parseISO(r.scheduledDate));
          const isToday = daysDiff === 0;
          const label = isToday
            ? 'Due today'
            : daysDiff === 1 ? '1 day overdue' : `${daysDiff} days overdue`;
          const phoneDigits = stripCountryCode(r.phone);
          const phoneDisplay = formatPhoneDisplay(r.phone);
          const saving = savingId === r.bookingId;
          const isSecondAttempt = (r.touchNumber || 1) >= 2;
          return (
            <div key={r.queueRowId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1.5 border-t border-destructive/20 first:border-t-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">{r.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <Badge
                    variant={isToday ? 'secondary' : 'destructive'}
                    className="text-[10px] px-1.5 py-0 h-4 font-bold"
                  >
                    {label}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    Said: {format(parseISO(r.scheduledDate), 'MMM d')}
                  </span>
                  {isSecondAttempt && (
                    <span className="text-[10px] font-semibold text-destructive">
                      2nd try — auto-marks Not Interested in 2 days if no response
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {phoneDigits && phoneDisplay && (
                  <Button size="sm" variant="outline" className="h-8 px-2 text-[11px] gap-1" asChild>
                    <a href={`sms:+1${phoneDigits}`}>
                      <Phone className="w-3 h-3" />
                      Text
                    </a>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 px-2 text-[11px] gap-1 bg-primary hover:bg-primary/90"
                  onClick={() => handleTexted(r)}
                  disabled={saving}
                  title="Log that we texted them — brings them back in 2 days if no response"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  We texted them
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-[11px] gap-1"
                  onClick={() => openOutcome(r.bookingId)}
                  disabled={saving}
                >
                  <ClipboardList className="w-3 h-3" />
                  Log outcome
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
