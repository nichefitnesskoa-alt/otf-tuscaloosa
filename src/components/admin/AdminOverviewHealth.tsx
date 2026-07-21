import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign } from 'lucide-react';
import { isMembershipSale } from '@/lib/sales-detection';
import { DateRange } from '@/lib/pay-period';

interface AdminOverviewHealthProps {
  dateRange: DateRange;
}

export default function AdminOverviewHealth({ dateRange }: AdminOverviewHealthProps) {
  const [referralStats, setReferralStats] = useState({ pending: 0, qualified: 0, liability: 0 });

  useEffect(() => {
    fetchAll();
  }, [dateRange]);

  const fetchAll = async () => {
    const [referralRes, runsRes] = await Promise.all([
      supabase.from('referrals').select('*'),
      supabase.from('intros_run').select('linked_intro_booked_id, result'),
    ]);

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
  };

  return (
    <div className="space-y-4">
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
    </div>
  );
}
