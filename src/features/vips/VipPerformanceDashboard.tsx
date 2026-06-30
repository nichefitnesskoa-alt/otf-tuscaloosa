import { isCloseRun } from '@/lib/intros/close-detection';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import { VipMetricDrilldownDialog, type VipMetricKind, type VipGroup } from './VipMetricDrilldownDialog';

const QUARTER_START = '2026-04-01';
const QUARTER_END = '2026-06-30';

const sb = supabase as any;

const norm = (s: string | null | undefined) =>
  (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

const fullName = (first?: string | null, last?: string | null) =>
  [first, last].filter(Boolean).join(' ').trim();

export interface VipMetricsPayload {
  sessions: any[]; // raw sessions
  regs: any[];
  bookings: any[];
  runs: any[];
  totals: { classes: number; totalAttendees: number | null; introsBooked: number; joins: number };
}

async function fetchMetrics(): Promise<VipMetricsPayload> {
  const sessionsRes = await sb.from('vip_sessions')
    .select('id, status, actual_attendance, session_date, session_time, reserved_by_group, vip_class_name')
    .gte('session_date', QUARTER_START)
    .lte('session_date', QUARTER_END)
    .is('archived_at', null);

  const sessions = (sessionsRes.data as any[]) || [];
  const sessionIds = sessions.map(s => s.id);

  const [regsRes, bookingsRes] = await Promise.all([
    sessionIds.length
      ? sb.from('vip_registrations')
          .select('id, vip_session_id, first_name, last_name, phone, email, outcome, is_group_contact, booking_id')
          .in('vip_session_id', sessionIds)
      : Promise.resolve({ data: [] }),
    sb.from('intros_booked')
      .select('id, vip_session_id, member_name, phone, email, class_date, lead_source')
      .not('vip_session_id', 'is', null)
      .gte('class_date', QUARTER_START)
      .lte('class_date', QUARTER_END)
      .is('deleted_at', null),
  ]);

  const regs = (regsRes.data as any[]) || [];
  const bookings = (bookingsRes.data as any[]) || [];

  let runs: any[] = [];
  if (bookings.length > 0) {
    const ids = bookings.map(b => b.id);
    const runsRes = await sb.from('intros_run')
      .select('id, linked_intro_booked_id, member_name, result, result_canon, buy_date, run_date')
      .in('linked_intro_booked_id', ids);
    runs = (runsRes.data as any[]) || [];
  }

  // ---- Totals
  const classes = sessions.filter(s => s.status === 'reserved' || s.status === 'completed').length;

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

  const joinKeys = new Set<string>();
  for (const r of regs) {
    if (r.outcome === 'purchased') {
      joinKeys.add(`${norm(r.first_name)} ${norm(r.last_name)}`);
    }
  }
  const bookingMap = new Map(bookings.map(b => [b.id, b]));
  runs.forEach((r: any) => {
    if (!isCloseRun(r)) return;
    const b = bookingMap.get(r.linked_intro_booked_id);
    const name = norm(r.member_name || b?.member_name);
    if (name) joinKeys.add(name);
  });
  const joins = joinKeys.size;

  return {
    sessions, regs, bookings, runs,
    totals: { classes, totalAttendees: anyAttendanceData ? totalAttendees : null, introsBooked, joins },
  };
}

/**
 * Build per-group breakdown for a given metric kind. Single source so totals
 * always equal sum of group row counts which equal sum of expanded individuals.
 */
export function buildVipGroups(kind: VipMetricKind, p: VipMetricsPayload): VipGroup[] {
  const sessionMap = new Map(p.sessions.map(s => [s.id, s]));
  const bookingsBySession = new Map<string, any[]>();
  for (const b of p.bookings) {
    const arr = bookingsBySession.get(b.vip_session_id) || [];
    arr.push(b); bookingsBySession.set(b.vip_session_id, arr);
  }
  const regsBySession = new Map<string, any[]>();
  for (const r of p.regs) {
    const arr = regsBySession.get(r.vip_session_id) || [];
    arr.push(r); regsBySession.set(r.vip_session_id, arr);
  }
  const runsByBookingId = new Map<string, any[]>();
  for (const r of p.runs) {
    const arr = runsByBookingId.get(r.linked_intro_booked_id) || [];
    arr.push(r); runsByBookingId.set(r.linked_intro_booked_id, arr);
  }

  const mkGroup = (sessionId: string): VipGroup => {
    const s = sessionMap.get(sessionId);
    return {
      sessionId,
      groupName: s?.reserved_by_group || s?.vip_class_name || 'VIP Session',
      sessionDate: s?.session_date || '',
      sessionTime: s?.session_time || '',
      people: [],
    };
  };

  const groups = new Map<string, VipGroup>();
  const getGroup = (id: string) => {
    let g = groups.get(id); if (!g) { g = mkGroup(id); groups.set(id, g); } return g;
  };

  if (kind === 'classes') {
    for (const s of p.sessions) {
      if (!(s.status === 'reserved' || s.status === 'completed')) continue;
      const g = getGroup(s.id);
      const regs = regsBySession.get(s.id) || [];
      g.people = regs.map(r => ({
        name: fullName(r.first_name, r.last_name) || '(unnamed)',
        phone: r.phone, email: r.email,
        badge: r.outcome || (r.is_group_contact ? 'group contact' : undefined),
      }));
    }
  } else if (kind === 'attendees') {
    const attendedOutcomes = new Set(['showed', 'booked_intro', 'purchased']);
    for (const s of p.sessions) {
      const regs = (regsBySession.get(s.id) || []);
      const withOutcomes = regs.filter(r => r.outcome);
      const g = getGroup(s.id);
      if (withOutcomes.length > 0) {
        const attended = regs.filter(r => attendedOutcomes.has(r.outcome));
        g.people = attended.map(r => ({
          name: fullName(r.first_name, r.last_name) || '(unnamed)',
          phone: r.phone, email: r.email, badge: r.outcome,
        }));
      } else if (s.actual_attendance != null && s.actual_attendance > 0) {
        // Legacy: numeric only, no individuals
        g.people = [];
        g.legacyCount = s.actual_attendance;
      }
      if (g.people.length === 0 && !g.legacyCount) groups.delete(s.id);
    }
  } else if (kind === 'introsBooked') {
    // Union of registrations w/ booked_intro|purchased + intros_booked rows
    const seen = new Set<string>();
    for (const r of p.regs) {
      if (r.outcome !== 'booked_intro' && r.outcome !== 'purchased') continue;
      const key = `${r.vip_session_id}|${norm(r.first_name)} ${norm(r.last_name)}`;
      if (seen.has(key)) continue; seen.add(key);
      const g = getGroup(r.vip_session_id);
      g.people.push({
        name: fullName(r.first_name, r.last_name) || '(unnamed)',
        phone: r.phone, email: r.email, badge: r.outcome,
        bookingId: r.booking_id || undefined,
      });
    }
    for (const b of p.bookings) {
      const key = `${b.vip_session_id}|${norm(b.member_name)}`;
      if (seen.has(key)) continue; seen.add(key);
      const g = getGroup(b.vip_session_id);
      g.people.push({
        name: b.member_name, phone: b.phone, email: b.email,
        badge: b.class_date ? `intro ${b.class_date}` : 'intro booked',
        bookingId: b.id,
      });
    }
  } else if (kind === 'joins') {
    const seenNames = new Set<string>();
    for (const r of p.regs) {
      if (r.outcome !== 'purchased') continue;
      const nm = norm(`${r.first_name || ''} ${r.last_name || ''}`);
      if (seenNames.has(nm)) continue; seenNames.add(nm);
      const g = getGroup(r.vip_session_id);
      g.people.push({
        name: fullName(r.first_name, r.last_name) || '(unnamed)',
        phone: r.phone, email: r.email, badge: 'purchased',
      });
    }
    const bookingMap = new Map(p.bookings.map(b => [b.id, b]));
    for (const run of p.runs) {
      if (!isCloseRun(run)) continue;
      const b = bookingMap.get(run.linked_intro_booked_id);
      if (!b) continue;
      const nm = norm(run.member_name || b.member_name);
      if (seenNames.has(nm)) continue; seenNames.add(nm);
      const g = getGroup(b.vip_session_id);
      g.people.push({
        name: run.member_name || b.member_name,
        phone: b.phone, email: b.email,
        badge: run.result || 'sale',
        bookingId: b.id,
      });
    }
  }

  return Array.from(groups.values())
    .filter(g => g.people.length > 0 || g.legacyCount)
    .sort((a, b) => (b.sessionDate || '').localeCompare(a.sessionDate || ''));
}

function MetricTile({ label, value, sublabel, onClick, disabled }: {
  label: string; value: string | number; sublabel?: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-left w-full min-h-[88px] rounded-lg border border-surface-border bg-surface-card p-4 hover:border-primary hover:ring-1 hover:ring-primary/30 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="text-3xl font-bold text-center">{value}</div>
      <div className="text-xs text-muted-foreground mt-1 text-center">{label}</div>
      {sublabel && <div className="text-[10px] text-muted-foreground mt-0.5 text-center">{sublabel}</div>}
      <div className="text-[10px] text-primary mt-1 text-center">Tap for breakdown →</div>
    </button>
  );
}

export function VipPerformanceDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['vip-performance', QUARTER_START, QUARTER_END],
    queryFn: fetchMetrics,
    staleTime: 60_000,
  });

  const [openKind, setOpenKind] = useState<VipMetricKind | null>(null);

  const groups = useMemo(() => {
    if (!data || !openKind) return [];
    return buildVipGroups(openKind, data);
  }, [data, openKind]);

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const { totals } = data;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MetricTile label="VIP Classes This Quarter" value={totals.classes} onClick={() => setOpenKind('classes')} />
        <MetricTile
          label="Total Attendees"
          value={totals.totalAttendees === null ? '—' : totals.totalAttendees}
          sublabel="Auto-counted from outcomes"
          onClick={() => setOpenKind('attendees')}
          disabled={totals.totalAttendees === null}
        />
        <MetricTile label="Intros Booked from VIP" value={totals.introsBooked} onClick={() => setOpenKind('introsBooked')} />
        <MetricTile label="Joins from VIP" value={totals.joins} onClick={() => setOpenKind('joins')} />
      </div>
      <p className="text-[11px] text-muted-foreground text-center">
        Current quarter: April 1 – June 30 2026
      </p>

      <VipMetricDrilldownDialog
        open={openKind !== null}
        kind={openKind}
        groups={groups}
        onOpenChange={(o) => { if (!o) setOpenKind(null); }}
      />
    </div>
  );
}
