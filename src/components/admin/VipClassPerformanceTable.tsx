/**
 * VIP Class Performance table for the Studio (Recaps) tab.
 * Shows past VIP sessions with attendance, intros booked/ran, joins, and join rate.
 * Every numeric cell opens a PersonListDrillDown of the people behind it.
 */
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isCloseResult, labelForRun } from '@/lib/intros/resultLabels';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { backfillVipSessionLinks } from '@/lib/vip/backfillVipSessionLinks';
import { toast } from 'sonner';
import { PersonListDrillDown, DrillNumber, type PersonRow } from '@/components/dashboard/PersonListDrillDown';
import { useJourneyCard } from '@/components/person/useJourneyCard';

const sb = supabase as any;

type MetricKey = 'registered' | 'attended' | 'introsBooked' | 'introsRan' | 'joins';

interface VipPerfRow {
  id: string;
  session_date: string;
  session_time: string;
  reserved_by_group: string | null;
  actual_attendance: number | null;
  regCount: number;
  introsBooked: number;
  introsRan: number;
  joins: number;
  people: Record<MetricKey, PersonRow[]>;
}

const METRIC_TITLE: Record<MetricKey, string> = {
  registered: 'Registered',
  attended: 'Attended',
  introsBooked: 'Intros Booked',
  introsRan: 'Intros Ran',
  joins: 'Joins',
};

