import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle2, Calendar, Shield, Star } from 'lucide-react';
import { toast } from 'sonner';
import { isMembershipSale } from '@/lib/sales-detection';
import { getTodayYMD, normalizeBookingStatus, mapResultToBookingStatus, normalizeIntroResult, formatBookingStatusForDb } from '@/lib/domain/outcomes/types';
import { isVipBooking } from '@/lib/vip/vipRules';

interface Anomaly {
  type: 'orphan_run' | 'sale_no_buydate' | 'closed_no_run' | 'status_mismatch' | 'missing_amc_idempotency' | 'vip_followup' | 'vip_questionnaire';
  id: string;
  label: string;
  detail: string;
  extra?: Record<string, any>;
}

export function IntegrityDashboard() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<string | null>(null);

  const scan = async () => {
    setLoading(true);
    const found: Anomaly[] = [];

    try {
      const { data: runs } = await supabase
        .from('intros_run')
        .select('id, member_name, linked_intro_booked_id, result, buy_date, amc_incremented_at, created_at')
        .not('linked_intro_booked_id', 'is', null);

      const { data: bookings } = await supabase
        .from('intros_booked')
        .select('id, member_name, booking_status, class_date')
        .is('deleted_at', null);

      const bookingIds = new Set((bookings || []).map(b => b.id));
      const bookingMap = new Map((bookings || []).map(b => [b.id, b]));

      (runs || []).forEach(r => {
        // 1. Orphan runs
        if (r.linked_intro_booked_id && !bookingIds.has(r.linked_intro_booked_id)) {
          found.push({
            type: 'orphan_run',
            id: r.id,
            label: r.member_name,
            detail: `Run linked to booking ${r.linked_intro_booked_id?.slice(0, 8)} which doesn't exist`,
          });
        }

        // 2. Sales missing buy_date
        if (isMembershipSale(r.result) && !r.buy_date) {
          found.push({
            type: 'sale_no_buydate',
            id: r.id,
            label: r.member_name,
            detail: `Result "${r.result}" but buy_date is null`,
          });
        }

        // 3. Status mismatch: run says sale but booking not closed
        if (r.linked_intro_booked_id && bookingMap.has(r.linked_intro_booked_id)) {
          const booking = bookingMap.get(r.linked_intro_booked_id)!;
          const runIsSale = isMembershipSale(r.result);
          const bookingNorm = normalizeBookingStatus(booking.booking_status);
          
          if (runIsSale && bookingNorm !== 'CLOSED_PURCHASED') {
            found.push({
              type: 'status_mismatch',
              id: r.id,
              label: r.member_name,
              detail: `Run result "${r.result}" (sale) but booking status is "${booking.booking_status}"`,
              extra: { bookingId: booking.id, expectedStatus: 'Closed – Bought' },
            });
          } else if (!runIsSale && r.result !== 'Unresolved' && bookingNorm === 'CLOSED_PURCHASED') {
            found.push({
              type: 'status_mismatch',
              id: r.id,
              label: r.member_name,
              detail: `Booking is "Closed – Bought" but run result is "${r.result}"`,
              extra: { bookingId: booking.id },
            });
          }
        }

        // 4. Missing AMC idempotency for old sales
        if (isMembershipSale(r.result) && !r.amc_incremented_at) {
          const createdDate = new Date(r.created_at);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (createdDate < sevenDaysAgo) {
            found.push({
              type: 'missing_amc_idempotency',
              id: r.id,
              label: r.member_name,
              detail: `Sale from ${r.created_at.split('T')[0]} has no AMC idempotency stamp`,
            });
          }
        }
      });

      // 5. Closed bookings with no run
      const runLinkedIds = new Set((runs || []).map(r => r.linked_intro_booked_id).filter(Boolean));
      (bookings || []).forEach(b => {
        if (normalizeBookingStatus(b.booking_status) === 'CLOSED_PURCHASED' && !runLinkedIds.has(b.id)) {
          found.push({
            type: 'closed_no_run',
            id: b.id,
            label: b.member_name,
            detail: `Booking is "Closed – Bought" but no linked run found`,
          });
        }
      });

      // 6. VIP contamination: VIP bookings with follow-up entries
      const vipBookingIds = (bookings || []).filter(b => isVipBooking(b as any)).map(b => b.id);
      if (vipBookingIds.length > 0) {
        const { data: vipFollowUps } = await supabase
          .from('follow_up_queue')
          .select('id, person_name, booking_id')
          .in('booking_id', vipBookingIds)
          .eq('status', 'pending');

        (vipFollowUps || []).forEach(f => {
          found.push({
            type: 'vip_followup',
            id: f.id,
            label: f.person_name,
            detail: `VIP booking has pending follow-up (should not exist)`,
            extra: { bookingId: f.booking_id },
          });
        });

        // VIP bookings with questionnaires
        const { data: vipQs } = await supabase
          .from('intro_questionnaires')
          .select('id, client_first_name, client_last_name, booking_id')
          .in('booking_id', vipBookingIds)
          .is('archived_at' as any, null);

        (vipQs || []).forEach(q => {
          found.push({
            type: 'vip_questionnaire',
            id: q.id,
            label: `${q.client_first_name} ${q.client_last_name}`,
            detail: `VIP booking has active questionnaire (should be archived)`,
            extra: { bookingId: q.booking_id },
          });
        });
      }

      setAnomalies(found);
    } catch (err) {
      console.error('Integrity scan error:', err);
      toast.error('Scan failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { scan(); }, []);

  const fixMissingBuyDate = async (runId: string) => {
    setFixing(runId);
    try {
      await supabase.from('intros_run').update({ buy_date: getTodayYMD() }).eq('id', runId);
      toast.success('buy_date set to today');
      setAnomalies(prev => prev.filter(a => !(a.type === 'sale_no_buydate' && a.id === runId)));
    } catch {
      toast.error('Fix failed');
    } finally {
      setFixing(null);
    }
  };

  const fixStatusMismatch = async (anomaly: Anomaly) => {
    setFixing(anomaly.id);
    try {
      // Get the run to determine correct status
      const { data: run } = await supabase.from('intros_run').select('result').eq('id', anomaly.id).maybeSingle();
      if (!run || !anomaly.extra?.bookingId) throw new Error('Missing data');

      const normalized = normalizeIntroResult(run.result);
      const correctStatus = formatBookingStatusForDb(mapResultToBookingStatus(normalized));

      await supabase.from('intros_booked').update({
        booking_status: correctStatus,
        last_edited_at: new Date().toISOString(),
        last_edited_by: 'Admin (Integrity Fix)',
        edit_reason: `Status corrected from integrity scan: run result "${run.result}" → booking "${correctStatus}"`,
      }).eq('id', anomaly.extra.bookingId);

      toast.success(`Booking status fixed to "${correctStatus}"`);
      setAnomalies(prev => prev.filter(a => a.id !== anomaly.id || a.type !== 'status_mismatch'));
    } catch (err) {
      console.error('Fix status mismatch error:', err);
      toast.error('Fix failed');
    } finally {
      setFixing(null);
    }
  };

  const stampAmcIdempotency = async (runId: string) => {
    setFixing(runId);
    try {
      await supabase.from('intros_run').update({
        amc_incremented_at: new Date().toISOString(),
        amc_incremented_by: 'Admin (Legacy Stamp)',
      } as any).eq('id', runId);

      // Log outcome event
      await supabase.from('outcome_events' as any).insert({
        booking_id: '00000000-0000-0000-0000-000000000000', // placeholder
        run_id: runId,
        old_result: null,
        new_result: 'Legacy AMC stamp',
        edited_by: 'Admin',
        source_component: 'IntegrityDashboard',
        edit_reason: 'Legacy AMC idempotency stamp applied',
        metadata: JSON.stringify({ legacy_stamp: true }),
      } as any);

      toast.success('AMC idempotency stamp applied');
      setAnomalies(prev => prev.filter(a => !(a.type === 'missing_amc_idempotency' && a.id === runId)));
    } catch {
      toast.error('Fix failed');
    } finally {
      setFixing(null);
    }
  };

  const typeLabel: Record<string, string> = {
    orphan_run: 'Orphan Run',
    sale_no_buydate: 'Sale Missing Date',
    closed_no_run: 'Closed No Run',
    status_mismatch: 'Status Mismatch',
    missing_amc_idempotency: 'No AMC Stamp',
    vip_followup: 'VIP Follow-up',
    vip_questionnaire: 'VIP Questionnaire',
  };

  const typeColor: Record<string, string> = {
    orphan_run: 'bg-red-100 text-red-800',
    sale_no_buydate: 'bg-amber-100 text-amber-800',
    closed_no_run: 'bg-orange-100 text-orange-800',
    status_mismatch: 'bg-blue-100 text-blue-800',
    missing_amc_idempotency: 'bg-purple-100 text-purple-800',
    vip_followup: 'bg-purple-100 text-purple-800',
    vip_questionnaire: 'bg-purple-100 text-purple-800',
  };

  const handleCleanVipFollowUps = async () => {
    const vipFuIds = anomalies.filter(a => a.type === 'vip_followup').map(a => a.id);
    if (vipFuIds.length === 0) return;
    setFixing('vip_followups');
    try {
      await supabase.from('follow_up_queue').update({ status: 'dormant' }).in('id', vipFuIds);
      toast.success(`${vipFuIds.length} VIP follow-ups set to dormant`);
      setAnomalies(prev => prev.filter(a => a.type !== 'vip_followup'));
    } catch { toast.error('Failed'); }
    finally { setFixing(null); }
  };

  const handleArchiveVipQuestionnaires = async () => {
    const vipQIds = anomalies.filter(a => a.type === 'vip_questionnaire').map(a => a.id);
    if (vipQIds.length === 0) return;
    setFixing('vip_qs');
    try {
      await supabase.from('intro_questionnaires').update({ archived_at: new Date().toISOString() } as any).in('id', vipQIds);
      toast.success(`${vipQIds.length} VIP questionnaires archived`);
      setAnomalies(prev => prev.filter(a => a.type !== 'vip_questionnaire'));
    } catch { toast.error('Failed'); }
    finally { setFixing(null); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          Data Integrity
          <Badge variant="secondary" className="ml-auto">{anomalies.length} issues</Badge>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={scan} disabled={loading}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Rescan'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : anomalies.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 py-4">
            <CheckCircle2 className="w-4 h-4" /> No integrity issues found
          </div>
        ) : (
          <div className="space-y-2">
            {/* VIP bulk cleanup buttons */}
            {(anomalies.some(a => a.type === 'vip_followup') || anomalies.some(a => a.type === 'vip_questionnaire')) && (
              <div className="flex items-center gap-2 p-2 rounded border border-purple-200 bg-purple-50">
                <Star className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-medium text-purple-700">VIP Contamination</span>
                {anomalies.some(a => a.type === 'vip_followup') && (
                  <Button size="sm" variant="outline" className="h-6 text-[10px] border-purple-300"
                    onClick={handleCleanVipFollowUps} disabled={fixing === 'vip_followups'}>
                    {fixing === 'vip_followups' ? <Loader2 className="w-3 h-3 animate-spin" /> : `Remove ${anomalies.filter(a => a.type === 'vip_followup').length} VIP Follow-ups`}
                  </Button>
                )}
                {anomalies.some(a => a.type === 'vip_questionnaire') && (
                  <Button size="sm" variant="outline" className="h-6 text-[10px] border-purple-300"
                    onClick={handleArchiveVipQuestionnaires} disabled={fixing === 'vip_qs'}>
                    {fixing === 'vip_qs' ? <Loader2 className="w-3 h-3 animate-spin" /> : `Archive ${anomalies.filter(a => a.type === 'vip_questionnaire').length} VIP Qs`}
                  </Button>
                )}
              </div>
            )}
            <div className="max-h-[400px] overflow-y-auto space-y-2">
            {anomalies.map((a, i) => (
              <div key={`${a.type}-${a.id}-${i}`} className="flex items-start gap-2 p-2 rounded border text-sm">
                <Badge className={`text-[10px] flex-shrink-0 ${typeColor[a.type]}`}>{typeLabel[a.type]}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.detail}</p>
                </div>
                {a.type === 'sale_no_buydate' && (
                  <Button
                    size="sm" variant="outline" className="h-6 text-[10px] flex-shrink-0"
                    onClick={() => fixMissingBuyDate(a.id)} disabled={fixing === a.id}
                  >
                    {fixing === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Calendar className="w-3 h-3 mr-0.5" /> Fix</>}
                  </Button>
                )}
                {a.type === 'status_mismatch' && a.extra?.bookingId && (
                  <Button
                    size="sm" variant="outline" className="h-6 text-[10px] flex-shrink-0"
                    onClick={() => fixStatusMismatch(a)} disabled={fixing === a.id}
                  >
                    {fixing === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Fix Status'}
                  </Button>
                )}
                {a.type === 'missing_amc_idempotency' && (
                  <Button
                    size="sm" variant="outline" className="h-6 text-[10px] flex-shrink-0"
                    onClick={() => stampAmcIdempotency(a.id)} disabled={fixing === a.id}
                  >
                    {fixing === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Shield className="w-3 h-3 mr-0.5" /> Stamp</>}
                  </Button>
                )}
              </div>
            ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
