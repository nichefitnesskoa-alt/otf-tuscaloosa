import { isCloseRun } from '@/lib/intros/close-detection';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const QUARTER_START = '2026-04-01';
const QUARTER_END = '2026-06-30';

const sb = supabase as any;

const norm = (s: string | null | undefined) =>
  (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

async function fetchMetrics() {
  const sessionsRes = await sb.from('vip_sessions')
    .select('id, status, actual_attendance, session_date')
    .gte('session_date', QUARTER_START)
    .lte('session_date', QUARTER_END)
    .is('archived_at', null);

  const sessions = (sessionsRes.data as any[]) || [];
  const sessionIds = sessions.map(s => s.id);
  const classes = sessions.filter(s => s.status === 'reserved' || s.status === 'completed').length;

  const [regsRes, bookingsRes] = await Promise.all([
    sessionIds.length
      ? sb.from('vip_registrations')
          .select('id, vip_session_id, first_name, last_name, phone, outcome')
          .in('vip_session_id', sessionIds)
      : Promise.resolve({ data: [] }),
    sb.from('intros_booked')
      .select('id, vip_session_id, member_name, phone, class_date')
      .not('vip_session_id', 'is', null)
      .gte('class_date', QUARTER_START)
      .lte('class_date', QUARTER_END)
      .is('deleted_at', null),
  ]);

  const regs = (regsRes.data as any[]) || [];
  const bookings = (bookingsRes.data as any[]) || [];

  // ---- Total Attendees: count outcomes per session, fallback to legacy actual_attendance
  const attendedOutcomes = new Set(['showed', 'booked_intro', 'purchased']);
  const attendedBySession = new Map<string, number>();
  const anyOutcomeBySession = new Map<string, boolean>();
  for (const r of regs) {
    if (r.outcome) anyOutcomeBySession.set(r.vip_session_id, true);
    if (r.outcome && attendedOutcomes.has(r.outcome)) {
      attendedBySession.set(r.vip_session_id, (attendedBySession.get(r.vip_session_id) || 0) + 1);
    }
  }
  let totalAttendees = 0;
  let anyAttendanceData = false;
  for (const s of sessions) {
    if (anyOutcomeBySession.get(s.id)) {
      totalAttendees += attendedBySession.get(s.id) || 0;
      anyAttendanceData = true;
    } else if (s.actual_attendance != null) {
      totalAttendees += s.actual_attendance;
      anyAttendanceData = true;
    }
  }

  // ---- Intros Booked from VIP: union of registrations w/ booked_intro|purchased and intros_booked rows
  const introKeys = new Set<string>();
  for (const r of regs) {
    if (r.outcome === 'booked_intro' || r.outcome === 'purchased') {
      introKeys.add(`${r.vip_session_id}|${norm(r.first_name)} ${norm(r.last_name)}`);
    }
  }
  for (const b of bookings) {
    introKeys.add(`${b.vip_session_id}|${norm(b.member_name)}`);
  }
  const introsBooked = introKeys.size;

  // ---- Joins from VIP: union of registration 'purchased' + intros_run SALE on VIP bookings
  const joinKeys = new Set<string>();
  for (const r of regs) {
    if (r.outcome === 'purchased') {
      joinKeys.add(`${norm(r.first_name)} ${norm(r.last_name)}`);
    }
  }
  if (bookings.length > 0) {
    const ids = bookings.map(b => b.id);
    const { data: runs } = await sb.from('intros_run')
      .select('linked_intro_booked_id, member_name, result, result_canon, buy_date')
      .in('linked_intro_booked_id', ids);
    const bookingMap = new Map(bookings.map(b => [b.id, b]));
    (runs || []).forEach((r: any) => {
      // Canon-aware sale detection (single source: isCloseRun → isSaleCanon + isMembershipSale).
      if (!isCloseRun(r)) return;
      const b = bookingMap.get(r.linked_intro_booked_id);
      const name = norm(r.member_name || b?.member_name);
      if (name) joinKeys.add(name);
    });
  }
  const joins = joinKeys.size;

  return { classes, totalAttendees: anyAttendanceData ? totalAttendees : null, introsBooked, joins };
}

function MetricCard({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <div className="text-3xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
        {sublabel && <div className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</div>}
      </CardContent>
    </Card>
  );
}

export function VipPerformanceDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['vip-performance', QUARTER_START, QUARTER_END],
    queryFn: fetchMetrics,
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MetricCard label="VIP Classes This Quarter" value={data.classes} />
        <MetricCard
          label="Total Attendees"
          value={data.totalAttendees === null ? '—' : data.totalAttendees}
          sublabel="Auto-counted from outcomes"
        />
        <MetricCard label="Intros Booked from VIP" value={data.introsBooked} />
        <MetricCard label="Joins from VIP" value={data.joins} />
      </div>
      <p className="text-[11px] text-muted-foreground text-center">
        Current quarter: April 1 – June 30 2026
      </p>
    </div>
  );
}
