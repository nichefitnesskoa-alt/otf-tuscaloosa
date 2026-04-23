/**
 * VIP Class Performance table for the Studio (Recaps) tab.
 * Shows past VIP sessions with attendance, intros booked/ran, joins, and join rate.
 */
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { backfillVipSessionLinks } from '@/lib/vip/backfillVipSessionLinks';
import { toast } from 'sonner';

const sb = supabase as any;

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
}

export function VipClassPerformanceTable() {
  const [rows, setRows] = useState<VipPerfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [relinking, setRelinking] = useState(false);

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

      const [{ data: regs }, { data: bookings }, { data: runs }] = await Promise.all([
        sb.from('vip_registrations').select('vip_session_id').in('vip_session_id', ids).eq('is_group_contact', false),
        sb.from('intros_booked').select('id, vip_session_id, booking_status_canon').in('vip_session_id', ids),
        sb.from('intros_run').select('linked_intro_booked_id, result_canon').in('linked_intro_booked_id',
          // We need booking IDs that have vip_session_id
          [] // will be filled below
        ),
      ]);

      // Get booking IDs for runs query
      const bookingIds = (bookings || []).map((b: any) => b.id);
      let runRows: any[] = runs || [];
      if (bookingIds.length > 0) {
        const { data: r2 } = await sb.from('intros_run').select('linked_intro_booked_id, result_canon').in('linked_intro_booked_id', bookingIds);
        runRows = r2 || [];
      }

      // Build lookup maps
      const regMap: Record<string, number> = {};
      for (const r of (regs || [])) { regMap[r.vip_session_id] = (regMap[r.vip_session_id] || 0) + 1; }

      const bookingsBySession: Record<string, any[]> = {};
      for (const b of (bookings || [])) {
        if (!bookingsBySession[b.vip_session_id]) bookingsBySession[b.vip_session_id] = [];
        bookingsBySession[b.vip_session_id].push(b);
      }

      const runByBooking: Record<string, any[]> = {};
      for (const r of runRows) {
        if (!r.linked_intro_booked_id) continue;
        if (!runByBooking[r.linked_intro_booked_id]) runByBooking[r.linked_intro_booked_id] = [];
        runByBooking[r.linked_intro_booked_id].push(r);
      }

      const result: VipPerfRow[] = sessions.map((s: any) => {
        const sessionBookings = bookingsBySession[s.id] || [];
        const introsBooked = sessionBookings.length;
        const showedBookings = sessionBookings.filter((b: any) => b.booking_status_canon === 'SHOWED');
        const introsRan = showedBookings.length;
        let joins = 0;
        for (const b of sessionBookings) {
          const bRuns = runByBooking[b.id] || [];
          if (bRuns.some((r: any) => r.result_canon === 'SALE')) joins++;
        }
        return {
          id: s.id,
          session_date: s.session_date,
          session_time: s.session_time,
          reserved_by_group: s.reserved_by_group,
          actual_attendance: s.actual_attendance,
          regCount: regMap[s.id] || 0,
          introsBooked,
          introsRan,
          joins,
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

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 cursor-pointer min-h-[44px]">
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span className="font-semibold text-sm">VIP Class Performance</span>
        <span className="text-xs text-muted-foreground ml-1">Past VIP sessions with conversion tracking</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-2">
          <CardContent className="p-3 space-y-3">
            {/* Summary row */}
            <div className="text-xs text-muted-foreground">
              All time: <strong>{summary.total}</strong> VIP classes · <strong>{summary.totalAttended}</strong> total attended · <strong>{summary.totalJoins}</strong> joins · <strong>{summary.avgJoinRate.toFixed(0)}%</strong> avg join rate
            </div>

            {/* Table */}
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
                    const denomLabel = r.actual_attendance != null ? 'attended' : 'registered';
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="p-2 whitespace-nowrap font-medium">
                          {format(new Date(r.session_date + 'T00:00:00'), 'MMM d')}
                        </td>
                        <td className="p-2">{r.reserved_by_group || '—'}</td>
                        <td className="p-2 text-center">{r.regCount}</td>
                        <td className="p-2 text-center">{r.actual_attendance ?? <span className="text-muted-foreground">—</span>}</td>
                        <td className="p-2 text-center">{r.introsBooked}</td>
                        <td className="p-2 text-center">{r.introsRan}</td>
                        <td className="p-2 text-center font-medium">{r.joins}</td>
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
    </Collapsible>
  );
}
