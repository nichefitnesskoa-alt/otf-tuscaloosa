import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const QUARTER_START = '2026-04-01';
const QUARTER_END = '2026-06-30';

const sb = supabase as any;

async function fetchMetrics() {
  const [sessionsRes, bookingsRes] = await Promise.all([
    sb.from('vip_sessions')
      .select('id, status, actual_attendance, session_date')
      .gte('session_date', QUARTER_START)
      .lte('session_date', QUARTER_END)
      .is('archived_at', null),
    sb.from('intros_booked')
      .select('id, vip_session_id, class_date')
      .not('vip_session_id', 'is', null)
      .gte('class_date', QUARTER_START)
      .lte('class_date', QUARTER_END)
      .is('deleted_at', null),
  ]);

  const sessions = (sessionsRes.data as any[]) || [];
  const bookings = (bookingsRes.data as any[]) || [];

  const classes = sessions.filter(s => s.status === 'reserved' || s.status === 'completed').length;
  const attended = sessions.filter(s => s.actual_attendance != null);
  const totalAttendees = attended.length === 0
    ? null
    : attended.reduce((sum, s) => sum + (s.actual_attendance || 0), 0);
  const introsBooked = bookings.length;

  let joins = 0;
  if (bookings.length > 0) {
    const ids = bookings.map(b => b.id);
    const { data: runs } = await sb.from('intros_run')
      .select('linked_intro_booked_id, result_canon')
      .in('linked_intro_booked_id', ids)
      .eq('result_canon', 'SALE');
    const set = new Set<string>();
    (runs || []).forEach((r: any) => r.linked_intro_booked_id && set.add(r.linked_intro_booked_id));
    joins = set.size;
  }

  return { classes, totalAttendees, introsBooked, joins };
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
          sublabel="Manual attendance logged"
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
