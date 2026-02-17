import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle2, Link2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { isMembershipSale } from '@/lib/sales-detection';
import { getTodayYMD } from '@/lib/domain/outcomes/types';

interface Anomaly {
  type: 'orphan_run' | 'sale_no_buydate' | 'closed_no_run' | 'status_mismatch';
  id: string;
  label: string;
  detail: string;
}

export function IntegrityDashboard() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<string | null>(null);

  const scan = async () => {
    setLoading(true);
    const found: Anomaly[] = [];

    try {
      // 1. Orphan runs: linked_intro_booked_id not found
      const { data: runs } = await supabase
        .from('intros_run')
        .select('id, member_name, linked_intro_booked_id, result, buy_date')
        .not('linked_intro_booked_id', 'is', null);

      const { data: bookings } = await supabase
        .from('intros_booked')
        .select('id, member_name, booking_status, class_date')
        .is('deleted_at', null);

      const bookingIds = new Set((bookings || []).map(b => b.id));

      (runs || []).forEach(r => {
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
      });

      // 3. Closed bookings with no run
      const runLinkedIds = new Set((runs || []).map(r => r.linked_intro_booked_id).filter(Boolean));
      (bookings || []).forEach(b => {
        if (b.booking_status === 'Closed – Bought' && !runLinkedIds.has(b.id)) {
          found.push({
            type: 'closed_no_run',
            id: b.id,
            label: b.member_name,
            detail: `Booking is "Closed – Bought" but no linked run found`,
          });
        }
      });

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

  const typeLabel: Record<string, string> = {
    orphan_run: 'Orphan Run',
    sale_no_buydate: 'Sale Missing Date',
    closed_no_run: 'Closed No Run',
    status_mismatch: 'Status Mismatch',
  };

  const typeColor: Record<string, string> = {
    orphan_run: 'bg-red-100 text-red-800',
    sale_no_buydate: 'bg-amber-100 text-amber-800',
    closed_no_run: 'bg-orange-100 text-orange-800',
    status_mismatch: 'bg-blue-100 text-blue-800',
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
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {anomalies.map((a, i) => (
              <div key={`${a.type}-${a.id}-${i}`} className="flex items-start gap-2 p-2 rounded border text-sm">
                <Badge className={`text-[10px] flex-shrink-0 ${typeColor[a.type]}`}>{typeLabel[a.type]}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.detail}</p>
                </div>
                {a.type === 'sale_no_buydate' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] flex-shrink-0"
                    onClick={() => fixMissingBuyDate(a.id)}
                    disabled={fixing === a.id}
                  >
                    {fixing === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Calendar className="w-3 h-3 mr-0.5" /> Fix</>}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
