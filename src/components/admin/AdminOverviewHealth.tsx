import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  DollarSign, Activity,
  CheckCircle, AlertTriangle, XCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { isMembershipSale } from '@/lib/sales-detection';
import { DateRange } from '@/lib/pay-period';

interface AdminOverviewHealthProps {
  dateRange: DateRange;
}

export default function AdminOverviewHealth({ dateRange }: AdminOverviewHealthProps) {
  const [referralStats, setReferralStats] = useState({ pending: 0, qualified: 0, liability: 0 });
  const [systemHealth, setSystemHealth] = useState<{
    lastGroupMePost: string | null;
    failedRecaps: number;
    lastSyncStatus: string | null;
    lastSyncTime: string | null;
  }>({ lastGroupMePost: null, failedRecaps: 0, lastSyncStatus: null, lastSyncTime: null });

  useEffect(() => {
    fetchAll();
  }, [dateRange]);

  const fetchAll = async () => {
    const [referralRes, runsRes, recapRes, syncRes] = await Promise.all([
      supabase.from('referrals').select('*'),
      supabase.from('intros_run').select('linked_intro_booked_id, result'),
      supabase.from('daily_recaps').select('status, created_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('sheets_sync_log').select('status, created_at').order('created_at', { ascending: false }).limit(1),
    ]);

    // Referral liability
    if (referralRes.data && runsRes.data) {
      const memberSales = new Set<string>();
      runsRes.data.forEach(r => {
        if (isMembershipSale(r.result)) memberSales.add(r.linked_intro_booked_id || '');
      });

      let qualified = 0;
      let pending = 0;
      (referralRes.data as any[]).forEach(ref => {
        const friendBookingLinked = ref.referred_booking_id && memberSales.has(ref.referred_booking_id);
        const referrerBookingLinked = ref.referrer_booking_id && memberSales.has(ref.referrer_booking_id);
        if (friendBookingLinked && referrerBookingLinked) qualified++;
        else pending++;
      });
      setReferralStats({ pending, qualified, liability: qualified * 50 });
    }

    // System health
    const failedRecaps = (recapRes.data || []).filter(r => r.status === 'failed').length;
    const lastSent = (recapRes.data || []).find(r => r.status === 'sent');
    const syncLog = syncRes.data?.[0];
    setSystemHealth({
      lastGroupMePost: lastSent?.created_at || null,
      failedRecaps,
      lastSyncStatus: syncLog?.status || null,
      lastSyncTime: syncLog?.created_at || null,
    });
  };

  return (
    <div className="space-y-4">
      {/* Referral Discount Liability */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-warning" />
            Referral Discount Liability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold">{referralStats.qualified}</p>
              <p className="text-xs text-muted-foreground">Qualified</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-muted-foreground">{referralStats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-warning">${referralStats.liability}</p>
              <p className="text-xs text-muted-foreground">Owed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Health */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <HealthRow
            label="GroupMe Posts"
            ok={systemHealth.failedRecaps === 0}
            detail={systemHealth.lastGroupMePost
              ? `Last sent ${format(parseISO(systemHealth.lastGroupMePost), 'MMM d, h:mm a')}`
              : 'No posts yet'}
            warning={systemHealth.failedRecaps > 0 ? `${systemHealth.failedRecaps} failed` : undefined}
          />
          <HealthRow
            label="Data Sync"
            ok={systemHealth.lastSyncStatus === 'success'}
            detail={systemHealth.lastSyncTime
              ? `Last sync ${format(parseISO(systemHealth.lastSyncTime), 'MMM d, h:mm a')}`
              : 'No syncs recorded'}
            warning={systemHealth.lastSyncStatus === 'error' ? 'Last sync failed' : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function HealthRow({ label, ok, detail, warning }: { label: string; ok: boolean; detail: string; warning?: string }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
      <div className="flex items-center gap-2">
        {warning ? (
          <AlertTriangle className="w-4 h-4 text-warning" />
        ) : ok ? (
          <CheckCircle className="w-4 h-4 text-success" />
        ) : (
          <XCircle className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">{detail}</p>
        {warning && <p className="text-xs text-warning font-medium">{warning}</p>}
      </div>
    </div>
  );
}
