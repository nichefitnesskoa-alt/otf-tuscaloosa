/**
 * PlanningToBuyUrgent — Bold banner on MyDay surfacing planning-to-buy people
 * whose promised buy date is TODAY or PAST. Prevents them from being buried
 * inside the Follow-Up section.
 *
 * Data source: follow_up_queue rows with person_type='planning_to_buy' and
 * status='pending' where scheduled_date <= today. Terminal outcomes (already
 * purchased) are filtered out to stay coherent with useFollowUpData.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getTodayYMD } from '@/lib/dateUtils';
import { format, parseISO, differenceInDays } from 'date-fns';
import { AlertTriangle, Phone, ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPhoneDisplay, stripCountryCode } from '@/lib/parsing/phone';

interface Row {
  bookingId: string;
  name: string;
  phone: string | null;
  scheduledDate: string; // yyyy-MM-dd
}

const TERMINAL_OUTCOMES = ['Purchased', 'Not Interested'];
const PURCHASE_RESULTS = ['Premier', 'Elite', 'Basic'];
function isTerminal(result: string | null | undefined): boolean {
  if (!result) return false;
  if (TERMINAL_OUTCOMES.includes(result)) return true;
  return PURCHASE_RESULTS.some(p => result.includes(p));
}

export function PlanningToBuyUrgent() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const today = getTodayYMD();
    const { data: queue } = await (supabase
      .from('follow_up_queue')
      .select('booking_id, person_name, scheduled_date') as any)
      .eq('person_type', 'planning_to_buy')
      .eq('status', 'pending')
      .is('not_interested_at', null)
      .lte('scheduled_date', today)
      .order('scheduled_date', { ascending: true });

    const items = (queue || []).filter((q: any) => q.booking_id && q.scheduled_date);
    if (items.length === 0) { setRows([]); setLoading(false); return; }

    const bookingIds = Array.from(new Set(items.map((q: any) => q.booking_id as string)));
    const nameList = Array.from(new Set(items.map((q: any) => (q.person_name as string) || '').filter(Boolean)));

    const [bookingsRes, runsRes] = await Promise.all([
      supabase.from('intros_booked').select('id, member_name, phone').in('id', bookingIds),
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

    // Dedupe by booking_id — keep earliest scheduled date
    const seen = new Map<string, Row>();
    for (const q of items) {
      const nameLower = (q.person_name || '').toLowerCase();
      if (terminal.has(nameLower)) continue;
      const booking = bookingMap.get(q.booking_id);
      if (!booking) continue;
      const existing = seen.get(q.booking_id);
      if (existing && existing.scheduledDate <= q.scheduled_date) continue;
      seen.set(q.booking_id, {
        bookingId: q.booking_id,
        name: q.person_name || booking.member_name,
        phone: booking.phone || null,
        scheduledDate: q.scheduled_date,
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
          return (
            <div key={r.bookingId} className="flex items-center justify-between gap-2 py-1.5 border-t border-destructive/20 first:border-t-0">
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
                </div>
              </div>
              <div className="flex items-center gap-1">
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
                  className="h-8 px-2 text-[11px] gap-1"
                  onClick={() => openOutcome(r.bookingId)}
                >
                  <ClipboardList className="w-3 h-3" />
                  Log
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
