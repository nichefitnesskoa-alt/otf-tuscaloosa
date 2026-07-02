/**
 * MyDay banner + realtime toast for new Intro Scheduler Link bookings.
 *
 * - Fetches unacknowledged (per current user) scheduler-link bookings from
 *   the last 24 hours.
 * - Subscribes to intros_booked inserts filtered on via_scheduler_link=true;
 *   fires a sonner toast and refetches.
 * - Acknowledge writes to intro_booking_seen for the current user only.
 */
import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Sparkles, Check, Users } from 'lucide-react';
import { formatClassTimeDisplay } from '@/lib/classSchedule';

function longDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(x => parseInt(x, 10));
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function IntroLinkBookingBanner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const me = user?.name || '';

  const bookingsQ = useQuery({
    queryKey: ['intro-link-alert', me],
    enabled: !!me,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: bks } = await supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_time, lead_source, booked_by, scheduler_link_sa, paired_booking_id, created_at')
        .eq('via_scheduler_link', true)
        .gte('created_at', since)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      const { data: seen } = await supabase
        .from('intro_booking_seen' as any)
        .select('booking_id')
        .eq('seen_by', me);
      const seenSet = new Set(((seen as any[]) || []).map(r => r.booking_id));
      return (bks || []).filter(b => !seenSet.has(b.id));
    },
    staleTime: 15_000,
  });

  // Realtime: toast on any new scheduler-link insert
  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel('intro-link-inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'intros_booked', filter: 'via_scheduler_link=eq.true' },
        (payload: any) => {
          const b = payload.new;
          const first = (b.member_name || '').split(' ')[0];
          const time = (b.intro_time || '').slice(0, 5);
          const credit = b.scheduler_link_sa || b.booked_by || 'the team';
          toast.success(
            `New intro booked! ${first} — ${longDay(b.class_date)}, ${formatClassTimeDisplay(time)}`,
            { description: `Credited to ${credit}` },
          );
          qc.invalidateQueries({ queryKey: ['intro-link-alert', me] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me, qc]);

  const rows = bookingsQ.data || [];
  const grouped = useMemo(() => {
    // Pair originators with their friend if both are new+unacked, to render as one line
    const byId = new Map(rows.map(r => [r.id, r]));
    const seen = new Set<string>();
    const out: { primary: any; friend?: any }[] = [];
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      const friend = r.paired_booking_id && byId.get(r.paired_booking_id) ? byId.get(r.paired_booking_id) : undefined;
      if (friend && friend.paired_booking_id === r.id) {
        // pick the earlier as primary
        const primary = new Date(r.created_at) <= new Date(friend.created_at) ? r : friend;
        const other = primary === r ? friend : r;
        out.push({ primary, friend: other });
        seen.add(r.id); seen.add(friend.id);
      } else {
        out.push({ primary: r });
        seen.add(r.id);
      }
    }
    return out;
  }, [rows]);

  if (!me || grouped.length === 0) return null;

  const ack = async (bookingId: string, friendId?: string) => {
    const ids = friendId ? [bookingId, friendId] : [bookingId];
    await supabase.from('intro_booking_seen' as any).insert(
      ids.map(id => ({ booking_id: id, seen_by: me }))
    );
    qc.invalidateQueries({ queryKey: ['intro-link-alert', me] });
  };

  return (
    <div className="rounded-lg border border-primary bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-primary font-semibold">
        <Sparkles className="w-4 h-4" />
        New link bookings (last 24h)
      </div>
      {grouped.map(({ primary, friend }) => {
        const first = (primary.member_name || '').split(' ')[0];
        const t = (primary.intro_time || '').slice(0, 5);
        const credit = primary.scheduler_link_sa || primary.booked_by;
        return (
          <div key={primary.id} className="flex items-center gap-2 text-sm bg-background/60 rounded-md p-2 border border-border">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {first}{friend ? <> + {(friend.member_name || '').split(' ')[0]} <Users className="w-3 h-3 inline text-primary" /></> : null}
                <span className="text-muted-foreground"> · {longDay(primary.class_date)} · {formatClassTimeDisplay(t)}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {primary.lead_source} · credited to <strong className="text-foreground">{credit}</strong>
              </div>
            </div>
            <button
              onClick={() => ack(primary.id, friend?.id)}
              className="text-xs px-2 py-1 rounded border border-border hover:bg-muted flex items-center gap-1"
            >
              <Check className="w-3 h-3" /> Ack
            </button>
          </div>
        );
      })}
    </div>
  );
}