export function VipClassPerformanceTable() {
  const [rows, setRows] = useState<VipPerfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [relinking, setRelinking] = useState(false);
  const [drill, setDrill] = useState<{ row: VipPerfRow; metric: MetricKey } | null>(null);

  const handleRelink = async () => {
    setRelinking(true);
    try {
      const res = await backfillVipSessionLinks({ sinceDays: 365, maxRows: 2000 });
      toast.success(`Linked ${res.linked} of ${res.scanned} unlinked VIP intros`);
    } catch {
      toast.error('Re-link failed');
    } finally {
      setRelinking(false);
    }
  };

  useEffect(() => {
    (async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: sessions } = await sb
        .from('vip_sessions')
        .select('id, session_date, session_time, reserved_by_group, actual_attendance, status')
        .lt('session_date', today)
        .in('status', ['reserved', 'completed'])
        .order('session_date', { ascending: false });

      if (!sessions || sessions.length === 0) { setRows([]); setLoading(false); return; }

      const ids = sessions.map((s: any) => s.id);

      const [{ data: regs }, { data: bookings }] = await Promise.all([
        sb.from('vip_registrations')
          .select('id, vip_session_id, first_name, last_name, outcome')
          .in('vip_session_id', ids)
          .eq('is_group_contact', false),
        sb.from('intros_booked')
          .select('id, vip_session_id, member_name, class_date, booking_status_canon')
          .in('vip_session_id', ids),
      ]);

      const bookingIds = (bookings || []).map((b: any) => b.id);
      let runRows: any[] = [];
      if (bookingIds.length > 0) {
        const { data: r2 } = await sb
          .from('intros_run')
          .select('linked_intro_booked_id, result, result_canon, buy_date')
          .in('linked_intro_booked_id', bookingIds);
        runRows = r2 || [];
      }

      const runByBooking: Record<string, any[]> = {};
      for (const r of runRows) {
        if (!r.linked_intro_booked_id) continue;
        (runByBooking[r.linked_intro_booked_id] ||= []).push(r);
      }

      const regsBySession: Record<string, any[]> = {};
      for (const r of (regs || [])) {
        (regsBySession[r.vip_session_id] ||= []).push(r);
      }
      const bookingsBySession: Record<string, any[]> = {};
      for (const b of (bookings || [])) {
        (bookingsBySession[b.vip_session_id] ||= []).push(b);
      }

      const result: VipPerfRow[] = sessions.map((s: any) => {
        const sessionRegs = regsBySession[s.id] || [];
        const sessionBookings = bookingsBySession[s.id] || [];
        const showedBookings = sessionBookings.filter((b: any) => b.booking_status_canon === 'SHOWED');

        const regName = (r: any) =>
          [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || 'Unknown';
        const regAttended = (r: any) => {
          const o = (r.outcome || '').toString().toLowerCase();
          return o === 'attended' || o === 'showed' || o === 'show' || o === 'joined' || o === 'joined_member' || o === 'converted';
        };
        const registeredPeople: PersonRow[] = sessionRegs.map(r => ({
          id: `reg-${r.id}`,
          name: regName(r),
          rightLabel: regAttended(r) ? 'Attended' : (r.outcome || undefined),
          rightTone: regAttended(r) ? 'success' : 'muted',
        }));
        const attendedPeople: PersonRow[] = sessionRegs
          .filter(regAttended)
          .map(r => ({ id: `att-${r.id}`, name: regName(r) }));
        const bookedPeople: PersonRow[] = sessionBookings.map(b => ({
          id: `bk-${b.id}`,
          name: b.member_name || 'Unknown',
          subtitle: b.class_date ? `Class ${format(new Date(b.class_date + 'T00:00:00'), 'MMM d')}` : undefined,
          rightLabel: b.booking_status_canon === 'SHOWED' ? 'Showed' : (b.booking_status_canon || '—'),
          rightTone: b.booking_status_canon === 'SHOWED' ? 'success' : 'muted',
          href: `/pipeline?leadId=${b.id}`,
        }));
        const ranPeople: PersonRow[] = showedBookings.map(b => {
          const lastRun = (runByBooking[b.id] || [])[0];
          return {
            id: `ran-${b.id}`,
            name: b.member_name || 'Unknown',
            subtitle: b.class_date ? `Class ${format(new Date(b.class_date + 'T00:00:00'), 'MMM d')}` : undefined,
            rightLabel: lastRun ? labelForRun(lastRun) : 'Showed',
            rightTone: lastRun && isCloseResult(lastRun) ? 'success' : 'muted',
            href: `/pipeline?leadId=${b.id}`,
          };
        });
        const joinsPeople: PersonRow[] = sessionBookings
          .filter(b => (runByBooking[b.id] || []).some((r: any) => isCloseResult(r)))
          .map(b => {
            const saleRun = (runByBooking[b.id] || []).find((r: any) => isCloseResult(r));
            return {
              id: `join-${b.id}`,
              name: b.member_name || 'Unknown',
              subtitle: b.class_date ? `Class ${format(new Date(b.class_date + 'T00:00:00'), 'MMM d')}` : undefined,
              rightLabel: saleRun ? labelForRun(saleRun) : 'SALE',
              rightTone: 'success',
              href: `/pipeline?leadId=${b.id}`,
            };
          });

        return {
          id: s.id,
          session_date: s.session_date,
          session_time: s.session_time,
          reserved_by_group: s.reserved_by_group,
          actual_attendance: s.actual_attendance,
          regCount: sessionRegs.length,
          introsBooked: sessionBookings.length,
          introsRan: showedBookings.length,
          joins: joinsPeople.length,
          people: {
            registered: registeredPeople,
            attended: attendedPeople,
            introsBooked: bookedPeople,
            introsRan: ranPeople,
            joins: joinsPeople,
          },
        };
      });

      setRows(result);
      setLoading(false);
    })();
  }, []);

  const summary = useMemo(() => {
    const total = rows.length;
    const totalAttended = rows.reduce((sum, r) => sum + (r.actual_attendance ?? r.regCount), 0);
    const totalJoins = rows.reduce((sum, r) => sum + r.joins, 0);
    const avgJoinRate = totalAttended > 0 ? (totalJoins / totalAttended) * 100 : 0;
    return { total, totalAttended, totalJoins, avgJoinRate };
  }, [rows]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rows.length === 0) return null;

  const drillRows = drill ? drill.row.people[drill.metric] : [];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left py-2 cursor-pointer min-h-[44px]">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="font-semibold text-sm">VIP Class Performance</span>
          <span className="text-xs text-muted-foreground ml-1">Past VIP sessions with conversion tracking</span>
        </CollapsibleTrigger>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRelink}
          disabled={relinking}
          className="h-8 text-xs gap-1.5 shrink-0"
          title="Scan past VIP-source intros and auto-link any with a matching registration"
        >
          {relinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
          Re-link unlinked VIP intros
        </Button>
      </div>
      <CollapsibleContent>
        <Card className="mt-2">
          <CardContent className="p-3 space-y-3">
            <div className="text-xs text-muted-foreground">
              All time: <strong>{summary.total}</strong> VIP classes · <strong>{summary.totalAttended}</strong> total attended · <strong>{summary.totalJoins}</strong> joins · <strong>{summary.avgJoinRate.toFixed(0)}%</strong> avg join rate
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">Tap any number to see who.</p>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left p-2 font-medium">Date</th>
                    <th className="text-left p-2 font-medium">Group</th>
                    <th className="text-center p-2 font-medium">Registered</th>
                    <th className="text-center p-2 font-medium">Attended</th>
                    <th className="text-center p-2 font-medium">Intros Booked</th>
                    <th className="text-center p-2 font-medium">Intros Ran</th>
                    <th className="text-center p-2 font-medium">Joins</th>
                    <th className="text-center p-2 font-medium">Join Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const denom = r.actual_attendance ?? r.regCount;
                    const joinRate = denom > 0 ? (r.joins / denom) * 100 : 0;
                    const cell = (metric: MetricKey, value: number | string) => (
                      <td className="p-0 text-center">
                        <DrillNumber
                          value={value}
                          onClick={() => setDrill({ row: r, metric })}
                          ariaLabel={`View ${value} ${METRIC_TITLE[metric]} for ${format(new Date(r.session_date + 'T00:00:00'), 'MMM d')}`}
                        />
                      </td>
                    );
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="p-2 whitespace-nowrap font-medium">
                          {format(new Date(r.session_date + 'T00:00:00'), 'MMM d')}
                        </td>
                        <td className="p-2">{r.reserved_by_group || '—'}</td>
                        {cell('registered', r.regCount)}
                        {r.actual_attendance != null
                          ? cell('attended', r.actual_attendance)
                          : <td className="p-2 text-center text-muted-foreground">—</td>}
                        {cell('introsBooked', r.introsBooked)}
                        {cell('introsRan', r.introsRan)}
                        {cell('joins', r.joins)}
                        <td className="p-2 text-center">
                          <div>{denom > 0 ? `${joinRate.toFixed(0)}%` : '—'}</div>
                          {denom > 0 && (
                            <div className="text-[10px] text-muted-foreground">
                              {r.actual_attendance != null ? 'based on attended' : 'based on registered'}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>

      <PersonListDrillDown
        open={!!drill}
        onOpenChange={(o) => { if (!o) setDrill(null); }}
        title={drill ? `${METRIC_TITLE[drill.metric]} · ${format(new Date(drill.row.session_date + 'T00:00:00'), 'MMM d')}` : ''}
        scopeBadge="VIP class"
        subtitle={drill?.row.reserved_by_group || undefined}
        rows={drillRows}
        emptyText="No records for this metric."
      />
    </Collapsible>
  );
}
